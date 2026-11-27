import type { ReportSummaryCard } from "@/lib/reportsCatalog";

/**
 * Who consulted once and never came back, and how often an appointment
 * becomes a procedure.
 *
 * The arithmetic is here rather than in the catalogue entry so the figures
 * the clinic will act on can be proved. The rows and the clinic-wide totals
 * both come from one database function, clinic_retention_conversion - see
 * supabase/migrations/20261127090000_retention_and_conversion_report.sql for
 * what counts as a consultation and why first-time patients only.
 */

export interface RetentionTotals {
  new_consult_patients: number;
  never_returned: number;
  never_returned_no_procedure: number;
  patients_on_file: number;
  patients_attended: number;
  patients_with_procedure: number;
  appointments: number;
  appointments_with_procedure: number;
  procedures: number;
  procedures_unlinked: number;
  window_appointments: number;
  window_appointments_no_service: number;
}

export interface RetentionRow {
  patient_id: string;
  patient_name: string | null;
  phone: string | null;
  consult_date: string | null;
  doctor: string | null;
  service: string | null;
  had_procedure: boolean;
  returned: boolean;
  days_since: number | null;
  totals?: RetentionTotals | null;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A share, written for a tile.
 *
 * Guarded, because a window with no first-time consultations is a real
 * answer - a quiet month, a clinic just opened - and "NaN%" on a report that
 * goes to a doctor is not.
 */
export function share(part: number, whole: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** The totals ride on every row; any row will do, and none means zero. */
export function retentionTotals(rows: RetentionRow[]): RetentionTotals {
  const raw = (rows.find((r) => r?.totals)?.totals ?? {}) as Partial<RetentionTotals>;
  return {
    new_consult_patients: num(raw.new_consult_patients),
    never_returned: num(raw.never_returned),
    never_returned_no_procedure: num(raw.never_returned_no_procedure),
    patients_on_file: num(raw.patients_on_file),
    patients_attended: num(raw.patients_attended),
    patients_with_procedure: num(raw.patients_with_procedure),
    appointments: num(raw.appointments),
    appointments_with_procedure: num(raw.appointments_with_procedure),
    procedures: num(raw.procedures),
    procedures_unlinked: num(raw.procedures_unlinked),
    window_appointments: num(raw.window_appointments),
    window_appointments_no_service: num(raw.window_appointments_no_service),
  };
}

/** Of the ones who never came back, how many had been treated that day. */
export function treatedOnceThenGone(rows: RetentionRow[]): number {
  return rows.filter((r) => !r.returned && r.had_procedure).length;
}

const count = (n: number): string => n.toLocaleString("en-IN");

/**
 * The cards above the table.
 *
 * Every figure is given with its denominator. A conversion rate without one
 * is the kind of number that gets repeated in a meeting and means nothing:
 * three quarters of patients who attended have had a procedure, but only just
 * over half of everybody on file, and both are true.
 */
export function retentionCards(rows: RetentionRow[]): ReportSummaryCard[] {
  const t = retentionTotals(rows);
  const gone = t.never_returned;
  const treatedGone = treatedOnceThenGone(rows);

  return [
    {
      label: "First consultations",
      value: count(t.new_consult_patients),
      hint: "new patients whose first visit was a consultation",
    },
    {
      label: "Never came back",
      value: count(gone),
      hint: `${share(gone, t.new_consult_patients)} of them — no appointment since`,
    },
    {
      label: "Treated once, then gone",
      value: count(treatedGone),
      hint: "had a procedure that day and still did not return",
    },
    {
      label: "Consulted, nothing done, gone",
      value: count(t.never_returned_no_procedure),
      hint: "no procedure that day either",
    },
    {
      label: "Patients who ever had a procedure",
      value: count(t.patients_with_procedure),
      hint: `${share(t.patients_with_procedure, t.patients_attended)} of the ${count(t.patients_attended)} who attended · ${share(t.patients_with_procedure, t.patients_on_file)} of all ${count(t.patients_on_file)} on file`,
    },
    {
      label: "Appointments that led to a procedure",
      value: share(t.appointments_with_procedure, t.appointments),
      hint: `${count(t.appointments_with_procedure)} of ${count(t.appointments)} — a floor, see note below`,
    },
  ];
}

/**
 * The sentence under the title, and the one on the PDF.
 *
 * Two in five procedure records carry no appointment, so the appointment-level
 * rate is a floor rather than the truth. That belongs on the report itself:
 * a caveat kept in somebody's head is one the next reader does not get.
 */
export function conversionCaveat(rows: RetentionRow[]): string {
  const t = retentionTotals(rows);
  if (t.procedures <= 0 || t.procedures_unlinked <= 0) return "";
  return (
    `${count(t.procedures_unlinked)} of ${count(t.procedures)} procedure records ` +
    `(${share(t.procedures_unlinked, t.procedures)}) carry no appointment link, so the ` +
    `appointment-to-procedure rate is a floor, not the true figure. The patient figures ` +
    `do not depend on that link.`
  );
}

/**
 * The caveat that matters more than the figures.
 *
 * A consultation is recognised by the service written on the appointment,
 * and that field has been left blank on a growing share of bookings - none
 * in August, four fifths of October, almost all of November. Where it is
 * blank, nothing can be recognised, so a recent month shows a fall in new
 * patients that is really a fall in record-keeping. Printed, because a reader
 * who does not know this will read the last two months as a collapse in
 * business.
 */
export function recordingCaveat(rows: RetentionRow[]): string {
  const t = retentionTotals(rows);
  if (t.window_appointments <= 0 || t.window_appointments_no_service <= 0) return "";
  return (
    `${count(t.window_appointments_no_service)} of ${count(t.window_appointments)} appointments ` +
    `(${share(t.window_appointments_no_service, t.window_appointments)}) in this window have no ` +
    `service recorded. A consultation is recognised by that field, so months where it is left ` +
    `blank are undercounted here - check the trend before reading a fall as lost business.`
  );
}

/** Lost first-timers by month, so a trend is visible rather than one number. */
export function lapsedByMonth(rows: RetentionRow[]): { label: string; value: number }[] {
  const months = new Map<string, number>();
  for (const r of rows) {
    if (r.returned || !r.consult_date) continue;
    const key = String(r.consult_date).slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + 1);
  }
  return [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      const [y, m] = key.split("-");
      const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short" });
      return { label: `${name} ${y}`, value };
    });
}
