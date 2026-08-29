import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Trash2,
  ChevronUp,
  ChevronDown,
  Table as TableIcon,
  BarChart3,
  PieChart,
  LineChart,
  Hash,
  Settings2,
} from "lucide-react";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { CHART_TYPES, isValidFieldKey, type SavedReport } from "@/lib/reportObjects";

export type ComponentWidth = "small" | "medium" | "large";
export type ComponentHeight = "short" | "medium" | "tall";

export interface DashboardComponent {
  id: string;
  dashboard_id: string;
  report_id: string;
  title: string | null;
  chart_type: string | null;
  width: ComponentWidth;
  height: ComponentHeight;
  position: number;
  report?: SavedReport | null;
}

export const WIDTH_CLASS: Record<ComponentWidth, string> = {
  small: "md:col-span-2",
  medium: "md:col-span-3",
  large: "md:col-span-6",
};

export const HEIGHT_PX: Record<ComponentHeight, number> = {
  short: 260,
  medium: 360,
  tall: 520,
};

const chartIcons: Record<string, any> = {
  table: TableIcon,
  bar: BarChart3,
  doughnut: PieChart,
  line: LineChart,
  number: Hash,
};

interface Props {
  component: DashboardComponent;
  editing: boolean;
  canEdit: boolean;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onConfigure: (component: DashboardComponent) => void;
}

export function DashboardComponentCard({
  component,
  editing,
  canEdit,
  onRemove,
  onMove,
  onConfigure,
}: Props) {
  const navigate = useNavigate();
  const report = component.report;

  if (!report) {
    return (
      <div className={`data-table p-4 text-sm text-muted-foreground ${WIDTH_CLASS[component.width]}`}>
        This report is no longer available.
        {canEdit && (
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => onRemove(component.id)}>
            Remove
          </Button>
        )}
      </div>
    );
  }

  const chartType = component.chart_type || report.chart_type;
  const ChartIcon = chartIcons[chartType] || TableIcon;
  const chartLabel = CHART_TYPES.find((c) => c.key === chartType)?.label || chartType;

  const allowed = [report.primary_object, report.related_object];
  const safeColumns = report.columns.filter((fk) => isValidFieldKey(fk, allowed));
  const safeGroupRows = report.group_rows.filter((fk) => isValidFieldKey(fk, allowed));
  const safeGroupCols = report.group_columns.filter((fk) => isValidFieldKey(fk, allowed));
  const safeFilters = report.filters.filter((f) => isValidFieldKey(f.field, allowed));

  const openFull = () => navigate(`/report-builder?view=${report.id}`);

  return (
    <div
      className={`data-table flex flex-col overflow-hidden ${WIDTH_CLASS[component.width]}`}
      style={{ height: HEIGHT_PX[component.height] }}
    >
      <div className="px-3 py-2 border-b border-border flex items-start gap-2 shrink-0 bg-card">
        <button onClick={openFull} className="flex-1 min-w-0 text-left group" title="Open full report">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-semibold text-sm truncate group-hover:text-primary">
              {component.title || report.name}
            </h3>
            <Badge variant="secondary" className="gap-1 text-[9px] h-4 px-1 shrink-0">
              <ChartIcon className="h-2.5 w-2.5" /> {chartLabel}
            </Badge>
          </div>
          {report.description && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{report.description}</p>
          )}
        </button>
        <div className="flex gap-0.5 shrink-0">
          {editing && canEdit && (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6" title="Move up" onClick={() => onMove(component.id, -1)}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" title="Move down" onClick={() => onMove(component.id, 1)}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" title="Component settings" onClick={() => onConfigure(component)}>
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                title="Remove from dashboard"
                onClick={() => onRemove(component.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Open full report" onClick={openFull}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <ReportPreview
          primaryObject={report.primary_object}
          relatedObject={report.related_object || ""}
          columns={safeColumns}
          groupRows={safeGroupRows}
          groupColumns={safeGroupCols}
          filters={safeFilters}
          chartType={chartType}
          displayOptions={report.display_options}
          compact
        />
      </div>
    </div>
  );
}
