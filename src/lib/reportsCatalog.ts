import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabasePaginate";

export type ColumnType = "text" | "number" | "currency" | "date" | "datetime" | "badge";

export interface ReportColumn {
  key: string;
  label: string;
  type?: ColumnType;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
  accessor?: (row: any) => any;
}

export type FilterType = "dateRange" | "select" | "text";

export interface ReportFilterDef {
  key: string;
  label: string;
  type: FilterType;
  // For select
  options?: { value: string; label: string }[];
  // For dateRange / select / text — the row field used for client-side filtering
  field?: string;
  // For dateRange — should we apply server-side?
  serverDateField?: string;
}

export interface ReportConfig {
  key: string;
  title: string;
  description: string;
  category: "Patients" | "Operations" | "Finance" | "Marketing";
  columns: ReportColumn[];
  filters: ReportFilterDef[];
  searchFields?: string[];
  rowHref?: (row: any) => string | null;
  fetcher: (params: { from?: string; to?: string }) => Promise<any[]>;
  summary?: (rows: any[]) => { label: string; value: string }[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  chart?: {
    title: string;
    valueLabel?: string;
    orientation?: "vertical" | "horizontal";
    build: (rows: any[]) => { label: string; value: number }[];
  };
}

function groupCount(rows: any[], field: string, topN = 10, fallback = "Unknown") {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = (r?.[field] ?? fallback) || fallback;
    m.set(String(k), (m.get(String(k)) ?? 0) + 1);
  });
  return Array.from(m, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

function groupSum(rows: any[], field: string, valueField: string, topN = 10, fallback = "Unknown") {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = (r?.[field] ?? fallback) || fallback;
    m.set(String(k), (m.get(String(k)) ?? 0) + Number(r?.[valueField] ?? 0));
  });
  return Array.from(m, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

function groupSumByMonth(rows: any[], dateField: string, valueField: string) {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    if (!r?.[dateField]) return;
    const d = new Date(r[dateField]);
    if (isNaN(d.getTime())) return;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    m.set(k, (m.get(k) ?? 0) + Number(r?.[valueField] ?? 0));
  });
  return Array.from(m, ([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
}

const STATUS_APPT = ["Scheduled", "Confirmed", "Completed", "Cancelled", "No-show"];
const STATUS_INV = ["Pending", "Partial", "Paid", "Cancelled"];
const PAY_MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque"];
const CAMPAIGN_TYPES = ["Google Ads", "Meta Ads", "WhatsApp", "Email", "Other"];
const CAMPAIGN_STATUS = ["Planning", "Active", "Completed"];

export const REPORTS: ReportConfig[] = [
  {
    key: "patients",
    title: "Patients",
    description: "All registered patients with source and contact info.",
    category: "Patients",
    defaultSort: { key: "created_at", dir: "desc" },
    columns: [
      { key: "name", label: "Name", sortable: true, accessor: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() },
      { key: "phone", label: "Phone", sortable: true },
      { key: "gender", label: "Gender", sortable: true },
      { key: "source", label: "Source", sortable: true, type: "badge" },
      { key: "city", label: "City", sortable: true },
      { key: "created_at", label: "Created", sortable: true, type: "date" },
    ],
    filters: [
      { key: "dateRange", label: "Created", type: "dateRange", serverDateField: "created_at" },
      {
        key: "source", label: "Source", type: "select", field: "source",
        options: ["Walk-in", "Referral", "Instagram", "Facebook", "Google", "WhatsApp", "Other"].map(v => ({ value: v, label: v })),
      },
      {
        key: "status", label: "Status", type: "select", field: "status",
        options: ["Active", "Inactive"].map(v => ({ value: v, label: v })),
      },
    ],
    searchFields: ["first_name", "last_name", "phone", "email"],
    rowHref: (r) => `/patients/${r.id}`,
    fetcher: async ({ from, to }) =>
      fetchAll((s, e) => {
        let q = supabase.from("patients").select("*").order("created_at", { ascending: false }).range(s, e);
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        return q;
      }),
    summary: (rows) => [
      { label: "Total Patients", value: rows.length.toLocaleString() },
      { label: "Active", value: rows.filter((r) => r.status === "Active").length.toLocaleString() },
    ],
  },
  {
    key: "appointments",
    title: "Appointments",
    description: "All scheduled and past appointments.",
    category: "Operations",
    defaultSort: { key: "start_time", dir: "desc" },
    columns: [
      { key: "patient_name", label: "Patient", sortable: true },
      { key: "service", label: "Service", sortable: true },
      { key: "start_time", label: "Start", sortable: true, type: "datetime" },
      { key: "status", label: "Status", sortable: true, type: "badge" },
    ],
    filters: [
      { key: "dateRange", label: "Date", type: "dateRange", serverDateField: "start_time" },
      { key: "status", label: "Status", type: "select", field: "status", options: STATUS_APPT.map(v => ({ value: v, label: v })) },
    ],
    searchFields: ["patient_name", "service"],
    rowHref: () => `/appointments`,
    fetcher: async ({ from, to }) =>
      fetchAll((s, e) => {
        let q = supabase.from("appointments").select("*").order("start_time", { ascending: false }).range(s, e);
        if (from) q = q.gte("start_time", from);
        if (to) q = q.lte("start_time", to);
        return q;
      }),
    summary: (rows) => [
      { label: "Total", value: rows.length.toLocaleString() },
      { label: "Completed", value: rows.filter((r) => r.status === "Completed").length.toLocaleString() },
      { label: "Cancelled", value: rows.filter((r) => r.status === "Cancelled").length.toLocaleString() },
    ],
  },
  {
    key: "invoices",
    title: "Invoices & Revenue",
    description: "All invoices with paid and pending amounts.",
    category: "Finance",
    defaultSort: { key: "created_at", dir: "desc" },
    columns: [
      { key: "invoice_number", label: "Invoice #", sortable: true },
      { key: "patient_name", label: "Patient", sortable: true },
      { key: "total_amount", label: "Total", sortable: true, type: "currency" },
      { key: "paid_amount", label: "Paid", sortable: true, type: "currency" },
      { key: "status", label: "Status", sortable: true, type: "badge" },
      { key: "payment_mode", label: "Mode", sortable: true },
      { key: "created_at", label: "Date", sortable: true, type: "date" },
    ],
    filters: [
      { key: "dateRange", label: "Date", type: "dateRange", serverDateField: "created_at" },
      { key: "status", label: "Status", type: "select", field: "status", options: STATUS_INV.map(v => ({ value: v, label: v })) },
      { key: "payment_mode", label: "Payment Mode", type: "select", field: "payment_mode", options: PAY_MODES.map(v => ({ value: v, label: v })) },
    ],
    searchFields: ["invoice_number", "patient_name"],
    rowHref: () => `/billing`,
    fetcher: async ({ from, to }) =>
      fetchAll((s, e) => {
        let q = supabase.from("invoices").select("*").order("created_at", { ascending: false }).range(s, e);
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        return q;
      }),
    summary: (rows) => {
      const total = rows.reduce((a, r) => a + Number(r.total_amount || 0), 0);
      const paid = rows.reduce((a, r) => a + Number(r.paid_amount || 0), 0);
      return [
        { label: "Invoices", value: rows.length.toLocaleString() },
        { label: "Total Billed", value: `₹${total.toLocaleString()}` },
        { label: "Collected", value: `₹${paid.toLocaleString()}` },
        { label: "Outstanding", value: `₹${(total - paid).toLocaleString()}` },
      ];
    },
  },
  {
    key: "expenses",
    title: "Expenses",
    description: "All recorded clinic expenses.",
    category: "Finance",
    defaultSort: { key: "expense_date", dir: "desc" },
    columns: [
      { key: "expense_date", label: "Date", sortable: true, type: "date" },
      { key: "title", label: "Title", sortable: true },
      { key: "vendor_name", label: "Vendor", sortable: true },
      { key: "amount", label: "Amount", sortable: true, type: "currency" },
      { key: "payment_mode", label: "Mode", sortable: true },
    ],
    filters: [
      { key: "dateRange", label: "Date", type: "dateRange", serverDateField: "expense_date" },
      { key: "payment_mode", label: "Payment Mode", type: "select", field: "payment_mode", options: PAY_MODES.map(v => ({ value: v, label: v })) },
    ],
    searchFields: ["title", "vendor_name", "description"],
    rowHref: () => `/expenses`,
    fetcher: async ({ from, to }) =>
      fetchAll((s, e) => {
        let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false }).range(s, e);
        if (from) q = q.gte("expense_date", from.slice(0, 10));
        if (to) q = q.lte("expense_date", to.slice(0, 10));
        return q;
      }),
    summary: (rows) => {
      const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
      return [
        { label: "Entries", value: rows.length.toLocaleString() },
        { label: "Total Spent", value: `₹${total.toLocaleString()}` },
      ];
    },
  },
  {
    key: "pharma_bills",
    title: "Pharmacy Bills",
    description: "All pharmacy bills and over-the-counter sales.",
    category: "Finance",
    defaultSort: { key: "created_at", dir: "desc" },
    columns: [
      { key: "bill_number", label: "Bill #", sortable: true },
      { key: "patient_name", label: "Patient", sortable: true },
      { key: "net_amount", label: "Net Amount", sortable: true, type: "currency" },
      { key: "payment_mode", label: "Mode", sortable: true },
      { key: "status", label: "Status", sortable: true, type: "badge" },
      { key: "created_at", label: "Date", sortable: true, type: "date" },
    ],
    filters: [
      { key: "dateRange", label: "Date", type: "dateRange", serverDateField: "created_at" },
      { key: "payment_mode", label: "Payment Mode", type: "select", field: "payment_mode", options: PAY_MODES.map(v => ({ value: v, label: v })) },
    ],
    searchFields: ["bill_number", "patient_name"],
    rowHref: () => `/pharma`,
    fetcher: async ({ from, to }) =>
      fetchAll((s, e) => {
        let q = supabase.from("pharma_bills").select("*").order("created_at", { ascending: false }).range(s, e);
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        return q;
      }),
    summary: (rows) => {
      const total = rows.reduce((a, r) => a + Number(r.net_amount || 0), 0);
      return [
        { label: "Bills", value: rows.length.toLocaleString() },
        { label: "Total", value: `₹${total.toLocaleString()}` },
      ];
    },
  },
  {
    key: "campaigns",
    title: "Campaigns ROI",
    description: "Marketing campaigns with budget and spend.",
    category: "Marketing",
    defaultSort: { key: "start_date", dir: "desc" },
    columns: [
      { key: "name", label: "Campaign", sortable: true },
      { key: "type", label: "Type", sortable: true, type: "badge" },
      { key: "status", label: "Status", sortable: true, type: "badge" },
      { key: "budget", label: "Budget", sortable: true, type: "currency" },
      { key: "amount_spent", label: "Spent", sortable: true, type: "currency" },
      { key: "start_date", label: "Start", sortable: true, type: "date" },
      { key: "end_date", label: "End", sortable: true, type: "date" },
    ],
    filters: [
      { key: "type", label: "Type", type: "select", field: "type", options: CAMPAIGN_TYPES.map(v => ({ value: v, label: v })) },
      { key: "status", label: "Status", type: "select", field: "status", options: CAMPAIGN_STATUS.map(v => ({ value: v, label: v })) },
    ],
    searchFields: ["name"],
    rowHref: (r) => `/campaigns/${r.id}`,
    fetcher: async () =>
      fetchAll((s, e) => supabase.from("campaigns").select("*").order("start_date", { ascending: false }).range(s, e)),
    summary: (rows) => {
      const budget = rows.reduce((a, r) => a + Number(r.budget || 0), 0);
      const spent = rows.reduce((a, r) => a + Number(r.amount_spent || 0), 0);
      return [
        { label: "Campaigns", value: rows.length.toLocaleString() },
        { label: "Total Budget", value: `₹${budget.toLocaleString()}` },
        { label: "Total Spent", value: `₹${spent.toLocaleString()}` },
      ];
    },
  },
];

export function getReport(key: string) {
  return REPORTS.find((r) => r.key === key);
}