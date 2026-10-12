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

/**
 * Which stored row a line with no id of its own actually is.
 *
 * A doctor entered HYDRASIGNATURE once and the visit stored it twice. The
 * screen seeds its lines from procedure_services, and when that query answers
 * from a cache written before the row existed it looks like the visit has no
 * services, so a line is made up from the parent row - with no id. Saving
 * inserts it. Open the visit again, same stale answer, save again: a second
 * identical row. Seven visits in the clinic ended up like that, one of them
 * three times over, each copy seconds apart.
 *
 * The cache is fixed separately. This is the guard that does not depend on it:
 * before writing, the save reads what the database actually holds, and a line
 * with no id that names a service already stored updates that row rather than
 * adding another. Only the first unclaimed row of that name is taken, so a
 * doctor who genuinely lists the same service twice still gets two rows.
 *
 * Matching is by name because that is all an invented line has - it was built
 * from the parent row, which carries no service id.
 */

export interface StoredServiceRow {
  id: string;
  service_name?: string | null;
}

/** The id to write a line back to, or null to insert it as a new row. */
export function matchStoredRows<T extends SavedServiceLine>(
  lines: T[],
  stored: StoredServiceRow[],
): (string | null)[] {
  const key = (name: string | null | undefined) => (name || "").trim().toLowerCase();

  // A row already claimed by a line that carries its id is not up for matching:
  // that line is the one editing it.
  const claimed = new Set(lines.map((l) => l.id).filter(Boolean) as string[]);
  const free = stored.filter((row) => row.id && !claimed.has(row.id));

  return lines.map((line) => {
    if (line.id) return line.id;
    const name = key(line.service_name);
    if (!name) return null;
    const hit = free.findIndex((row) => key(row.service_name) === name);
    if (hit === -1) return null;
    // Taken, so a second line of the same name inserts rather than overwriting
    // the row the first one just claimed.
    const [row] = free.splice(hit, 1);
    return row.id;
  });
}
