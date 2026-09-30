/**
 * The line under a patient's name while a doctor writes: age and gender.
 *
 * Doctors asked for it on the prescription form - dosage, and much of what they
 * write, depends on both, and having to leave the form to look them up is how a
 * prescription gets written from memory.
 *
 * Age is worked out from the date of birth with patientAge, the same function
 * the patient list and the reports use, so no screen can disagree about how old
 * somebody is. Nothing is stored: this is read and shown.
 */

import { patientAge } from "@/lib/patientFields";

export interface PatientIdentity {
  date_of_birth?: string | null;
  gender?: string | null;
}

/** "34 yrs", "1 yr", "<1 yr", or "" when no date of birth is recorded. */
export function patientAgeLabel(dob: string | null | undefined): string {
  const age = patientAge(dob);
  if (age === null || age < 0) return "";
  if (age === 0) return "<1 yr";
  return age === 1 ? "1 yr" : `${age} yrs`;
}

/**
 * "34 yrs · Female", or whichever half is known, or "" when neither is.
 *
 * An empty string rather than a placeholder: a line that reads "— · —" tells a
 * doctor nothing and takes up the same space.
 */
export function patientIdentityLine(patient: PatientIdentity | null | undefined): string {
  const age = patientAgeLabel(patient?.date_of_birth);
  const gender = String(patient?.gender ?? "").trim();
  return [age, gender].filter(Boolean).join(" · ");
}
