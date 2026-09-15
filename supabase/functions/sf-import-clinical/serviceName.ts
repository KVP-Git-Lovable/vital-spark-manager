// Pure helpers for deciding a procedure's service name, kept out of index.ts so
// they can be unit-tested (index.ts only runs under Deno).

export interface DiagnosisFields {
  Treatment__c?: string | null;
  Procedure_Type__c?: string | null;
  Service_Type__c?: string | null;
  Type_Of_Appointment__c?: string | null;
  Visit_type__c?: string | null;
  Appointment__c?: string | null;
}

/** Shown when Salesforce records no treatment or procedure type at all. */
export const NO_SERVICE_RECORDED = "Consultation";

/**
 * What the procedure is FOR.
 *
 * Deliberately does NOT fall back to Type_Of_Appointment__c. That is a
 * visit-type picklist ("Walk-In", "Online"), not a service, and using it put
 * "Walk-In" in the Service column of every visit that was synced before its
 * treatment had been recorded in Salesforce. The field is stored verbatim in
 * review_notes, so leaving it out here loses nothing.
 */
export function procedureServiceName(
  d: DiagnosisFields,
  fromBilling?: string | null,
  fromAppointment?: string | null,
): string {
  const treatment = d.Treatment__c ? String(d.Treatment__c).replace(/;/g, ", ").trim() : "";
  return (
    treatment ||
    (d.Procedure_Type__c || "").trim() ||
    (d.Service_Type__c || "").trim() ||
    (fromBilling || "").trim() ||
    (fromAppointment || "").trim() ||
    NO_SERVICE_RECORDED
  );
}

/**
 * Is this stored service name one we are still waiting on - i.e. safe to
 * overwrite on a re-sync?
 *
 * True for an empty value, for the "Consultation" placeholder, and for the
 * visit type an older import wrote. Anything else is a real service, whether it
 * was imported or typed into the app, and must never be overwritten.
 */
export function awaitingRealService(current: string | null | undefined, d: DiagnosisFields): boolean {
  const v = (current || "").trim().toLowerCase();
  if (!v) return true;
  if (v === NO_SERVICE_RECORDED.toLowerCase()) return true;
  return [d.Type_Of_Appointment__c, d.Visit_type__c]
    .filter(Boolean)
    .map((x) => String(x).trim().toLowerCase())
    .includes(v);
}
