import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { clearsWholeTime, hourAdvances } from "@/lib/timeSegments";

interface TimePicker12hProps {
  /** 24hr "HH:mm" string (e.g. "14:30"), same shape <input type="time"> uses. */
  value: string;
  /** Called with a 24hr "HH:mm" string - callers don't need to change anything else. */
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
  /** Smaller footprint for dense contexts like a table row. */
  compact?: boolean;
}

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

/** Clamps into [1,12] - never wraps, so typing can't silently pick another hour. */
function clampHour(h: number) {
  if (Number.isNaN(h)) return 12;
  return Math.min(12, Math.max(1, h));
}

/** Clamps into [0,59]. */
function clampMinute(m: number) {
  if (Number.isNaN(m)) return 0;
  return Math.min(59, Math.max(0, m));
}

/**
 * <input type="time"> renders in whatever 24hr/12hr format the visitor's
 * OS/browser locale prefers - there's no HTML-level way to force 12hr with
 * an explicit AM/PM selector. This is a same-footprint replacement: plain
 * number spinners for hour/minute (native up/down arrows, type directly,
 * no popup list) plus a clearly-a-button two-state AM/PM toggle. Same
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

  // While typing, the box holds the raw digits the user entered so mid-typing
  // states ("1" on the way to "10") aren't rewritten under the cursor.
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);

  const update = (patch: Partial<{ hour12: number; minute: number; period: "AM" | "PM" }>) => {
    onChange(to24h(patch.hour12 ?? hour12, patch.minute ?? minute, patch.period ?? period));
  };

  const digits = (s: string) => s.replace(/\D/g, "").slice(0, 2);

  // The two boxes are halves of one time. What each half is worth, when the
  // whole time is really being cleared, and when the hour is finished, are in
  // timeSegments.ts - this component only carries the focus and the drafts.
  const minuteRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  // The first digit typed after arriving in a box replaces what is there,
  // rather than being added to it. Selecting the text on focus was meant to
  // do that, but a click puts the caret back on mouse-up and the selection is
  // gone - so a 1 typed into an hour already reading 1 made 11, which is a
  // finished hour, and the caret left for the minutes while the doctor was
  // still typing 12. This does not depend on the selection surviving.
  const hourFresh = useRef(false);
  const minuteFresh = useRef(false);

  /** What the other box is showing right now, as digits. */
  const shownHour = hourDraft ?? (isSet ? String(hour12) : "");
  const shownMinute = minuteDraft ?? (isSet ? String(minute).padStart(2, "0") : "");

  const onHourInput = (raw: string) => {
    const d = digits(raw);
    setHourDraft(d);
    // Emptying one box is a half being retyped, not the time being removed.
    // Clearing it used to take the minutes with it and leave a half-typed
    // value that crashed the appointment screen.
    if (clearsWholeTime(d, shownMinute)) {
      onChange("");
      return;
    }
    if (d === "") return;
    const n = Number(d);
    if (n >= 1 && n <= 12) update({ hour12: n });
    // A finished hour hands the caret to the minutes, so the time can be
    // typed straight through without reaching for the mouse.
    if (hourAdvances(d)) {
      minuteRef.current?.focus();
      minuteRef.current?.select();
    }
  };

  const onMinuteInput = (raw: string) => {
    const d = digits(raw);
    setMinuteDraft(d);
    if (clearsWholeTime(shownHour, d)) {
      onChange("");
      return;
    }
    if (d === "") return;
    const n = Number(d);
    if (n >= 0 && n <= 59) update({ minute: n });
  };

  return (
    <div
      // No overflow-hidden here. It used to have it, and when the control was
      // narrow - Start and End side by side inside a half-width column is
      // exactly narrow enough - the AM/PM toggle was the part pushed out, and
      // it was clipped away without a trace. The clinic reported PM as
      // missing; it had been rendered all along, just past the edge. Nothing
      // here may hide a control the user has to reach. The clock icon went
      // with it to buy back the width: every caller already labels the field
      // Start or End.
      className={cn(
        "flex w-full items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        // A floor wide enough for both digits and the AM/PM toggle. Without
        // one, a narrow caller squeezed the digits away to nothing - which is
        // what a table cell sized for reading "10:15 AM" did to it.
        compact ? "h-8 min-w-[7.5rem]" : "h-10 min-w-[8.5rem]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        aria-label="Hour"
        value={shownHour}
        placeholder="--"
        disabled={disabled}
        onChange={(e) => onHourInput(e.target.value)}
        onFocus={(e) => {
          hourFresh.current = true;
          e.currentTarget.select();
        }}
        onMouseUp={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (/^\d$/.test(e.key) && hourFresh.current) {
            e.preventDefault();
            hourFresh.current = false;
            onHourInput(e.key);
            return;
          }
          hourFresh.current = false;
        }}
        onBlur={() => {
          if (hourDraft && hourDraft !== "") {
            const clamped = clampHour(Number(hourDraft));
            update({ hour12: clamped });
          }
          // An empty draft falls back to the stored hour: leaving the field
          // half typed must not leave a time that is half a time.
          setHourDraft(null);
        }}
        className="w-7 shrink-0 bg-transparent text-center outline-none"
      />
      <span className="text-muted-foreground">:</span>
      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        aria-label="Minute"
        value={shownMinute}
        placeholder="--"
        disabled={disabled}
        onChange={(e) => onMinuteInput(e.target.value)}
        onFocus={(e) => {
          minuteFresh.current = true;
          e.currentTarget.select();
        }}
        onMouseUp={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Backspace in an empty minute box steps back to the hour, the way
          // a field made of segments is expected to behave.
          if (e.key === "Backspace" && shownMinute === "") {
            e.preventDefault();
            hourRef.current?.focus();
            hourRef.current?.select();
            return;
          }
          if (/^\d$/.test(e.key) && minuteFresh.current) {
            e.preventDefault();
            minuteFresh.current = false;
            onMinuteInput(e.key);
            return;
          }
          minuteFresh.current = false;
        }}
        onBlur={() => {
          if (minuteDraft && minuteDraft !== "") {
            const clamped = clampMinute(Number(minuteDraft));
            update({ minute: clamped });
          }
          setMinuteDraft(null);
        }}
        className="w-8 shrink-0 bg-transparent text-center outline-none"
      />

      {/* Two-state AM/PM toggle button, not text labels - the active side is filled. */}
      <div className={cn("ml-auto flex shrink-0 rounded border border-input text-[10px] font-semibold")}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => update({ period: "AM" })}
          className={cn(
            "rounded-l-[3px] px-1.5 py-0.5 transition-colors",
            period === "AM" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          AM
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => update({ period: "PM" })}
          className={cn(
            "rounded-r-[3px] border-l border-input px-1.5 py-0.5 transition-colors",
            period === "PM" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          PM
        </button>
      </div>
    </div>
  );
}

export default TimePicker12h;
