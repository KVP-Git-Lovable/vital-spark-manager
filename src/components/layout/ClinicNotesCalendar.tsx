import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { dayFromISO, isoFromDay } from "@/lib/noteDates";

/**
 * The month, with a dot under every day that has a note.
 *
 * Split out of the panel so the panel stays readable, and so the dot - the
 * whole point of the thing - is one named class string rather than something
 * buried in a 300-line component.
 *
 * The dot is drawn with an ::after on the day button, which works because the
 * calendar's own cell is already positioned. On the selected day the button
 * turns primary, so the dot turns with it; without that it would vanish into
 * its own background on exactly the day being looked at.
 */
const DOT =
  "relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 " +
  "after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[''] " +
  "aria-selected:after:bg-primary-foreground";

export function ClinicNotesCalendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  markedDates,
  className,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  month: Date;
  onMonthChange: (date: Date) => void;
  /** yyyy-MM-dd of every day carrying at least one note. */
  markedDates: Set<string>;
  className?: string;
}) {
  const marked = [...markedDates].map(dayFromISO);

  return (
    <Calendar
      mode="single"
      selected={dayFromISO(selected)}
      month={month}
      onMonthChange={onMonthChange}
      // A day is never deselected here: the panel below always shows some
      // day, so a click that cleared the selection would empty it for no
      // reason the clinic asked for.
      onSelect={(date) => { if (date) onSelect(isoFromDay(date)); }}
      modifiers={{ hasNotes: marked }}
      modifiersClassNames={{ hasNotes: DOT }}
      className={cn("p-2 pointer-events-auto", className)}
    />
  );
}
