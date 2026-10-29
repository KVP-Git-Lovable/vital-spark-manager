import { describe, it, expect } from "vitest";
import { ageInYears, matchesDemographics, appendCare, cloneArticle, resourceSchema, suggestedArticleTitle, revisionChanges, type KnowledgeArticle } from "./knowledge";
const range = { gender: "female", age_rule: "custom_range", min_age: 20, max_age: 40 };
describe("service knowledge targeting", () => {
  it("includes both age boundaries", () => {
    expect(matchesDemographics(range, 20, "Female")).toBe(true);
    expect(matchesDemographics(range, 40, "female")).toBe(true);
    expect(matchesDemographics(range, 19, "female")).toBe(false);
    expect(matchesDemographics(range, 41, "female")).toBe(false);
  });
  it("requires the matching gender", () => {
    expect(matchesDemographics(range, 25, "male")).toBe(false);
    expect(matchesDemographics(range, 25, null)).toBe(false);
    expect(matchesDemographics({ ...range, gender: "both" }, 25, "male")).toBe(true);
  });
  it("unknown age matches only all ages", () => {
    expect(matchesDemographics(range, null, "female")).toBe(false);
    expect(matchesDemographics({ ...range, age_rule: "all_ages", gender: "both" }, null, null)).toBe(true);
  });
  it("calculates age at birthday without rounding", () => {
    expect(ageInYears("2006-10-30", new Date(2026, 9, 29))).toBe(19);
    expect(ageInYears("2006-10-29", new Date(2026, 9, 29))).toBe(20);
    expect(ageInYears("2006-02-31")).toBeNull();
  });
  it("keeps existing prescription text when care is explicitly copied", () => {
    expect(appendCare("Existing instructions", "Reviewed care")).toBe("Existing instructions\n\nReviewed care");
  });
});
describe("knowledge resources and management", () => {
  it("permits web and video resources but rejects unsafe protocols", () => {
    expect(resourceSchema.safeParse({ id: "r", kind: "video", title: "Guide", url: "https://example.org/video" }).success).toBe(true);
    expect(resourceSchema.safeParse({ id: "r", kind: "link", title: "Guide", url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("suggests service - age - gender titles", () => {
    expect(suggestedArticleTitle("Skin Biopsy", range)).toBe("Skin Biopsy - 20–40 years - female");
    expect(suggestedArticleTitle("Skin Biopsy", { ...range, age_rule: "all_ages", gender: "both" })).toBe("Skin Biopsy - All ages - All genders");
  });
  it("clones a published article only as an inactive unreviewed draft", () => {
    const clone = cloneArticle({ id: "original", status: "published", is_active: true, reviewed_by: "doctor", revision: 8, title: "Biopsy", resources: [] } as unknown as KnowledgeArticle);
    expect(clone.status).toBe("draft"); expect(clone.is_active).toBe(false);
    expect(clone).not.toHaveProperty("id"); expect(clone).not.toHaveProperty("reviewed_by"); expect(clone).not.toHaveProperty("revision");
  });
  it("tracks before and after values without audit-only noise", () => {
    expect(revisionChanges({ summary: "Old", updated_at: "Yesterday" }, { summary: "New", updated_at: "Today" })).toEqual({ summary: { before: "Old", after: "New" } });
  });
});