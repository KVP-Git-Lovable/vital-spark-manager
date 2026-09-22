/**
 * Which appointment does a bill belong to?
 *
 * The Appointments list reads its Bill Amount column strictly by
 * `invoices.appointment_id` (Appointments.tsx, `.in("appointment_id", ids)`), so
 * a bill that carries no link renders as a dash - even though the invoice is
 * present and counts in every total on Reports and the Dashboard. That is what
 * the clinic saw on 21 September: a day of visits reading as unbilled while
 * Reports gave the day's takings correctly.
 *
 * The link comes from Billing__c.Appointment__c, which Salesforce leaves blank
 * on some bills. Nothing ever fills it in afterwards, because the importer only
 * sets appointment_id at insert time.
 *
 * So when Salesforce names no appointment, fall back to the patient's own
 * appointments on the day the bill was raised - but only when there is exactly
 * one, because with two visits in a day there is no way to tell which was
 * billed, and a wrong link is worse than a dash. A wrong link would also feed
 * the visit rule, which counts a past appointment carrying a paid invoice as an
 * attended visit.
 *
 * Days are compared in the clinic's own timezone. The stored timestamps are UTC,
 * and IST runs 5.5 hours ahead, so a late-evening appointment compared on UTC
 * days would fall on the day before and miss its bill.
 */

/** The clinic's timezone - the one both dates are judged in. */
export const CLINIC_TIME_ZONE = "Asia/Kolkata";

/** The calendar day of an instant in the clinic's timezone, as YYYY-MM-DD. */
export function clinicDay(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA renders ISO-ordered dates, so this is YYYY-MM-DD without hand-rolling
  // the padding.
  return d.toLocaleDateString("en-CA", { timeZone: CLINIC_TIME_ZONE });
}

/**
 * The local appointment id to store on a bill, or null to leave it unlinked.
 *
 * `appointmentIdsBySfId` and `appointmentStartsBySfId` are the maps the import
 * loop already builds for the patient being synced, so this adds no queries.
 */
export function appointmentForBill(
  billAppointmentSfId: string | null | undefined,
  billedOn: string | null | undefined,
  appointmentIdsBySfId: Map<string, string>,
  appointmentStartsBySfId: Map<string, string>,
): string | null {
  // Salesforce's own link always wins, and is never second-guessed.
  const named = billAppointmentSfId ? String(billAppointmentSfId).trim() : "";
  if (named) return appointmentIdsBySfId.get(named) ?? null;

  const day = clinicDay(billedOn);
  if (!day) return null;

  const sameDay: string[] = [];
  for (const [sfId, start] of appointmentStartsBySfId) {
    if (clinicDay(start) !== day) continue;
    // Only appointments that actually exist here can be linked to.
    if (!appointmentIdsBySfId.has(sfId)) continue;
    sameDay.push(sfId);
    // Two is already too many - stop looking.
    if (sameDay.length > 1) return null;
  }

  return sameDay.length === 1 ? appointmentIdsBySfId.get(sameDay[0]) ?? null : null;
}
