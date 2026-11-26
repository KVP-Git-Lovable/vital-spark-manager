import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabasePaginate";

/**
 * The rows the Clinic 360 Dashboard counts.
 *
 * ── The bug this file exists for ──
 *
 * The three dashboard queries ended in `.limit(5000)`, with a comment saying
 * a large date range could never become a full-table scan. Supabase does not
 * honour that number: PostgREST serves min(client limit, server max-rows),
 * and max-rows is 1000. So the queries returned 1000 rows, with no error, no
 * warning and no count - and every card and chart was then worked out in
 * JavaScript from that slice.
 *
 * On 26 Nov 2026 the Current Quarter read 1,000 appointments against a real
 * 1,932, and 223 billed against a real 1,546. The billed number collapsed
 * rather than merely shrinking because the two fetches truncate from opposite
 * ends - appointments oldest-first, invoices newest-first - and the billed
 * count is the intersection of the two, so it saw only the overlap in the
 * middle. Revenue read Rs 34.85 lakh against a real Rs 56.79 lakh.
 *
 * Every page of a paginated read is a round trip, so the ceiling is real and
 * the caller is told when it bites. A short list the viewer is not warned
 * about is the defect itself, and raising a silent cap only moves it.
 */

/**
 * As many rows as one dashboard view will page through.
 *
 * Clears every range the period filter offers - the largest, Current Year,
 * was 10,667 appointments and 8,918 invoices when this was written - so in
 * practice it only guards a Custom Range spanning several years.
 */
export const DASH_ROW_CEILING = 20000;

/** One page per round trip; the server will not serve a larger one. */
export const DASH_PAGE_SIZE = 1000;

export interface DashboardRows<T> {
  rows: T[];
  /** The window holds more than DASH_ROW_CEILING: these rows are a part of it. */
  truncated: boolean;
}

const paged = async <T>(builder: (from: number, to: number) => unknown): Promise<DashboardRows<T>> => {
  const rows = await fetchAll<T>(builder as (from: number, to: number) => never, DASH_PAGE_SIZE, DASH_ROW_CEILING);
  return { rows, truncated: rows.length >= DASH_ROW_CEILING };
};

/**
 * Every appointment whose start falls in the window.
 *
 * Same columns, same bounds and same ordering as before - only the
 * truncation is gone. The doctor and service filters stay in memory over
 * these rows, as they were.
 */
export const fetchDashboardAppointments = (startISO: string, endISO: string) =>
  paged<Record<string, unknown>>((from, to) =>
    supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .gte("start_time", startISO)
      .lte("start_time", endISO)
      .order("start_time")
      .range(from, to),
  );

/** Every invoice raised in the window. Feeds Revenue and the billed set. */
export const fetchDashboardInvoices = (startISO: string, endISO: string) =>
  paged<Record<string, unknown>>((from, to) =>
    supabase
      .from("invoices")
      .select("*")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .range(from, to),
  );

/** Feedback recorded in the window, for the NPS and rating card. */
export const fetchDashboardFeedback = (startISO: string, endISO: string) =>
  paged<{ nps_score: number | null; service_rating: number | null }>((from, to) =>
    supabase
      .from("patient_feedback")
      .select("nps_score, service_rating")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at")
      .range(from, to),
  );
