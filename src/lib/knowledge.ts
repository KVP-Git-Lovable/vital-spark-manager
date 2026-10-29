import type { Tables } from "@/integrations/supabase/types";

export type KnowledgeArticle = Tables<"knowledge_articles">;
export const clinicalFields = [
  ["clinical_protocol", "Clinical protocol"],
  ["contraindications", "Contraindications & safety"],
  ["pre_post_care", "Pre / post-procedure care"],
  ["complications_management", "Complication management"],
  ["sources", "References & evidence"],
] as const;
export type ClinicalField = typeof clinicalFields[number][0];
export function ageInYears(dob: string | null | undefined, today = new Date()): number | null {
  if (!dob) return null;
  const [year, month, day] = dob.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) return null;
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}
export function matchesDemographics(article: Pick<KnowledgeArticle, "gender" | "age_rule" | "min_age" | "max_age">, age: number | null, gender: string | null | undefined) {
  if (article.gender !== "both" && article.gender !== gender?.trim().toLowerCase()) return false;
  return article.age_rule === "all_ages" || (age !== null && article.min_age !== null && article.max_age !== null && age >= article.min_age && age <= article.max_age);
}
export function targetLabel(article: Pick<KnowledgeArticle, "gender" | "age_rule" | "min_age" | "max_age">) {
  return `${article.age_rule === "all_ages" ? "All ages" : `${article.min_age}–${article.max_age} years`} · ${article.gender === "both" ? "All genders" : article.gender}`;
}
export function appendCare(existing: string, care: string) {
  return [existing.trim(), care.trim()].filter(Boolean).join("\n\n");
}