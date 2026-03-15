import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Edit,
  Filter,
  Plus,
  Table,
  BarChart3,
  PieChart,
  LineChart,
  Hash,
  Lock,
  PanelRightClose,
} from "lucide-react";
import {
  CHART_TYPES,
  getObjectByKey,
  DEFAULT_DISPLAY_OPTIONS,
  type SavedReport,
  type ReportFilter,
  type ReportField,
  type ReportDisplayOptions,
} from "@/lib/reportObjects";
import { ReportPreview } from "./ReportPreview";
import { FilterRow } from "./FilterRow";

const chartIcons: Record<string, any> = {
  table: Table,
  bar: BarChart3,
  doughnut: PieChart,
  line: LineChart,
  number: Hash,
};

interface Props {
  report: SavedReport;
  onEdit: () => void;
  onClose: () => void;
}

export function ReportViewer({ report, onEdit, onClose }: Props) {
  const [chartType, setChartType] = useState(report.chart_type);
  const [tempFilters, setTempFilters] = useState<ReportFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<ReportDisplayOptions>(
    report.display_options || { ...DEFAULT_DISPLAY_OPTIONS }
  );

  const primaryObj = getObjectByKey(report.primary_object);
  const relatedObj = report.related_object ? getObjectByKey(report.related_object) : null;

  const allFields: (ReportField & { objectKey: string; prefix: string })[] = [];
  if (primaryObj) {
    primaryObj.fields.forEach((f) =>
      allFields.push({ ...f, objectKey: report.primary_object, prefix: primaryObj.label })
    );
  }
  if (relatedObj && report.related_object) {
    relatedObj.fields.forEach((f) =>
      allFields.push({ ...f, objectKey: report.related_object!, prefix: relatedObj.label })
    );
  }

  const fieldKeyStr = (f: { objectKey: string; key: string }) => `${f.objectKey}.${f.key}`;

  const getFieldLabel = (fk: string) => {
    const [objKey, fldKey] = fk.split(".");
    const obj = getObjectByKey(objKey);
    return obj?.fields.find((f) => f.key === fldKey)?.label || fk;
  };

  const activeFilters = [...report.filters, ...tempFilters];

  const addTempFilter = () => {
    if (allFields.length === 0) return;
    const first = allFields[0];
    setTempFilters((p) => [
      ...p,
      { field: fieldKeyStr(first), operator: "equals", value: "", objectKey: first.objectKey },
    ]);
  };

  const updateTempFilter = (idx: number, patch: Partial<ReportFilter>) => {
    setTempFilters((p) => p.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeTempFilter = (idx: number) => {
    setTempFilters((p) => p.filter((_, i) => i !== idx));
  };

  const totalFilterCount = activeFilters.length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-display font-semibold text-sm text-foreground truncate max-w-[250px]">
          {report.name}
        </h1>
        <Badge variant="outline" className="text-[10px] shrink-0">{primaryObj?.label}</Badge>
        {relatedObj && <Badge variant="outline" className="text-[10px] shrink-0">+ {relatedObj.label}</Badge>}

        <div className="flex gap-0.5 shrink-0 ml-auto">
          {CHART_TYPES.map((ct) => {
            const Icon = chartIcons[ct.key] || Table;
            return (
              <Button
                key={ct.key}
                size="icon"
                variant={chartType === ct.key ? "default" : "ghost"}
                className="h-7 w-7"
                title={ct.label}
                onClick={() => setChartType(ct.key)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>

        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowFilters((p) => !p)}
        >
          <Filter className="h-3 w-3" />
          Filters
          {totalFilterCount > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{totalFilterCount}</Badge>
          )}
        </Button>

        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onEdit}>
          <Edit className="h-3 w-3" /> Edit
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Report content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 bg-background">
            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground flex-wrap">
              {report.description && <span>{report.description}</span>}
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  <Filter className="h-2.5 w-2.5 mr-1" /> {activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            <div className="data-table p-3">
              <ReportPreview
                primaryObject={report.primary_object}
                relatedObject={report.related_object || ""}
                columns={report.columns}
                groupRows={report.group_rows}
                groupColumns={report.group_columns}
                filters={activeFilters}
                chartType={chartType}
                displayOptions={displayOptions}
              />
            </div>
          </div>

          {/* Bottom toggles */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-6 bg-card shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Row Counts</span>
              <Switch
                checked={displayOptions.show_row_counts}
                onCheckedChange={(v) => setDisplayOptions((p) => ({ ...p, show_row_counts: v }))}
                className="scale-75"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Subtotals</span>
              <Switch
                checked={displayOptions.show_subtotals}
                onCheckedChange={(v) => setDisplayOptions((p) => ({ ...p, show_subtotals: v }))}
                className="scale-75"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Grand Total</span>
              <Switch
                checked={displayOptions.show_grand_total}
                onCheckedChange={(v) => setDisplayOptions((p) => ({ ...p, show_grand_total: v }))}
                className="scale-75"
              />
            </div>
          </div>
        </div>

        {/* Right: Filters panel (toggled) */}
        {showFilters && (
          <div className="w-72 md:w-80 border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Filters
              </Label>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowFilters(false)}>
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>

            {report.filters.length > 0 && (
              <>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
                  Saved Filters
                </Label>
                {report.filters.map((filter, idx) => (
                  <div key={`saved-${idx}`} className="flex flex-col gap-1 p-1.5 bg-muted/30 rounded text-[11px] mb-2 opacity-80">
                    <div className="flex items-center gap-1">
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{getFieldLabel(filter.field)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>{filter.operator.replace("_", " ")}</span>
                      {filter.value && <span className="text-foreground font-medium">"{filter.value}"</span>}
                    </div>
                  </div>
                ))}
              </>
            )}

            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 mt-3 block">
              Additional Filters
            </Label>
            {tempFilters.map((filter, idx) => (
              <div key={`temp-${idx}`} className="mb-2">
                <FilterRow
                  filter={filter}
                  allFields={allFields}
                  fieldKeyFn={fieldKeyStr}
                  onChange={(patch) => updateTempFilter(idx, patch)}
                  onRemove={() => removeTempFilter(idx)}
                />
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addTempFilter} className="w-full gap-1 text-xs h-7">
              <Plus className="h-3 w-3" /> Add Filter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
