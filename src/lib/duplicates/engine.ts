import { supabase } from "@/integrations/supabase/client";
import { getObject } from "@/lib/validation/schema";
import type { DuplicateRule, MatchField } from "./types";

export interface DuplicateMatch {
  rule: DuplicateRule;
  record: Record<string, any>;
  matchedFields: MatchField[];
  /** "block" when any matched field is configured to stop the save. */
  severity: "alert" | "block";
  title: string;
  message: string;
}

const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
const lower = (v: any) => norm(v).toLowerCase();

/** Loose similarity for fuzzy matching (0..1). */
function similarity(a: string, b: string): number {
  a = lower(a);
  b = lower(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  // Levenshtein
  let prev = Array.from({ length: short.length + 1 }, (_, i) => i);
  for (let i = 1; i <= long.length; i++) {
    const cur = [i];
    for (let j = 1; j <= short.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (long[i - 1] === short[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[short.length] / long.length;
}

function fieldMatches(field: MatchField, input: any, existing: any): boolean {
  const a = norm(input);
  const b = norm(existing);
  if (!a || !b) return false;
  switch (field.matchType) {
    case "exact":
      return a === b;
    case "case_insensitive":
      return a.toLowerCase() === b.toLowerCase();
    case "starts_with":
      return b.toLowerCase().startsWith(a.toLowerCase()) || a.toLowerCase().startsWith(b.toLowerCase());
    case "fuzzy":
      return similarity(a, b) >= 0.85;
    default:
      return false;
  }
}

/** Evaluate the ordered match fields against a candidate record, honouring AND/OR joiners. */
function evaluateRecord(rule: DuplicateRule, values: Record<string, any>, record: Record<string, any>) {
  const fields = rule.match_fields || [];
  if (fields.length === 0) return null;
  const matchedFields: MatchField[] = [];
  let result: boolean | null = null;
  fields.forEach((f, i) => {
    const hit = fieldMatches(f, values[f.field_key], record[f.field_key]);
    if (hit) matchedFields.push(f);
    if (i === 0) result = hit;
    else result = f.joiner === "or" ? result! || hit : result! && hit;
  });
  return result ? matchedFields : null;
}

export function recordLabel(objectKey: string, record: Record<string, any>): string {
  if (objectKey === "patients") {
    return [record.first_name, record.last_name].filter(Boolean).join(" ") || record.phone || "Existing record";
  }
  return (
    record.name || record.invoice_number || record.patient_name || record.service_name || "Existing record"
  );
}

/** Replace {{match}}, {{field}} and {{field.<key>}} tokens with data from the duplicate record. */
export function renderTemplate(
  template: string,
  ctx: { objectKey: string; record: Record<string, any>; matchedFields: MatchField[] },
): string {
  const obj = getObject(ctx.objectKey);
  const labels = ctx.matchedFields
    .map((f) => obj?.fields.find((x) => x.key === f.field_key)?.label || f.field_key)
    .join(", ");
  return (template || "")
    .replace(/\{\{\s*match\s*\}\}/g, recordLabel(ctx.objectKey, ctx.record))
    .replace(/\{\{\s*field\s*\}\}/g, labels)
    .replace(/\{\{\s*field\.([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => norm(ctx.record[key]) || "—")
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => (key in ctx.record ? norm(ctx.record[key]) || "—" : m));
}

export async function fetchDuplicateRules(objectKey: string): Promise<DuplicateRule[]> {
  const { data, error } = await (supabase as any)
    .from("duplicate_rules")
    .select("*")
    .eq("object_key", objectKey)
    .eq("is_active", true);
  if (error) throw error;
  return (data || []) as DuplicateRule[];
}

/** Run all active rules for an object against the values being saved. */
export async function findDuplicates(
  objectKey: string,
  values: Record<string, any>,
  opts: { excludeId?: string | null } = {},
): Promise<DuplicateMatch[]> {
  const obj = getObject(objectKey);
  if (!obj) return [];
  let rules: DuplicateRule[] = [];
  try {
    rules = await fetchDuplicateRules(objectKey);
  } catch {
    return [];
  }
  if (rules.length === 0) return [];

  const results: DuplicateMatch[] = [];
  for (const rule of rules) {
    const fields = (rule.match_fields || []).filter((f) => norm(values[f.field_key]));
    if (fields.length === 0) continue;

    const orFilters = fields.map((f) => {
      const v = String(values[f.field_key]).trim().replace(/[,()]/g, " ");
      return f.matchType === "exact" ? `${f.field_key}.eq.${v}` : `${f.field_key}.ilike.%${v}%`;
    });

    const { data } = await (supabase as any)
      .from(obj.table)
      .select("*")
      .or(orFilters.join(","))
      .limit(20);

    for (const record of (data || []) as Record<string, any>[]) {
      if (opts.excludeId && record.id === opts.excludeId) continue;
      const matchedFields = evaluateRecord(rule, values, record);
      if (!matchedFields || matchedFields.length === 0) continue;
      const blocking = matchedFields.some((f) => f.severity === "block");
      results.push({
        rule,
        record,
        matchedFields,
        severity: blocking || rule.notification?.severity === "error" ? "block" : "alert",
        title: rule.notification?.title || "Possible duplicate found",
        message: renderTemplate(rule.notification?.message || "", { objectKey, record, matchedFields }),
      });
    }
  }
  return results;
}
