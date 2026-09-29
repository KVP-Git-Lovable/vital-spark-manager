/**
 * What to write back when a visit's services are edited.
 *
 * A doctor removed a service, saved, and it kept printing on the prescription.
 * Two ways that happened, both fixed here:
 *
 * 1. The parent `procedures` row carries a roll-up of the service names, and
 *    the printed document falls back to it when a visit has no service lines.
 *    Removing the last line left that name behind, so the document went on
 *    naming a service that no longer existed.
 * 2. A stored line whose name had been cleared was skipped by the save
 *    entirely - not updated, not deleted - so the database kept the old name
 *    and the document kept printing it.
 *
 * The fallback itself is deliberate and must stay: Scan Prescription writes a
 * visit with a service name and no lines at all, and imported visits have none
 * either. So the name is only cleared for a visit that actually held lines when
 * it was opened.
 */

export interface SavedServiceLine {
  /** Set once the row exists in procedure_services. */
  id?: string | null;
  service_name?: string | null;
}

const named = (line: SavedServiceLine) => (line.service_name || "").trim();

/**
 * The name to store on the parent row.
 *
 * `storedName` is what the visit already carries, and is kept for a visit that
 * never had lines - a scanned or imported one, where it is the only record of
 * what was done.
 */
export function parentServiceName(
  keptLines: SavedServiceLine[],
  hadStoredLines: boolean,
  storedName: string,
): string {
  if (keptLines.length) return keptLines.map((l) => named(l)).join(", ");
  return hadStoredLines ? "" : storedName;
}

/**
 * Which on-screen lines get written back.
 *
 * A row that is already stored is always written, even with its name cleared,
 * so what is saved is what the doctor is looking at. A new row is written only
 * once it has a name, so an untouched empty line adds nothing.
 */
export function linesToWrite<T extends SavedServiceLine>(onScreen: T[]): T[] {
  return onScreen.filter((line) => !!line.id || !!named(line));
}
