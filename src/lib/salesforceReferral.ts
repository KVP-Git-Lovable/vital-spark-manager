/**
 * Finding the referring doctor Salesforce still holds.
 *
 * The migration brought the referral FLAG across and not the NAME: 152
 * patients read "Reference - other Dr" and not one says who. The clinic wants
 * those doctors for Diwali gifts, and the connector that could fetch them is
 * already wired up - what is missing is knowing which Salesforce field holds
 * the name.
 *
 * Nobody should guess that. sf-describe-patient-fields exists precisely
 * because "guessing at clinical field names is how the wrong column ends up in
 * a patient record". This narrows its long list to the plausible few and
 * guards the one that gets chosen, so the choice stays a human's.
 */

/** One field as sf-describe-patient-fields reports it. */
export interface SfField {
  name: string;
  filled: number;
  of: number;
  pct: number;
}

// Deliberately not "source": Patient_source__c is already imported and is the
// flag, not the name. Matching it here would bury the field actually wanted.
const LOOKS_LIKE_REFERRAL = /refer|referr|recommend|doctor|physician|consultant|\bdr\b|_dr_|rmp/i;

/**
 * The fields worth considering, most-filled first.
 *
 * A field that exists but is empty on every sampled row cannot be the one, so
 * the fill rate is what makes this list readable rather than just shorter.
 */
export function referralFieldCandidates(fields: SfField[] | null | undefined): SfField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && typeof f.name === "string" && LOOKS_LIKE_REFERRAL.test(f.name))
    .slice()
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
}

/**
 * Is this safe to put in a SOQL SELECT?
 *
 * The field name reaches the query as text. Salesforce API names are letters,
 * digits and underscores and nothing else, so anything else is either a typo
 * or an attempt to add a clause of its own, and both should be refused before
 * they reach the gateway.
 */
export function isSafeSoqlField(name: string | null | undefined): boolean {
  const value = String(name ?? "").trim();
  return value.length > 0 && value.length <= 80 && /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

/**
 * Is this value worth storing as a referring doctor?
 *
 * Salesforce writes a placeholder dash on fields nobody filled in - the lab
 * backfill rows carry "." for the same reason - and a bare "NA" says no more
 * than blank does. Storing one would turn "nobody recorded it" into "recorded
 * as nothing", which is worse: the report could no longer tell them apart.
 */
const EMPTY_PLACEHOLDERS = new Set(["", "-", "--", ".", "n/a", "na", "nil", "none", "null", "0"]);

export function usableReferrerName(value: unknown): string {
  const text = String(value ?? "").trim();
  if (EMPTY_PLACEHOLDERS.has(text.toLowerCase())) return "";
  // A lone punctuation mark is a placeholder whatever shape it takes.
  if (!/[A-Za-z]/.test(text)) return "";
  return text;
}
