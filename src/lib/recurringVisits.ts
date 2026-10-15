/**
 * Editing the visits a recurring course books.
 *
 * The dates are a fixed-length list with gaps in it - a doctor fills visit 1
 * and visit 3 and leaves visit 2 for later - and each has its own
 * investigation beside it, held in a second list at the same index. Anything
 * that moves one list has to move the other in the same breath, or visit 3's
 * investigation slides onto visit 1's appointment. reservedVisits.ts pairs
 * them before dropping blanks for exactly this reason; these keep the pairing
 * while the doctor is still editing.
 *
 * The date is stored the way <input type="datetime-local"> holds it,
 * "YYYY-MM-DDTHH:mm", because that is what the save already reads. Splitting
 * it lets the date and the clock be separate controls - a date box and a
 * 12-hour picker - without changing what is stored.
 */

export interface VisitLists {
  dates: string[];
  investigations: string[];
}

/** "2026-10-21T14:30" -> { date: "2026-10-21", time: "14:30" } */
export function splitVisitDateTime(value: string | null | undefined): { date: string; time: string } {
  const [date = "", rest = ""] = String(value ?? "").split("T");
  // Seconds are dropped: the picker works in minutes and nothing books to the
  // second, but a stored value may carry them.
  const time = rest.slice(0, 5);
  return { date, time };
}

/**
 * The two halves back into one value.
 *
 * No date means no visit, whatever the clock says - a time on its own would
 * save as an unparseable date. A date with no time defaults to 09:00 rather
 * than midnight, which is nobody's appointment.
 */
export function joinVisitDateTime(date: string, time: string): string {
  const day = (date ?? "").trim();
  if (!day) return "";
  const clock = (time ?? "").trim() || "09:00";
  return `${day}T${clock}`;
}

/** Empty one visit, leaving the row in place to be filled in later. */
export function clearVisitAt({ dates, investigations }: VisitLists, index: number): VisitLists {
  const nextDates = [...dates];
  const nextInvestigations = [...investigations];
  nextDates[index] = "";
  nextInvestigations[index] = "";
  return { dates: nextDates, investigations: nextInvestigations };
}

/**
 * Take one visit out of the course entirely.
 *
 * Both lists are spliced at the same index so everything below keeps the
 * investigation it was written with. The investigations list can be shorter
 * than the dates list - it is only as long as the boxes somebody has typed in
 * - so it is padded first, or a splice at the end would silently do nothing.
 */
export function removeVisitAt({ dates, investigations }: VisitLists, index: number): VisitLists {
  const padded = [...investigations];
  while (padded.length < dates.length) padded.push("");
  const nextDates = [...dates];
  nextDates.splice(index, 1);
  padded.splice(index, 1);
  return { dates: nextDates, investigations: padded };
}
