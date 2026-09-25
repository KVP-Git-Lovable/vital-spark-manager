/**
 * Mirror of src/lib/procedureRollup.ts - the app and the edge functions do not
 * share a module path (same arrangement as prescriptionText.ts beside this
 * file). Keep the two in step: the document and the screen must decide
 * identically whether a visit's Special Instructions are anything more than a
 * repeat of its service lines.
 */

export interface RollUpLine {
  service_name?: string | null;
  procedure_notes?: string | null;
  recommendations?: string | null;
}

export type RollUpField = "procedure_notes" | "recommendations";

/** The parent-row value that a set of service lines adds up to. */
export const rollUpServiceField = (lines: RollUpLine[], field: RollUpField): string =>
  lines
    .filter((line) => (line?.[field] ?? "").trim())
    .map((line) => (lines.length > 1 ? `${line.service_name ?? ""}: ${line[field]}` : String(line[field])))
    .join("\n\n");

/**
 * Is the parent value nothing more than a repeat of the lines?
 *
 * When it is, printing it again says the same thing twice - which is exactly
 * what happened to "1v2" on a two-service visit, once in the Procedure Details
 * table and again, prefixed, under Special Instructions. When it is not, it
 * holds something the lines do not account for; on 17,581 imported visits that
 * is Salesforce's Special Instructions, and it is the only copy.
 */
export const isRollUpOf = (stored: string | null | undefined, lines: RollUpLine[], field: RollUpField): boolean => {
  const value = (stored ?? "").trim();
  if (!value) return true;
  return value === rollUpServiceField(lines, field).trim();
};
