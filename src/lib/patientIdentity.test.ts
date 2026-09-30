import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { patientAgeLabel, patientIdentityLine } from "./patientIdentity";

/** Fixed, so an age never depends on the day the tests happen to run. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("patientAgeLabel", () => {
  it("reads as plain years", () => {
    expect(patientAgeLabel("1992-04-10")).toBe("34 yrs");
  });

  it("says one year in the singular", () => {
    expect(patientAgeLabel("2025-04-10")).toBe("1 yr");
  });

  it("does not call an infant 0 yrs", () => {
    expect(patientAgeLabel("2026-06-01")).toBe("<1 yr");
  });

  it("is blank when no date of birth was recorded", () => {
    expect(patientAgeLabel(null)).toBe("");
    expect(patientAgeLabel("")).toBe("");
    expect(patientAgeLabel("not a date")).toBe("");
  });
});

describe("patientIdentityLine", () => {
  it("shows both, which is what the doctor asked for", () => {
    expect(patientIdentityLine({ date_of_birth: "1992-04-10", gender: "Female" })).toBe("34 yrs · Female");
  });

  it("shows whichever half is known", () => {
    expect(patientIdentityLine({ date_of_birth: "1992-04-10", gender: null })).toBe("34 yrs");
    expect(patientIdentityLine({ date_of_birth: null, gender: "Male" })).toBe("Male");
  });

  it("is blank rather than a row of dashes when neither is recorded", () => {
    expect(patientIdentityLine({ date_of_birth: null, gender: "  " })).toBe("");
    expect(patientIdentityLine(null)).toBe("");
    expect(patientIdentityLine({})).toBe("");
  });
});
