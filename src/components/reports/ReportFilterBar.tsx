import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, X, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { ReportFilterDef } from "@/lib/reportsCatalog";

export interface FilterState {
  search: string;
  dateFrom?: Date;
  dateTo?: Date;
  selects: Record<string, string>; // filter key -> value ("" = all)
}

interface Props {
  filters: ReportFilterDef[];
  state: FilterState;
  onChange: (s: FilterState) => void;
  showSearch?: boolean;
  /**
   * Collapse the from/to range into one date picker, for accounts limited to
   * day-at-a-time reporting. The range is still what leaves this component - both
   * ends are just set to the same day.
   */
  singleDay?: boolean;
}

export function ReportFilterBar({ filters, state, onChange, showSearch = true, singleDay = false }: Props) {
  const dateRange = filters.find((f) => f.type === "dateRange");
  const selects = filters.filter((f) => f.type === "select");

  const hasActive =
    !!state.search ||
    !!state.dateFrom ||
    !!state.dateTo ||
    Object.values(state.selects).some((v) => v && v !== "all");

  // A limited account always has a day selected, so clearing must not drop back to
  // "any date" - that would be the whole restriction undone by one button.
  const clear = () =>
    onChange(
      singleDay
        ? { search: "", dateFrom: state.dateFrom, dateTo: state.dateTo, selects: {} }
        : { search: "", dateFrom: undefined, dateTo: undefined, selects: {} },
    );

  return (
    <div className="data-table p-3 mb-4">
      <div className="flex flex-wrap items-end gap-2">
        {showSearch && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={state.search}
                onChange={(e) => onChange({ ...state, search: e.target.value })}
                placeholder="Search…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
        )}

        {dateRange && (
          singleDay ? (
            <DateField
              label={dateRange.label}
              value={state.dateFrom}
              clearable={false}
              onChange={(d) => {
                if (!d) return;
                onChange({ ...state, dateFrom: d, dateTo: d });
              }}
            />
          ) : (
            <>
              <DateField
                label={`${dateRange.label} from`}
                value={state.dateFrom}
                onChange={(d) => onChange({ ...state, dateFrom: d })}
              />
              <DateField
                label={`${dateRange.label} to`}
                value={state.dateTo}
                onChange={(d) => onChange({ ...state, dateTo: d })}
              />
            </>
          )
        )}

        {selects.map((f) => (
          <div key={f.key} className="min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</label>
            <Select
              value={state.selects[f.key] || "all"}
              onValueChange={(v) =>
                onChange({ ...state, selects: { ...state.selects, [f.key]: v === "all" ? "" : v } })
              }
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All</SelectItem>
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {hasActive && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clear}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function DateField({ label, value, onChange, clearable = true }: { label: string; value?: Date; onChange: (d?: Date) => void; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-[140px]">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 w-full justify-start text-xs font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {value ? format(value, "dd MMM yyyy") : "Any"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => { onChange(d ?? undefined); setOpen(false); }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          {value && clearable && (
            <div className="p-2 border-t">
              <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => { onChange(undefined); setOpen(false); }}>
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}