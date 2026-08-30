export type FieldType = "text" | "picklist" | "date" | "number";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Where the picklist options come from (resolved at runtime by the caller). */
  optionsSource?: "gender" | "status" | "skin_type" | "blood_group" | "source" | "doctor" | "engagement_tier";
  /** Recurring yearly date (birthday/anniversary) — matched on day+month, ignoring year. */
  anniversary?: boolean;
}

export const PATIENT_FIELDS: FieldDef[] = [
  { key: "full_name", label: "Patient Name", type: "text" },
  { key: "first_name", label: "First Name", type: "text" },
  { key: "last_name", label: "Last Name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "gender", label: "Gender", type: "picklist", optionsSource: "gender" },
  { key: "age", label: "Age", type: "number" },
  { key: "date_of_birth", label: "Date of Birth (Birthday)", type: "date", anniversary: true },
  { key: "status", label: "Status", type: "picklist", optionsSource: "status" },
  { key: "skin_type", label: "Skin Type", type: "picklist", optionsSource: "skin_type" },
  { key: "skin_concerns", label: "Skin Concerns", type: "text" },
  { key: "blood_group", label: "Blood Group", type: "picklist", optionsSource: "blood_group" },
  { key: "allergies", label: "Allergies", type: "text" },
  { key: "current_medications", label: "Current Medications", type: "text" },
  { key: "medical_history", label: "Medical History", type: "text" },
  { key: "previous_treatments", label: "Previous Treatments", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "pincode", label: "Pincode", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "source", label: "Source", type: "picklist", optionsSource: "source" },
  { key: "source_referral_doctor", label: "Referral Doctor", type: "text" },
  { key: "doctor_id", label: "Assigned Doctor", type: "picklist", optionsSource: "doctor" },
  { key: "emergency_contact_name", label: "Emergency Contact", type: "text" },
  { key: "emergency_contact_phone", label: "Emergency Phone", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
  { key: "total_visits", label: "# of Visits", type: "number" },
  { key: "lifetime_value", label: "Total Lifetime Value", type: "number" },
  { key: "last_visit_date", label: "Last Visit Date", type: "date" },
  { key: "days_since_last_visit", label: "# Days Since Last Visit", type: "number" },
  { key: "engagement_score", label: "Engagement Score", type: "number" },
  { key: "engagement_tier", label: "Engagement Tier", type: "picklist", optionsSource: "engagement_tier" },
  { key: "engagement_visit_frequency", label: "Engagement - Visit Frequency", type: "number" },
  { key: "engagement_revenue_value", label: "Engagement - Revenue Value", type: "number" },
  { key: "engagement_treatment_depth", label: "Engagement - Treatment Depth", type: "number" },
  { key: "engagement_retention_signal", label: "Engagement - Retention Signal", type: "number" },
  { key: "engagement_compliance", label: "Engagement - Compliance", type: "number" },
  { key: "engagement_updated_at", label: "Engagement Updated", type: "date" },
  { key: "created_at", label: "Created Date", type: "date" },
  { key: "updated_at", label: "Last Modified", type: "date" },
];


export const DEFAULT_VIEW_COLUMNS = ["full_name", "phone", "skin_type", "status", "created_at"];

export function fieldDef(key: string): FieldDef | undefined {
  return PATIENT_FIELDS.find((f) => f.key === key);
}

export const GENDER_OPTIONS = ["Male", "Female", "Other"].map((v) => ({ value: v, label: v }));
export const STATUS_OPTIONS = ["Active", "Inactive"].map((v) => ({ value: v, label: v }));
export const SKIN_TYPE_OPTIONS = ["Normal", "Dry", "Oily", "Combination", "Sensitive"].map((v) => ({ value: v, label: v }));
export const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({ value: v, label: v }));
export const SOURCE_OPTIONS = [
  "Walk-in",
  "Referral",
  "Doctor Referral",
  "Google",
  "Facebook",
  "Instagram",
  "Advertisement",
  "Other",
].map((v) => ({ value: v, label: v }));

export const ENGAGEMENT_TIER_OPTIONS = ["Platinum", "Gold", "Silver", "Early"].map((v) => ({ value: v, label: v }));



export const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "equals", label: "equals" },
    { value: "starts_with", label: "starts with" },
    { value: "in_list", label: "is one of (comma separated)" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  picklist: [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "in", label: "is one of (multi-select)" },
    { value: "is_empty", label: "is empty" },
  ],
  date: [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "tomorrow", label: "Tomorrow" },
    { value: "this_week", label: "This week" },
    { value: "last_week", label: "Last week" },
    { value: "next_week", label: "Next week" },
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "next_month", label: "Next month" },
    { value: "this_quarter", label: "This quarter" },
    { value: "last_quarter", label: "Last quarter" },
    { value: "next_quarter", label: "Next quarter" },
    { value: "this_year", label: "This year" },
    { value: "last_year", label: "Last year" },
    { value: "next_year", label: "Next year" },
    { value: "last_n_days", label: "In the last N days" },
    { value: "next_n_days", label: "In the next N days" },
    { value: "on", label: "On (specific date)" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "between", label: "Custom date range" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],

  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
    { value: "between", label: "between" },
  ],
};

