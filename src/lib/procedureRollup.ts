/**
 * A visit's notes and recommendations live on its service lines. The parent
 * `procedures` row carries a rolled-up copy of them, prefixed with the service
 * name when there is more than one line, so a reader can tell which treatment
 * each part belongs to:
 *
 *     Scar Remodelling: Additional 2-3 sessions
 *
 *     FILLERS: 1v2
 *
 * Two screens used to compute that separately and a third compared against it
 * by hand, which is how a doctor ended up seeing her own "1v2" twice - once as
 * FILLERS' Recommendations, and again as "FILLERS: 1v2" under another heading,
 * because the comparison tested the raw line text against the prefixed roll-up
 * and could never match. One function now, used by everything that needs it.
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
 * When it is, showing it again is duplication and it can be hidden. When it is
 * not, it holds something the lines do not account for - on 17,581 imported
 * visits that is Salesforce's Special Instructions, which is the only copy.
 */
export const isRollUpOf = (stored: string | null | undefined, lines: RollUpLine[], field: RollUpField): boolean => {
  const value = (stored ?? "").trim();
  if (!value) return true;
  return value === rollUpServiceField(lines, field).trim();
};

/**
 * What to write to the parent row on save.
 *
 * Re-roll it from the lines only where the lines account for what is stored -
 * it is blank, or it is exactly what the lines it was loaded with added up to.
 * Anything else was written by a person or imported from Salesforce, and is the
 * editable box on screen, so what was typed there is what gets saved. A save on
 * this visit is never permission to destroy it.
 */
export const nextRollUpValue = (
  stored: string | null | undefined,
  originalLines: RollUpLine[],
  currentLines: RollUpLine[],
  field: RollUpField,
  edited: string,
): string => (isRollUpOf(stored, originalLines, field) ? rollUpServiceField(currentLines, field) : edited);
