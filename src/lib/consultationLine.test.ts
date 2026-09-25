import { describe, it, expect } from "vitest";
import { isConsultationService, isPlaceholderVisitService } from "./consultationLine";

describe("isConsultationService", () => {
  it("recognises the placeholder however it was typed", () => {
    expect(isConsultationService("Consultation")).toBe(true);
    expect(isConsultationService("consultation")).toBe(true);
    expect(isConsultationService("  CONSULTATION  ")).toBe(true);
  });

  it("leaves real services alone, including ones that mention consultation", () => {
    expect(isConsultationService("Consultation fee")).toBe(false);
    expect(isConsultationService("Cosmetic Consultation")).toBe(false);
    expect(isConsultationService("Online consultation")).toBe(false);
    expect(isConsultationService("Exion Arms (COSMETIC TREATMENT)")).toBe(false);
  });

  it("treats a missing name as not a consultation", () => {
    expect(isConsultationService("")).toBe(false);
    expect(isConsultationService(null)).toBe(false);
    expect(isConsultationService(undefined)).toBe(false);
  });
});

describe("isPlaceholderVisitService", () => {
  // Every value below is a real one from appointments.service, with its row
  // count at the time this was written.
  it.each([
    ["Consultation", 28507],
    ["consult", 2264],
    ["New Consult", 1915],
    ["New consult", 1778],
    ["new consult", 1700],
    ["Old consult", 1165],
    ["Old Consult", 1066],
    ["Consult", 663],
    ["Online consultation", 18],
    ["Old Consult (Review)", 18],
  ])("treats %s as a placeholder, not a service", (value) => {
    expect(isPlaceholderVisitService(value)).toBe(true);
  });

  it.each([
    // Real Service Master rows - these are billed, and must still pre-fill.
    "CONSULTATION - DR PUNYA SUVARNA",
    "CONSULTATION- DR VINDHYA PAI",
    "COSMETIC CONSULT",
    // Real work recorded alongside the visit word.
    "new consult+RF",
    "New Consult + RF",
    "New Consult +Fat Reduction",
    "PEEL TREATMENT",
  ])("leaves %s alone", (value) => {
    expect(isPlaceholderVisitService(value)).toBe(false);
  });

  it("handles nothing at all", () => {
    expect(isPlaceholderVisitService(null)).toBe(false);
    expect(isPlaceholderVisitService(undefined)).toBe(false);
    expect(isPlaceholderVisitService("   ")).toBe(false);
  });

  it("is a superset of isConsultationService", () => {
    for (const v of ["Consultation", "consultation", "  CONSULTATION  "]) {
      expect(isConsultationService(v)).toBe(true);
      expect(isPlaceholderVisitService(v)).toBe(true);
    }
  });
});