export interface FilterCondition {
  field: string;
  operator: string;
  value: string;
  value2?: string;
  values?: string[];
}

export interface ViewFilters {
  match: "all" | "any";
  conditions: FilterCondition[];
}

export type ChartType = "vertical_bar" | "horizontal_bar" | "donut" | "line";
export type AggregateType = "count" | "sum" | "avg";

export interface ViewChart {
  id: string;
  name: string;
  chart_type: ChartType;
  aggregate: AggregateType;
  aggregate_field?: string | null;
  group_field: string;
  limit?: number;
}

export interface KanbanConfig {
  /** Picklist field whose values become the Kanban columns. */
  group_field: string;
  /** Optional numeric field summed per column ("Summarize By"). */
  summarize_field?: string | null;
}

export type ListDisplayMode = "cards" | "table" | "kanban" | "split";

export interface ListView {
  id: string;
  name: string;
  owner_id: string;
  filters: ViewFilters;
  columns: string[];
  sort_field: string | null;
  sort_dir: "asc" | "desc";
  visibility: "private" | "everyone" | "selected";
  shared_user_ids: string[];
  is_default: boolean;
  charts: ViewChart[];
  /** Built-in views (All / Recently Viewed): filters are locked and they cannot be deleted. */
  is_standard?: boolean;
}

/** Fields that can drive Kanban columns (picklists only). */
export const KANBAN_GROUP_FIELDS = PATIENT_FIELDS.filter((f) => f.type === "picklist");
/** Fields that can be summarised on a Kanban column header. */
export const KANBAN_SUMMARY_FIELDS = PATIENT_FIELDS.filter((f) => f.type === "number");


/** Group + aggregate rows for a saved view chart. */
export function computeChartData(rows: any[], chart: ViewChart): { name: string; value: number }[] {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const raw = rawValue(row, chart.group_field);
    let key: string;
    const def = fieldDef(chart.group_field);
    if (raw === null || raw === undefined || raw === "") key = "—";
    else if (def?.type === "date") key = new Date(String(raw)).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    else key = String(raw);
    const metric =
      chart.aggregate === "count"
        ? 1
        : Number(rawValue(row, chart.aggregate_field || "") ?? 0) || 0;
    const arr = buckets.get(key) ?? [];
    arr.push(metric);
    buckets.set(key, arr);
  }
  const data = Array.from(buckets.entries()).map(([name, values]) => ({
    name,
    value:
      chart.aggregate === "avg"
        ? Math.round((values.reduce((a, b) => a + b, 0) / (values.length || 1)) * 100) / 100
        : values.reduce((a, b) => a + b, 0),
  }));
  data.sort((a, b) => b.value - a.value);
  return data.slice(0, chart.limit && chart.limit > 0 ? chart.limit : 12);
}


export function patientAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  if (isNaN(diff)) return null;
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

/** Resolve the comparable value of a field for a given patient row. */
export function rawValue(row: any, key: string): unknown {
  if (!row) return null;
  if (key === "full_name") return `${row.first_name || ""} ${row.last_name || ""}`.trim();
  if (key === "age") return patientAge(row.date_of_birth);
  return row[key];
}

