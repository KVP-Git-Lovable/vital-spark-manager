import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimePicker12hProps {
  /** 24hr "HH:mm" string (e.g. "14:30"), same shape <input type="time"> uses. */
  value: string;
  /** Called with a 24hr "HH:mm" string - callers don't need to change anything else. */
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
  /** Smaller triggers for dense contexts like a table row. */
  compact?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

function parse24h(value: string) {
  const [hStr, mStr] = (value || "").split(":");
  const h24 = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(h24) || Number.isNaN(minute)) return null;
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, minute, period };
}

function to24h(hour12: number, minute: number, period: "AM" | "PM") {
  const h24 = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * <input type="time"> renders in whatever 24hr/12hr format the visitor's
 * OS/browser locale prefers - there's no HTML-level way to force 12hr with
 * an explicit AM/PM selector. This is a drop-in replacement with the same
 * value/onChange contract (24hr "HH:mm" in, 24hr "HH:mm" out) so every
 * existing caller - including WhatsApp message building, which formats its
 * own Date independently of this input - needs no other changes.
 */
export function TimePicker12h({ value, onChange, className, disabled, compact }: TimePicker12hProps) {
  const parsed = parse24h(value);
  const isSet = !!parsed;
  const hour12 = parsed?.hour12 ?? 9;
  const minute = parsed?.minute ?? 0;
  const period = parsed?.period ?? "AM";

  const update = (patch: Partial<{ hour12: number; minute: number; period: "AM" | "PM" }>) => {
    onChange(to24h(patch.hour12 ?? hour12, patch.minute ?? minute, patch.period ?? period));
  };

  const triggerHeight = compact ? "h-8" : "h-10";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={isSet ? String(hour12) : undefined} onValueChange={(v) => update({ hour12: Number(v) })} disabled={disabled}>
        <SelectTrigger className={cn("w-[56px]", triggerHeight)}><SelectValue placeholder="--" /></SelectTrigger>
        <SelectContent className="max-h-60">
          {HOURS_12.map((h) => (
            <SelectItem key={h} value={String(h)}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={isSet ? String(minute) : undefined} onValueChange={(v) => update({ minute: Number(v) })} disabled={disabled}>
        <SelectTrigger className={cn("w-[64px]", triggerHeight)}><SelectValue placeholder="--" /></SelectTrigger>
        <SelectContent className="max-h-60">
          {MINUTES_60.map((m) => (
            <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={isSet ? period : undefined} onValueChange={(v) => update({ period: v as "AM" | "PM" })} disabled={disabled}>
        <SelectTrigger className={cn("w-[64px]", triggerHeight)}><SelectValue placeholder="--" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default TimePicker12h;
