// Turning Salesforce's Sex__c / Email_ID__c / Date_of_birth__c into values this
// database will accept, kept out of index.ts so it can be unit-tested (index.ts
// only runs under Deno).
//
// The rule throughout: when a value cannot be recognised with confidence,
// return null and leave the column alone. A blank field is a visible gap
// somebody can fill in. A confidently wrong sex or birth date on a clinical
// record is worse, because nobody goes looking for it.

/** patients_gender_check: the only four values the column will take. */
export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

/**
 * Salesforce's Sex__c is free-ish text. Recognise the spellings a clinic
 * actually types and refuse the rest rather than guessing - an unrecognised
 * value is reported by the dry run so it can be mapped deliberately.
 */
export function normaliseSex(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (["m", "male", "man", "boy", "b", "mr"].includes(v)) return "Male";
  if (["f", "female", "woman", "girl", "g", "w", "mrs", "ms"].includes(v)) return "Female";
  if (["o", "other", "others", "transgender", "trans", "non-binary", "nonbinary"].includes(v)) return "Other";
  if (["prefer not to say", "not specified", "unspecified", "undisclosed"].includes(v)) return "Prefer not to say";
  return null;
}

/** Obvious filler that means "no email", not an address. */
const EMAIL_PLACEHOLDERS = new Set([
  "na", "n/a", "nil", "none", "no", "noemail", "no email", "not available", "-", "--", ".",
  "test@test.com", "abc@abc.com", "xyz@xyz.com", "a@a.com", "noemail@gmail.com",
  "no@email.com", "none@none.com", "na@na.com", "email@email.com", "sample@sample.com",
]);

/**
 * A usable address, or null.
 *
 * Deliberately strict about shape and about filler: Email_ID__c is filled for
 * ~97% of Salesforce patients, which on a clinic system nearly always means
 * somebody had to put *something* in a required box. Importing that filler would
 * turn a visibly empty field into a confidently wrong one, and it would go out
 * on appointment reminders.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v || EMAIL_PLACEHOLDERS.has(v)) return null;
  // One @, something either side, a dot in the domain, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v)) return null;
  const [local, domain] = v.split("@");
  if (local.length < 2) return null;
  // "aaa@bbb.com", "test@..." and friends - a local part of one repeated
  // character is filler, not a mailbox.
  if (/^(.)\1*$/.test(local)) return null;
  if (domain.startsWith("test.") || domain === "example.com") return null;
  return v;
}

/**
 * A plausible birth date as YYYY-MM-DD, or null.
 *
 * Salesforce date fields arrive ISO already; the work here is rejecting the
 * impossible ones rather than parsing. A date in the future or before 1900 is a
 * typo or a placeholder, and a birth date drives the age printed on every
 * prescription, so it does not get the benefit of the doubt.
 */
export function normaliseDob(raw: string | null | undefined, today: Date = new Date()): string | null {
  const v = String(raw ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, d));
  // Round-trips, so 2001-02-30 is rejected instead of rolling into March.
  if (when.getUTCFullYear() !== y || when.getUTCMonth() !== m - 1 || when.getUTCDate() !== d) return null;
  if (y < 1900) return null;
  if (when.getTime() > today.getTime()) return null;
  return v;
}
