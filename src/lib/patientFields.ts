export type FieldType = "text" | "picklist" | "date" | "number";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Where the picklist options come from (resolved at runtime by the caller). */
  optionsSource?: "gender" | "status" | "skin_type" | "blood_group" | "source" | "doctor";
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
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
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const target = c.value ? day(new Date(c.value)) : NaN;
    switch (c.operator) {
      case "on": return day(d) === target;
      case "before": return day(d) < target;
      case "after": return day(d) > target;
      case "between": {
        const t2 = c.value2 ? day(new Date(c.value2)) : NaN;
        if (isNaN(target) || isNaN(t2)) return true;
        return day(d) >= Math.min(target, t2) && day(d) <= Math.max(target, t2);
      }
      case "last_n_days": {
        const n = Number(c.value || 0);
        if (!n) return true;
        const from = Date.now() - n * 86400000;
        return d.getTime() >= from && d.getTime() <= Date.now() + 86400000;
      }
      case "this_month": {
        const now = new Date();
        return d >= startOfMonth(now) && d < startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      }
      default: return true;
    }
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
