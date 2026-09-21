import { describe, it, expect } from "vitest";
import { DEFAULT_VIEW_COLUMNS, PATIENT_FIELDS, formatCell } from "./patientFields";

describe("Patients list default columns", () => {
  it("does not lead with Skin Type, which nothing fills in", () => {
    // App-only field: all 27,081 patients have it blank, so as a default column
    // it rendered a full page of dashes.
    expect(DEFAULT_VIEW_COLUMNS).not.toContain("skin_type");
  });

  it("shows the visit count instead", () => {
    expect(DEFAULT_VIEW_COLUMNS).toContain("total_visits");
  });

  it("keeps Skin Type available, so a saved view can still add it back", () => {
    expect(PATIENT_FIELDS.map((f) => f.key)).toContain("skin_type");
  });

  it("only names columns that are real fields", () => {
    const known = new Set(PATIENT_FIELDS.map((f) => f.key));
    for (const key of DEFAULT_VIEW_COLUMNS) expect(known.has(key), key).toBe(true);
  });
});

describe("Visit count cell", () => {
  it("prints a zero rather than a dash", () => {
    // 8,083 patients are registered but have never been in. That is a real
    // answer and reads differently from "we don't know", so a falsy check here
    // would misreport a third of the list.
    expect(formatCell({ total_visits: 0 }, "total_visits")).toBe("0");
  });

  it("prints the count when there is one", () => {
    expect(formatCell({ total_visits: 91 }, "total_visits")).toBe("91");
  });

  it("dashes only when the count is genuinely unknown", () => {
    expect(formatCell({ total_visits: null }, "total_visits")).toBe("—");
    expect(formatCell({}, "total_visits")).toBe("—");
  });
});
