import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabasePaginate";
import { startOfDay, endOfDay } from "date-fns";

export const INVOICE_SELECT =
  "*, appointments(id, service, start_time, staff_id, doctors:staff_id(first_name, last_name))";

export interface InvoiceDateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

function applyDateRange(q: any, { dateFrom, dateTo }: InvoiceDateRange) {
  if (dateFrom) q = q.gte("created_at", startOfDay(dateFrom).toISOString());
  if (dateTo) q = q.lte("created_at", endOfDay(dateTo).toISOString());
  return q;
}

export interface FetchInvoicesPageParams extends InvoiceDateRange {
  page: number;
  pageSize: number;
}

export interface InvoicesPageResult {
  rows: any[];
  total: number;
}

/**
 * Server-side paginated fetch for the Billing table's default view (no
 * quick filters, search, custom saved view, or Kanban display active) -
 * one request per page instead of fetchAll()'s ~30 sequential requests
 * across the whole (~29k row) invoices table.
 */
export async function fetchInvoicesPage({
  page,
  pageSize,
  dateFrom,
  dateTo,
}: FetchInvoicesPageParams): Promise<InvoicesPageResult> {
  let q = supabase.from("invoices").select(INVOICE_SELECT, { count: "exact" });
  q = applyDateRange(q, { dateFrom, dateTo });
  q = q.order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

export interface FetchInvoicesBoundedParams extends InvoiceDateRange {
  limit: number;
}

/**
 * Bounded fetch for when a quick filter, search, custom saved view, or
 * Kanban display needs the full (client-side-filterable) set in memory -
 * capped well below the full table so a handful of requests replace
 * fetchAll()'s dozens, while keeping every existing client-side filter
 * predicate (doctor/service/search/saved-view engine) working unchanged.
 */
export async function fetchInvoicesBounded({ dateFrom, dateTo, limit }: FetchInvoicesBoundedParams): Promise<any[]> {
  const all = await fetchAll<any>((from, to) => {
    let q = supabase.from("invoices").select(INVOICE_SELECT);
    q = applyDateRange(q, { dateFrom, dateTo });
    return q.order("created_at", { ascending: false }).range(from, to);
  });
  return all.slice(0, limit);
}

export interface InvoiceStats {
  totalRevenue: number;
  pendingAmount: number;
  partialAmount: number;
}

/**
 * All-time revenue/pending/partial totals, independent of pagination and
 * filters - fetched separately (only 3 columns, no join) so a failure here
 * never blanks out the main invoice list, and so the cards stay accurate
 * while the user is searching/filtering the table.
 */
export async function fetchInvoiceStats(): Promise<InvoiceStats> {
  const rows = await fetchAll<any>((from, to) =>
    supabase.from("invoices").select("total_amount, paid_amount, status").range(from, to)
  );
  let totalRevenue = 0;
  let pendingAmount = 0;
  let partialAmount = 0;
  for (const inv of rows) {
    totalRevenue += Number(inv.paid_amount) || 0;
    if (inv.status === "Pending") pendingAmount += Number(inv.total_amount) || 0;
    if (inv.status === "Partial") partialAmount += (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0);
  }
  return { totalRevenue, pendingAmount, partialAmount };
}

export async function fetchInvoiceById(id: string): Promise<any | null> {
  const { data, error } = await supabase.from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
