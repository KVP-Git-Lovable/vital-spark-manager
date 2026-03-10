import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getObjectByKey, type ReportFilter } from "@/lib/reportObjects";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 80%, 55%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 60%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(200, 60%, 45%)",
];

interface Props {
  primaryObject: string;
  relatedObject: string;
  columns: string[];
  groupRows: string[];
  groupColumns: string[];
  filters: ReportFilter[];
  chartType: string;
  compact?: boolean;
}

const RECORD_ROUTES: Record<string, string> = {
  patients: "/patients",
  appointments: "/appointments",
  procedures: "/procedures",
  invoices: "/billing",
  services: "/services",
  assets: "/assets",
  pharma_products: "/pharma",
  staff: "/settings",
  vendors: "/assets",
};

export function ReportPreview({
  primaryObject,
  relatedObject,
  columns,
  groupRows,
  groupColumns,
  filters,
  chartType,
  compact,
}: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [primaryObject, relatedObject, columns, groupRows, groupColumns, filters]);

  const fetchData = async () => {
    setLoading(true);
    const primaryObj = getObjectByKey(primaryObject);
    if (!primaryObj) return;

    const allFieldKeys = [...new Set([...columns, ...groupRows, ...groupColumns])];
    const primaryFields = allFieldKeys
      .filter((fk) => fk.startsWith(`${primaryObject}.`))
      .map((fk) => fk.split(".")[1]);

    if (!primaryFields.includes("id")) primaryFields.push("id");

    let query = supabase.from(primaryObj.table as any).select(primaryFields.join(","));

    filters
      .filter((f) => f.field.startsWith(`${primaryObject}.`))
      .forEach((f) => {
        const col = f.field.split(".")[1];
        switch (f.operator) {
          case "equals": query = query.eq(col, f.value); break;
          case "not_equals": query = query.neq(col, f.value); break;
          case "contains": query = query.ilike(col, `%${f.value}%`); break;
          case "gt": query = query.gt(col, f.value); break;
          case "lt": query = query.lt(col, f.value); break;
          case "gte": query = query.gte(col, f.value); break;
          case "lte": query = query.lte(col, f.value); break;
          case "is_null": query = query.is(col, null); break;
          case "is_not_null": query = query.not(col, "is", null); break;
        }
      });

    query = query.limit(500);
    const { data: result, error } = await query;
    if (!error && result) setData(result);
    setLoading(false);
  };

  const getFieldLabel = (fk: string) => {
    const [objKey, fieldKey] = fk.split(".");
    const obj = getObjectByKey(objKey);
    return obj?.fields.find((f) => f.key === fieldKey)?.label || fieldKey;
  };

  const handleRecordClick = (record: any) => {
    const route = RECORD_ROUTES[primaryObject];
    if (route && record.id) {
      const detailPath = primaryObject === "patients" ? `${route}/${record.id}` : route;
      window.open(detailPath, "_blank");
    }
  };

  const formatVal = (val: any) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "number") return val.toLocaleString("en-IN");
    if (String(val).match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      } catch { return String(val); }
    }
    return String(val);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading report data...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No records found. Try adjusting your filters.
      </div>
    );
  }

  const groupField = groupRows[0]?.split(".")[1];
  const groupColField = groupColumns[0]?.split(".")[1];
  const numericCols = columns.filter((c) => {
    const obj = getObjectByKey(c.split(".")[0]);
    return obj?.fields.find((f) => f.key === c.split(".")[1])?.type === "number";
  });

  const buildChartData = () => {
    if (!groupField) return [];
    const grouped: Record<string, any> = {};
    data.forEach((row) => {
      const key = String(row[groupField] || "N/A");
      if (!grouped[key]) grouped[key] = { name: key, count: 0 };
      grouped[key].count += 1;
      numericCols.forEach((nc) => {
        const col = nc.split(".")[1];
        grouped[key][col] = (grouped[key][col] || 0) + (Number(row[col]) || 0);
      });
    });
    return Object.values(grouped);
  };

  // Number summary
  if (chartType === "number") {
    const total = data.length;
    const sums = numericCols.map((nc) => {
      const col = nc.split(".")[1];
      const sum = data.reduce((s, r) => s + (Number(r[col]) || 0), 0);
      return { label: getFieldLabel(nc), sum };
    });
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="data-table p-4 text-center">
          <div className="text-3xl font-display font-bold text-primary">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Records</div>
        </div>
        {sums.map((s) => (
          <div key={s.label} className="data-table p-4 text-center">
            <div className="text-3xl font-display font-bold text-foreground">{s.sum.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    );
  }

  // Charts
  if (chartType !== "table" && groupField) {
    const chartData = buildChartData();
    const valueKey = numericCols.length > 0 ? numericCols[0].split(".")[1] : "count";
    const height = compact ? 200 : 350;

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey={valueKey} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "doughnut") {
      return (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={compact ? 40 : 60}
                outerRadius={compact ? 70 : 100}
                paddingAngle={3}
                dataKey={valueKey}
                nameKey="name"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {chartData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey={valueKey} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  }

  // TABLE VIEW — with group rows support
  const displayCols = columns.filter((c) => c.startsWith(`${primaryObject}.`));

  if (groupField && chartType === "table") {
    // Group data by the groupField
    const grouped: Record<string, any[]> = {};
    data.forEach((row) => {
      const key = String(row[groupField] || "N/A");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    const groupLabel = getFieldLabel(groupRows[0]);

    return (
      <div className="overflow-x-auto">
        {Object.entries(grouped).map(([groupKey, rows]) => (
          <div key={groupKey} className="mb-4">
            <div className="bg-muted/50 px-3 py-1.5 rounded-t text-xs font-semibold text-foreground flex items-center gap-2">
              <span className="text-muted-foreground">{groupLabel}:</span>
              <span>{groupKey}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{rows.length}</Badge>
            </div>
            <table className="w-full text-sm border border-border rounded-b overflow-hidden">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {displayCols.map((c) => (
                    <th key={c} className="text-left py-1.5 px-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      {getFieldLabel(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, compact ? 5 : 50).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/50 hover:bg-accent/20 cursor-pointer transition-colors"
                    onClick={() => handleRecordClick(row)}
                  >
                    {displayCols.map((c) => (
                      <td key={c} className="py-1.5 px-3 whitespace-nowrap text-xs text-foreground">
                        {formatVal(row[c.split(".")[1]])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // Flat table (no grouping)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {displayCols.map((c) => (
              <th key={c} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {getFieldLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, compact ? 10 : 100).map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/50 hover:bg-accent/20 cursor-pointer transition-colors"
              onClick={() => handleRecordClick(row)}
            >
              {displayCols.map((c) => (
                <td key={c} className="py-2 px-3 whitespace-nowrap text-foreground">
                  {formatVal(row[c.split(".")[1]])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > (compact ? 10 : 100) && (
        <p className="text-xs text-muted-foreground py-2 text-center">
          Showing {compact ? 10 : 100} of {data.length} records
        </p>
      )}
    </div>
  );
}
