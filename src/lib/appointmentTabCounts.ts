/**
 * The number beside an appointment tab's name.
 *
 * The patient record's tabs have carried these for a long time - Appts (6),
 * Invoices (5), Attachments (3) - and the appointment sheet's did not, so the
 * clinic had to open each one to find out whether anything was in it.
 *
 * Here rather than written eleven times in the sheet, so the wording is one
 * thing that can be proved.
 */

/** Tabs that are a screen rather than a list, and so carry no number. */
export const UNCOUNTED_TABS = ["Details", "AI Repository"] as const;

export function tabIsCounted(name: string): boolean {
  return !UNCOUNTED_TABS.includes(name as (typeof UNCOUNTED_TABS)[number]);
}

/**
 * "Billing (5)".
 *
 * Zero is printed, not hidden: a tab with no number beside nine that have one
 * reads as still loading, and "nothing here" is exactly what somebody opening
 * the sheet wants to know without clicking.
 *
 * A count that has not arrived yet (undefined, because its query is still in
 * flight) prints no brackets at all rather than a (0) that then changes - a
 * number that flickers from 0 to 3 is worse than one that appears.
 */
export function tabLabel(name: string, count?: number | null): string {
  if (!tabIsCounted(name) || count === undefined || count === null) return name;
  return `${name} (${count})`;
}
