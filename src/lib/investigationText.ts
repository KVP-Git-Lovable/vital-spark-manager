/**
 * What the "Investigation" column shows, for one appointment.
 *
 * There is no `investigation` column in the database. The label sits over
 * `appointments.reason_for_consultation`, which the Salesforce importer fills
 * from `Investigation__c` (see cleanInvestigationText in
 * supabase/functions/sf-import-clinical/consultation.ts).
 *
 * The resolved `service` is the fallback rather than the primary, because on
 * imported records it usually collapses to "Consultation" and hides what was
 * actually done - which is the whole reason the column was relabelled.
 *
 * One function rather than the expression written out at each call site: the
 * list and the printout disagreeing about what a row says is exactly the bug
 * this replaced.
 */

export interface InvestigationRow {
  reason_for_consultation?: string | null;
  service?: string | null;
}

export function investigationText(row: InvestigationRow | null | undefined, fallback = ""): string {
  // Trimmed, so a whitespace-only imported value falls through to the service
  // name instead of rendering an empty cell.
  const reason = String(row?.reason_for_consultation ?? "").trim();
  if (reason) return reason;
  const service = String(row?.service ?? "").trim();
  if (service) return service;
  return fallback;
}
