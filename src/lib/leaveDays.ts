/**
 * How much leave an application is worth.
 *
 * The page worked this out inline as a date subtraction, which can only ever
 * produce whole days - so a half day could not be applied for at all. Staff
 * taking a morning off had to book the whole day or not book it.
 *
 * It lives here rather than in the page because it is the number a balance is
 * decremented by: it is worth being able to test it without rendering an
 * 800-line screen.
 */

/** Which half of the day is being taken. */
export type HalfSession = "first" | "second";

export const HALF_SESSIONS: { value: HalfSession; label: string }[] = [
  { value: "first", label: "First half" },
  { value: "second", label: "Second half" },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** "first half" / "second half", or "" for a whole day. */
export function halfSessionLabel(session?: HalfSession | string | null): string {
  return HALF_SESSIONS.find((s) => s.value === session)?.label.toLowerCase() ?? "";
}

/**
 * Midday, so that a timezone offset cannot tip a date onto its neighbour.
 *
 * The same reasoning as DateInput's own parser: `new Date("2026-12-02")` is
 * UTC midnight, which in a zone behind UTC is the 1st.
 */
function atMidday(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

/** Both dates set, and both the same day: the only shape a half day can take. */
export function canBeHalfDay(startISO: string, endISO: string): boolean {
  return !!startISO && startISO === endISO;
}

/**
 * The days to charge, which is what the balance is reduced by on approval.
 *
 * A session on a range of dates is ignored rather than honoured. The control
 * cannot produce one - it is only shown on a single date - but a stale value
 * left behind by someone changing the end date afterwards must not turn a
 * week off into half a day.
 */
export function leaveDays(startISO: string, endISO: string, session: HalfSession | null): number {
  if (canBeHalfDay(startISO, endISO) && session) return 0.5;
  const start = atMidday(startISO);
  const end = atMidday(endISO);
  if (!start || !end) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/**
 * The same number, written for somebody approving it.
 *
 * A bare "0.5" in a table leaves the approver to guess which half of the day
 * the person is away, which is the thing a rota actually needs.
 */
export function leaveDayLabel(days: number | string, session?: HalfSession | string | null): string {
  const n = Number(days);
  if (!Number.isFinite(n)) return String(days ?? "");
  const half = halfSessionLabel(session);
  return half ? `${n} — ${half}` : String(n);
}
