import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { getObjectByKey, type ReportFilter, type ReportField } from "@/lib/reportObjects";

interface Props {
  filter: ReportFilter;
  allFields: (ReportField & { objectKey: string; prefix: string })[];
  fieldKeyFn: (f: { objectKey: string; key: string }) => string;
  onChange: (patch: Partial<ReportFilter>) => void;
  onRemove: () => void;
  lockField?: boolean;
}

export function FilterRow({ filter, allFields, fieldKeyFn, onChange, onRemove, lockField }: Props) {
  const [distinctValues, setDistinctValues] = useState<string[]>([]);

  useEffect(() => {
    const fetchDistinct = async () => {
      const [objKey, fieldKey] = filter.field.split(".");
      const obj = getObjectByKey(objKey);
      if (!obj) return;
      const field = obj.fields.find((f) => f.key === fieldKey);
      if (!field || field.type !== "text") {
        setDistinctValues([]);
        return;
      }
      try {
        const { data } = await supabase
          .from(obj.table as any)
          .select(fieldKey)
          .not(fieldKey, "is", null)
          .limit(500);
        if (data) {
          const unique = [...new Set(data.map((r: any) => String(r[fieldKey])))].filter(Boolean).sort();
          setDistinctValues(unique.length <= 30 ? unique : []);
        }
      } catch {
        setDistinctValues([]);
      }
    };
    fetchDistinct();
  }, [filter.field]);

  const operators = [
    { key: "equals", label: "Equals" },
    { key: "not_equals", label: "Not Equals" },
    { key: "contains", label: "Contains" },
    { key: "gt", label: ">" },
    { key: "lt", label: "<" },
    { key: "gte", label: "≥" },
    { key: "lte", label: "≤" },
    { key: "is_null", label: "Is Empty" },
    { key: "is_not_null", label: "Not Empty" },
  ];

  const showDropdown = distinctValues.length > 0 && ["equals", "not_equals"].includes(filter.operator);

  return (
    <div className="flex flex-col gap-1 p-1.5 bg-muted/30 rounded text-[11px]">
      <div className="flex gap-1 items-center">
        {lockField ? (
          <div className="flex-1 truncate font-medium px-1 py-0.5 rounded bg-background border border-border/50">
            {(() => {
              const f = allFields.find((af) => fieldKeyFn(af) === filter.field);
              return f ? `${f.prefix}.${f.label}` : filter.field;
            })()}
          </div>
        ) : (
        <Select value={filter.field} onValueChange={(v) => onChange({ field: v })}>
          <SelectTrigger className="h-6 text-[11px] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allFields.map((f) => (
              <SelectItem key={fieldKeyFn(f)} value={fieldKeyFn(f)} className="text-xs">
                {f.prefix}.{f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}
        {!lockField && (
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={onRemove}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
      <div className="flex gap-1">
        <Select value={filter.operator} onValueChange={(v: any) => onChange({ operator: v })}>
          <SelectTrigger className="h-6 text-[11px] w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.key} value={op.key} className="text-xs">{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!["is_null", "is_not_null"].includes(filter.operator) && (
          showDropdown ? (
            <Select value={filter.value} onValueChange={(v) => onChange({ value: v })}>
              <SelectTrigger className="h-6 text-[11px] flex-1">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {distinctValues.map((v) => (
                  <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={filter.value}
              onChange={(e) => onChange({ value: e.target.value })}
              className="h-6 text-[11px] flex-1"
              placeholder="Value"
            />
          )
        )}
      </div>
    </div>
  );
}
