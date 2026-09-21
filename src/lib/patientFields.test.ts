import { describe, it, expect } from "vitest";
import { DEFAULT_VIEW_COLUMNS, PATIENT_FIELDS, formatCell } from "./patientFields";

describe("Patients list default columns", () => {
  it("does not lead with Skin Type, which nothing fills in", () => {
    // App-only field: all 27,081 patients have it blank, so as a default column
    // it rendered a full page of dashes.
    expect(DEFAULT_VIEW_COLUMNS).not.toContain("skin_type");
  });

  it("shows email, the best-filled field left, beside the phone number", () => {
    expect(DEFAULT_VIEW_COLUMNS).toContain("email");
    // Next to each other, the two make the row a complete contact card.
    const cols = DEFAULT_VIEW_COLUMNS;
    expect(cols.indexOf("email")).toBe(cols.indexOf("phone") + 1);
  });

  it("dates the row by when the patient registered, not when we imported them", () => {
    // created_at is an import date for 98% of patients - 17,242 of them share
    // one - so as a column it says nothing true about the patient.
    expect(DEFAULT_VIEW_COLUMNS).toContain("registered_at");
    expect(DEFAULT_VIEW_COLUMNS).not.toContain("created_at");
  });

  it("keeps Created Date available, since it is still the truth about the row", () => {
    expect(PATIENT_FIELDS.map((f) => f.key)).toContain("created_at");
  });

  it("keeps Skin Type available, so a saved view can still add it back", () => {
    expect(PATIENT_FIELDS.map((f) => f.key)).toContain("skin_type");
  });

  it("only names columns that are real fields", () => {
    const known = new Set(PATIENT_FIELDS.map((f) => f.key));
    for (const key of DEFAULT_VIEW_COLUMNS) expect(known.has(key), key).toBe(true);
  });
});

describe("Email cell", () => {
  it("shows the address when there is one", () => {
    expect(formatCell({ email: "a@b.com" }, "email")).toBe("a@b.com");
  });

  it("dashes when there is none, rather than printing an empty cell", () => {
    // ~39% of patients have no email, so this is the common case, not an edge one.
    expect(formatCell({ email: null }, "email")).toBe("—");
    expect(formatCell({ email: "" }, "email")).toBe("—");
    expect(formatCell({}, "email")).toBe("—");
  });
});
