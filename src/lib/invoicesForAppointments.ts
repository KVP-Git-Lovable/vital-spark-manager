/**
 * Invoices for a known set of appointments, looked up by id.
 *
 * The Appointments page used to build its bill/payment-mode lookup by pulling
 * the ENTIRE invoices table through fetchAll(). That had three problems:
 *
 *   - it had no ORDER BY, and PostgREST .range() paging without one is not
 *     stable, so rows could be silently skipped or repeated across pages;
 *   - it grew with the clinic's whole billing history rather than with what is
 *     on screen, so a later page could hit the statement timeout - and a
 *     throwing query leaves useQuery's data at [], which renders as a dash in
 *     every Bill Amount and Payment Mode cell with nothing to say why;
 *   - it was slow even when it worked, for a screen showing twenty rows.
 *
 * Fetching by appointment id instead keeps the work proportional to the rows
 * being displayed. The ids go in the URL, so they are chunked well below any
 * URL-length limit, and the chunks run a few at a time to stay quick on the
 * wide date ranges.
 */

/** Ids per request. ~36 bytes each; 150 keeps the GET URL around 6 KB. */
export const INVOICE_ID_CHUNK = 150;
/** Chunks in flight at once. */
export const INVOICE_CHUNK_CONCURRENCY = 4;

export function chunkIds(ids: string[], size = INVOICE_ID_CHUNK): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

export async function fetchInvoicesByAppointmentIds<T>(
  fetchChunk: (ids: string[]) => Promise<T[]>,
  ids: string[],
  options: { chunkSize?: number; concurrency?: number } = {},
): Promise<T[]> {
  const chunks = chunkIds(ids, options.chunkSize ?? INVOICE_ID_CHUNK);
  if (chunks.length === 0) return [];

  const limit = Math.max(1, options.concurrency ?? INVOICE_CHUNK_CONCURRENCY);
  const results: T[][] = new Array(chunks.length);
  let next = 0;

  // A fixed pool of workers rather than Promise.all over every chunk: a wide
  // date range can be hundreds of chunks, and firing them all at once is how
  // you get rate-limited instead of fast.
  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= chunks.length) return;
      results[index] = await fetchChunk(chunks[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, chunks.length) }, worker));
  return results.flat();
}

/** appointment_id -> invoice, for the row cells and the view-filter engine. */
export function invoiceMapByAppointment<T extends { appointment_id?: string | null }>(
  invoices: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const inv of invoices) {
    if (inv?.appointment_id) map.set(inv.appointment_id, inv);
  }
  return map;
}
