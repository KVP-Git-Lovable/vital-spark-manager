/**
 * A consultation is not a service, and should not be presented as one.
 *
 * The clinic's Service Master has no row called Consultation. The name got
 * onto 15,653 procedure_services rows and 24,514 procedures during the
 * Salesforce import, where it stands for "the patient was seen", not for
 * work done - so it filled the Services/Procedures panel with a service
 * nobody performed.
 *
 * It cannot simply be dropped. Of those service rows, 10,586 carry procedure
 * notes and 9,178 carry recommendations: the consultation line is where a
 * great deal of what the doctor wrote actually lives. So the label goes and
 * the writing stays, shown as the visit's own notes rather than a service.
 *
 * Matched exactly, not by prefix, and deliberately the same test as
 * isPlaceholderService in generate-prescription-pdf, so the screen and the
 * printed document agree about what counts. "Consultation fee" and
 * "Cosmetic Consultation" are real billed services and are left alone -
 * neither appears in procedure_services today, but naming the intent here
 * beats discovering it later.
 */
export function isConsultationService(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "consultation";
}

/**
 * Should the New Prescription form start with this in the service box?
 *
 * Separate from isConsultationService on purpose. That one is matched exactly
 * and mirrors isPlaceholderService in generate-prescription-pdf, so widening it
 * would make the screen and the printed document disagree about 15,653 rows -
 * and that edge function cannot be redeployed from here.
 *
 * This one is only ever asked whether to seed a form, and the appointment
 * column it reads is much messier than the bare word: alongside 28,507
 * "Consultation" there are 5,393 "New Consult", 3,176 "Old Consult", 2,927
 * "consult" and a tail of "Online consultation" and "Old Consult (Review)".
 * They all mean the same thing - the patient was seen - and none of them can
 * ever match the Service Master, so they just sit in the box as text nobody
 * chose.
 *
 * Checked against the Service Master before widening: its only consult rows are
 * the four per-doctor CONSULTATION entries and COSMETIC CONSULT, all genuinely
 * billed, and none is a bare or qualified bare consult. So a per-doctor
 * consultation still pre-fills and still auto-fills its price, and anything with
 * real work in it ("new consult+RF") is left alone.
 */
export function isPlaceholderVisitService(name: string | null | undefined): boolean {
  const bare = (name ?? "")
    .trim()
    .toLowerCase()
    // "Old Consult (Review)" - the qualifier in brackets says nothing extra.
    .replace(/\s*\([^)]*\)\s*$/, "")
    // Leading words that qualify the visit rather than name any work done.
    .replace(/^(new|old|re|repeat|online|review|follow[\s-]?up)\s+/g, "")
    .trim();

  return bare === "consult" || bare === "consultation";
}
