/**
 * Which day a clinic note is about.
 *
 * The notebook was a flat list, newest first, and the clinic writes rota notes
 * into it - "18th Dec (Friday) - Vindhya ma'am 10:30am - 1:30pm only". The day
 * it is ABOUT lived only in the prose; the only date the database held was the
 * moment somebody typed it, and seventeen notes about three different months
 * were all typed across two afternoons. So a list was the only thing that
 * could be shown, and it grew until nobody could find the day they wanted.
 *
 * A note now carries its own date. For the notes written before that column
 * existed, this reads the date back out of the prose - and checks its answer
 * against the weekday the writer put in brackets, which is a free second
 * opinion on every single one. A note that fails that check keeps no date at
 * all rather than being filed under a guess.
 */

export interface NoteDateRange {
  /** yyyy-MM-dd, the day the note is about. */
  start: string;
  /** yyyy-MM-dd; equal to start unless the note spans days. */
  end: string;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const monthIndex = (word: string): number =>
  MONTHS.findIndex((m) => m.startsWith(word.toLowerCase().slice(0, 3)) && word.length >= 3);

const iso = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Midday, so no offset can tip a date onto its neighbour. */
const at = (y: number, m: number, d: number): Date => new Date(y, m, d, 12);

/** A yyyy-MM-dd as a Date the calendar can select, at midday for the same reason. */
export const dayFromISO = (isoDate: string): Date => {
  const [y, m, d] = (isoDate ?? "").split("-").map(Number);
  return at(y || 1970, (m || 1) - 1, d || 1);
};

/** A Date back to yyyy-MM-dd, by its own calendar day rather than UTC's. */
export const isoFromDay = (date: Date): string =>
  iso(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The year nobody wrote down.
 *
 * The notes say "1st Jan" with no year, typed in November. Taking the typing
 * year literally would file it eleven months in the past; a note is almost
 * always about the near future, so the nearest occurrence forward is the
 * reading that matches what the clinic meant - and the weekday check below
 * catches it when it does not.
 */
function yearFor(month: number, day: number, typedOn: Date): number {
  const sameYear = at(typedOn.getFullYear(), month, day);
  const monthsBefore = (typedOn.getTime() - sameYear.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsBefore > 6 ? typedOn.getFullYear() + 1 : typedOn.getFullYear();
}

/**
 * The date at the head of a note, or null.
 *
 * Handles the shapes the clinic actually writes:
 *   "18th Dec (Friday) - …"                    one day
 *   "26th - 28th Dec (Saturday) - …"           a run of days
 *   "31st Dec and 1st Jan (Thursday and Friday) - …"  two days, two months
 *
 * The weekday in brackets is treated as an assertion: if the date worked out
 * here does not fall on the weekday named, null comes back. Being wrong about
 * which day a doctor is away is worse than leaving the note undated.
 */
export function parseNoteDate(body: string, typedOnISO: string): NoteDateRange | null {
  const head = (body ?? "").split("\n")[0] ?? "";
  const typedOn = new Date(typedOnISO);
  if (Number.isNaN(typedOn.getTime())) return null;

  // Every "<day><ordinal suffix>" with the month that follows it, if any.
  const dayMonth = /(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:(?:-|–|to|and|&)\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*)?([A-Za-z]{3,9})/g;
  const found: { month: number; day: number }[] = [];
  let lastEnd = -1;
  for (const m of head.matchAll(dayMonth)) {
    const month = monthIndex(m[3]);
    if (month < 0) continue;
    /* Only the dates at the head of the line are the note's subject, and they
       run together: "26th - 28th Dec", "31st Dec and 1st Jan". A date further
       along is part of the sentence - "on leave, back 5th Jan" must not
       stretch the note across five weeks of the calendar. */
    if (found.length && (m.index ?? 0) - lastEnd > 8) break;
    const first = Number(m[1]);
    const second = m[2] ? Number(m[2]) : null;
    if (first >= 1 && first <= 31) found.push({ month, day: first });
    if (second !== null && second >= 1 && second <= 31) found.push({ month, day: second });
    lastEnd = (m.index ?? 0) + m[0].length;
  }
  if (found.length === 0) return null;

  const dated = found.map((f) => {
    const year = yearFor(f.month, f.day, typedOn);
    return { ...f, year, date: at(year, f.month, f.day) };
  });
  // "31st Dec and 1st Jan" crosses a year: the second must not be read as
  // eleven months before the first.
  for (let i = 1; i < dated.length; i += 1) {
    if (dated[i].date.getTime() < dated[i - 1].date.getTime()) {
      dated[i].year += 1;
      dated[i].date = at(dated[i].year, dated[i].month, dated[i].day);
    }
  }
  for (const d of dated) {
    if (d.date.getDate() !== d.day || d.date.getMonth() !== d.month) return null; // 31 Nov
  }

  // The weekday the writer put in brackets, checked against the answer.
  const named = [...head.matchAll(/\b(sun|mon|tues?|wednes|thurs?|fri|satur)day\b/gi)]
    .map((w) => WEEKDAYS.findIndex((d) => d.startsWith(w[0].toLowerCase().slice(0, 3))));
  if (named.length) {
    const ok = named.every((want, i) => {
      const against = dated[Math.min(i, dated.length - 1)];
      return dated.some((d) => d.date.getDay() === want) || against.date.getDay() === want;
    });
    if (!ok) return null;
  }

  const first = dated[0];
  const last = dated[dated.length - 1];
  return { start: iso(first.year, first.month, first.day), end: iso(last.year, last.month, last.day) };
}

/** Every yyyy-MM-dd a range touches, so a note spanning days marks each one. */
export function datesInRange(range: NoteDateRange): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = range.start.split("-").map(Number);
  const [ye, me, de] = range.end.split("-").map(Number);
  const cursor = at(ys, ms - 1, ds);
  const end = at(ye, me - 1, de);
  // A malformed or reversed range yields its start and nothing else, rather
  // than looping.
  if (end.getTime() < cursor.getTime()) return [range.start];
  for (let guard = 0; guard < 400 && cursor.getTime() <= end.getTime(); guard += 1) {
    out.push(iso(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Does this note cover that day? */
export function noteCoversDate(
  note: { note_date?: string | null; note_end_date?: string | null },
  dateISO: string,
): boolean {
  if (!note.note_date) return false;
  const end = note.note_end_date || note.note_date;
  return note.note_date <= dateISO && dateISO <= end;
}

/** Every day that has at least one note, for the dots on the calendar. */
export function datesWithNotes(
  notes: { note_date?: string | null; note_end_date?: string | null }[],
): Set<string> {
  const out = new Set<string>();
  for (const n of notes) {
    if (!n.note_date) continue;
    for (const d of datesInRange({ start: n.note_date, end: n.note_end_date || n.note_date })) out.add(d);
  }
  return out;
}

/** "18 Dec 2026", or "26–28 Dec 2026" when it runs across days. */
export function noteDateLabel(startISO?: string | null, endISO?: string | null): string {
  if (!startISO) return "";
  const show = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return { d, mon: MONTHS[m - 1].slice(0, 3).replace(/^./, (c) => c.toUpperCase()), y };
  };
  const a = show(startISO);
  if (!endISO || endISO === startISO) return `${a.d} ${a.mon} ${a.y}`;
  const b = show(endISO);
  if (a.mon === b.mon && a.y === b.y) return `${a.d}–${b.d} ${a.mon} ${a.y}`;
  return `${a.d} ${a.mon}${a.y === b.y ? "" : ` ${a.y}`} – ${b.d} ${b.mon} ${b.y}`;
}
