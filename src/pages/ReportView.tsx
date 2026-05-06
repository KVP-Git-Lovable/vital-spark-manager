import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReport } from "@/lib/reportsCatalog";
import { ReportFilterBar, type FilterState } from "@/components/reports/ReportFilterBar";
import { SortableDataTable } from "@/components/reports/SortableDataTable";
import { ReportChart } from "@/components/reports/ReportChart";
import NotFound from "./NotFound";

function toCSV(columns: { key: string; label: string; accessor?: (r: any) => any }[], rows: any[]) {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = c.accessor ? c.accessor(r) : r[c.key];
          if (v == null) return "";
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

const ReportView = () => {
  const { key } = useParams<{ key: string }>();
  const report = key ? getReport(key) : undefined;

  const [filterState, setFilterState] = useState<FilterState>({ search: "", selects: {} });

  if (!report) return <NotFound />;

  const fromIso = filterState.dateFrom ? filterState.dateFrom.toISOString() : undefined;
  const toIso = filterState.dateTo
    ? new Date(filterState.dateTo.getTime() + 86_400_000 - 1).toISOString()
    : undefined;

  const { data: rawRows = [], isLoading } = useQuery({
    queryKey: ["report", report.key, fromIso, toIso],
    queryFn: () => report.fetcher({ from: fromIso, to: toIso }),
  });

  const filteredRows = useMemo(() => {
    let rows = rawRows as any[];
    // Select filters
    for (const f of report.filters) {
      if (f.type !== "select") continue;
      const v = filterState.selects[f.key];
      if (!v) continue;
      const field = f.field || f.key;
      rows = rows.filter((r) => String(r[field] ?? "") === v);
    }
    // Search
    const q = filterState.search.trim().toLowerCase();
    if (q && report.searchFields?.length) {
      rows = rows.filter((r) =>
        report.searchFields!.some((field) => String(r[field] ?? "").toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [rawRows, filterState, report]);

  const summary = report.summary?.(filteredRows) ?? [];

  const downloadCsv = () => {
    const csv = toCSV(report.columns, filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link to="/reports" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to Reports
          </Link>
          <h1 className="page-title">{report.title}</h1>
          <p className="page-subtitle">{report.description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!filteredRows.length}>
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      <ReportFilterBar filters={report.filters} state={filterState} onChange={setFilterState} />

      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {summary.map((s) => (
            <div key={s.label} className="data-table p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="text-lg font-semibold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {report.chart && !isLoading && (
        <ReportChart
          title={report.chart.title}
          data={report.chart.build(filteredRows)}
          valueLabel={report.chart.valueLabel}
          orientation={report.chart.orientation}
        />
      )}

      {isLoading ? (
        <div className="data-table p-12 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
        </div>
      ) : (
        <SortableDataTable
          columns={report.columns}
          rows={filteredRows}
          rowHref={report.rowHref}
          defaultSort={report.defaultSort}
        />
      )}
    </div>
  );
};

export default ReportView;