function listValues(c: FilterCondition): string[] {
  if (c.values && c.values.length) return c.values.map((v) => String(v).trim()).filter(Boolean);
  return String(c.value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // Monday start
const startOfMonth = (d: Date, offset = 0) => new Date(d.getFullYear(), d.getMonth() + offset, 1);
const startOfQuarter = (d: Date, offset = 0) =>
  new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + offset * 3, 1);
const startOfYear = (d: Date, offset = 0) => new Date(d.getFullYear() + offset, 0, 1);

export interface DateRange { from: Date; to: Date }

/** Resolve a date operator into an inclusive [from, to] day range (or null when not a preset/range op). */
export function dateRangeFor(operator: string, value?: string, value2?: string): DateRange | null {
  const now = new Date();
  const today = startOfDay(now);
  const end = (d: Date) => addDays(d, -1); // exclusive-start → inclusive-end helper
  switch (operator) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "tomorrow": return { from: addDays(today, 1), to: addDays(today, 1) };
    case "this_week": return { from: startOfWeek(now), to: addDays(startOfWeek(now), 6) };
    case "last_week": return { from: addDays(startOfWeek(now), -7), to: addDays(startOfWeek(now), -1) };
    case "next_week": return { from: addDays(startOfWeek(now), 7), to: addDays(startOfWeek(now), 13) };
    case "this_month": return { from: startOfMonth(now), to: end(startOfMonth(now, 1)) };
    case "last_month": return { from: startOfMonth(now, -1), to: end(startOfMonth(now)) };
    case "next_month": return { from: startOfMonth(now, 1), to: end(startOfMonth(now, 2)) };
    case "this_quarter": return { from: startOfQuarter(now), to: end(startOfQuarter(now, 1)) };
    case "last_quarter": return { from: startOfQuarter(now, -1), to: end(startOfQuarter(now)) };
    case "next_quarter": return { from: startOfQuarter(now, 1), to: end(startOfQuarter(now, 2)) };
    case "this_year": return { from: startOfYear(now), to: end(startOfYear(now, 1)) };
    case "last_year": return { from: startOfYear(now, -1), to: end(startOfYear(now)) };
    case "next_year": return { from: startOfYear(now, 1), to: end(startOfYear(now, 2)) };
    case "last_n_days": {
      const n = Number(value || 0);
      if (!n) return null;
      return { from: addDays(today, -(n - 1)), to: today };
    }
    case "next_n_days": {
      const n = Number(value || 0);
      if (!n) return null;
      return { from: today, to: addDays(today, n - 1) };
    }
    case "on": {
      if (!value) return null;
      const d = startOfDay(new Date(value));
      return isNaN(d.getTime()) ? null : { from: d, to: d };
    }
    case "between": {
      if (!value || !value2) return null;
      const a = startOfDay(new Date(value));
      const b = startOfDay(new Date(value2));
      if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
    default: return null;
  }
}

/** True when a recurring yearly date (birthday) falls inside the range, ignoring the stored year. */
function anniversaryInRange(d: Date, range: DateRange): boolean {
  for (let y = range.from.getFullYear() - 1; y <= range.to.getFullYear() + 1; y++) {
    const occ = new Date(y, d.getMonth(), d.getDate()).getTime();
    if (occ >= range.from.getTime() && occ <= range.to.getTime()) return true;
  }
  return false;
}


function matchOne(row: any, c: FilterCondition): boolean {
  const def = fieldDef(c.field);
  if (!def) return true;
  const val = rawValue(row, c.field);

  if (c.operator === "is_empty") {
    return val === null || val === undefined || String(val).trim() === "";
  }
  if (c.operator === "is_not_empty") {
    return !(val === null || val === undefined || String(val).trim() === "");
  }

  if (def.type === "number") {
    const n = Number(val ?? 0);
    const a = Number(c.value);
    const b = Number(c.value2);
    switch (c.operator) {
      case "eq": return n === a;
      case "neq": return n !== a;
      case "gt": return n > a;
      case "lt": return n < a;
      case "between": return n >= Math.min(a, b) && n <= Math.max(a, b);
      default: return true;
    }
  }

  if (def.type === "date") {
    if (!val) return false;
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return false;
    const dayValue = startOfDay(d).getTime();

    if (c.operator === "before" || c.operator === "after") {
      if (!c.value) return true;
      const target = startOfDay(new Date(c.value));
      if (isNaN(target.getTime())) return true;
      if (def.anniversary) {
        // compare this year's occurrence
        const occ = new Date(target.getFullYear(), d.getMonth(), d.getDate()).getTime();
        return c.operator === "before" ? occ < target.getTime() : occ > target.getTime();
      }
      return c.operator === "before" ? dayValue < target.getTime() : dayValue > target.getTime();
    }

    const range = dateRangeFor(c.operator, c.value, c.value2);
    if (!range) return true;
    if (def.anniversary) return anniversaryInRange(d, range);
    return dayValue >= range.from.getTime() && dayValue <= range.to.getTime();
  }


  const s = String(val ?? "").toLowerCase();
  const q = String(c.value ?? "").toLowerCase();
  switch (c.operator) {
    case "contains": return s.includes(q);
    case "not_contains": return !s.includes(q);
    case "equals": return String(val ?? "") === c.value;
    case "not_equals": return String(val ?? "") !== c.value;
    case "starts_with": return s.startsWith(q);
    case "in": return listValues(c).includes(String(val ?? ""));
    case "in_list": return listValues(c).map((v) => v.toLowerCase()).includes(s);
    default: return true;
  }
}

export function applyFilters<T>(rows: T[], filters?: ViewFilters | null): T[] {
  const conditions = filters?.conditions?.filter((c) => c.field && c.operator) ?? [];
  if (!conditions.length) return rows;
  const match = filters?.match ?? "all";
  return rows.filter((row) =>
    match === "all"
      ? conditions.every((c) => matchOne(row, c))
      : conditions.some((c) => matchOne(row, c))
  );
}

export function sortRows<T>(rows: T[], field?: string | null, dir: "asc" | "desc" = "desc"): T[] {
  if (!field) return rows;
  const def = fieldDef(field);
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = rawValue(a, field);
    const bv = rawValue(b, field);
    if (av === null || av === undefined || av === "") return 1;
    if (bv === null || bv === undefined || bv === "") return -1;
    if (def?.type === "number") return (Number(av) - Number(bv)) * sign;
    if (def?.type === "date") return (new Date(String(av)).getTime() - new Date(String(bv)).getTime()) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

export function formatCell(row: any, key: string): string {
  const def = fieldDef(key);
  const val = rawValue(row, key);
  if (val === null || val === undefined || val === "") return "—";
  if (def?.type === "date") {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return String(val);
}
