import { describe, it, expect } from "vitest";
import { rollUpServiceField, isRollUpOf, nextRollUpValue } from "./procedureRollup";

// Rathish Kumar, 25/09/2026 - the visit that was reported.
const RATHISH = [
  { service_name: "Scar Remodelling", procedure_notes: "Additional 2-3 sessions-once in 3 months", recommendations: "" },
  { service_name: "FILLERS", procedure_notes: "One of the best anti-aging treatments...", recommendations: "1v2" },
];

describe("rollUpServiceField", () => {
  it("does not prefix a single service line", () => {
    expect(rollUpServiceField([{ service_name: "FILLERS", recommendations: "1v2" }], "recommendations")).toBe("1v2");
  });

  it("prefixes each line once there is more than one service", () => {
    expect(rollUpServiceField(RATHISH, "recommendations")).toBe("FILLERS: 1v2");
    expect(rollUpServiceField(RATHISH, "procedure_notes")).toBe(
      "Scar Remodelling: Additional 2-3 sessions-once in 3 months\n\nFILLERS: One of the best anti-aging treatments...",
    );
  });

  it("skips lines with nothing in that field", () => {
    expect(rollUpServiceField(RATHISH, "recommendations")).not.toContain("Scar Remodelling");
  });

  it("is empty when no line carries the field", () => {
    expect(rollUpServiceField([{ service_name: "FILLERS" }], "recommendations")).toBe("");
    expect(rollUpServiceField([], "recommendations")).toBe("");
  });

  it("survives null fields rather than printing them", () => {
    expect(rollUpServiceField([{ service_name: null, recommendations: null }], "recommendations")).toBe("");
  });
});

describe("isRollUpOf", () => {
  it("recognises the reported case as a duplicate, which the old comparison could not", () => {
    // The old guard compared the raw line ("1v2") against the parent
    // ("FILLERS: 1v2") and never matched, so the box showed the same text twice.
    expect(isRollUpOf("FILLERS: 1v2", RATHISH, "recommendations")).toBe(true);
  });

  it("treats blank as nothing worth keeping", () => {
    expect(isRollUpOf("", RATHISH, "recommendations")).toBe(true);
    expect(isRollUpOf(null, RATHISH, "recommendations")).toBe(true);
  });

  it("protects text the lines do not account for", () => {
    // Salesforce's Special Instructions, on 17,581 imported visits.
    expect(isRollUpOf("Apply sunscreen twice daily", RATHISH, "recommendations")).toBe(false);
  });

  it("ignores surrounding whitespace rather than calling it different", () => {
    expect(isRollUpOf("  FILLERS: 1v2  ", RATHISH, "recommendations")).toBe(true);
  });
});

describe("nextRollUpValue", () => {
  it("re-rolls when the stored value was only ever the lines", () => {
    const lines = [RATHISH[0], { ...RATHISH[1], recommendations: "2v3" }];
    expect(nextRollUpValue("FILLERS: 1v2", RATHISH, lines, "recommendations", "ignored")).toBe("FILLERS: 2v3");
  });

  it("fills in a blank", () => {
    expect(nextRollUpValue("", RATHISH, RATHISH, "recommendations", "ignored")).toBe("FILLERS: 1v2");
  });

  it("saves what was typed into the box when the parent holds its own text", () => {
    // The box is only on screen in this case, and it used to be recomputed from
    // the lines regardless - a textarea that accepted typing and discarded it.
    const imported = "Apply sunscreen twice daily";
    expect(nextRollUpValue(imported, RATHISH, RATHISH, "recommendations", "Apply sunscreen twice daily, and at noon"))
      .toBe("Apply sunscreen twice daily, and at noon");
  });

  it("keeps imported text that nobody edited", () => {
    const imported = "Apply sunscreen twice daily";
    expect(nextRollUpValue(imported, RATHISH, RATHISH, "recommendations", imported)).toBe(imported);
  });

  it("does not grow the prefix when saved repeatedly", () => {
    let stored = rollUpServiceField(RATHISH, "recommendations");
    for (let i = 0; i < 5; i++) stored = nextRollUpValue(stored, RATHISH, RATHISH, "recommendations", stored);
    expect(stored).toBe("FILLERS: 1v2");
  });

  it("keeps a visit's notes when the doctor only edits one line's recommendation", () => {
    const imported = "Seen for follow up, lesion improving";
    const lines = [RATHISH[0], { ...RATHISH[1], recommendations: "2v3" }];
    expect(nextRollUpValue(imported, RATHISH, lines, "procedure_notes", imported)).toBe(imported);
  });
});

// The printed prescription draws its own Special Instructions block from the
// same parent column, using a mirror of this rule in
// supabase/functions/generate-prescription-pdf/procedureRollup.ts. Its guard
// had the identical off-by-a-prefix bug, so "1v2" printed twice: once in the
// Procedure Details table and again under Special Instructions.
describe("the printed prescription's Special Instructions block", () => {
  const skipsBlock = (parent: string, lines: typeof RATHISH) => isRollUpOf(parent, lines, "recommendations");

  it("is skipped on the reported two-service visit", () => {
    expect(skipsBlock("FILLERS: 1v2", RATHISH)).toBe(true);
  });

  it("is skipped when several lines carry a recommendation", () => {
    const lines = [
      { service_name: "REVLITE LASER TONING B", recommendations: "4 sessions -once in a week " },
      { service_name: "RADIANCE A", recommendations: "4 sessions -once in 2 weeks " },
    ];
    // Trailing spaces are real in this data; the comparison trims both sides.
    expect(skipsBlock(
      "REVLITE LASER TONING B: 4 sessions -once in a week \n\nRADIANCE A: 4 sessions -once in 2 weeks ",
      lines as typeof RATHISH,
    )).toBe(true);
  });

  it("still prints genuine Salesforce instructions the lines do not carry", () => {
    expect(skipsBlock("Review after 6 weeks", RATHISH)).toBe(false);
    expect(skipsBlock("single session today", RATHISH)).toBe(false);
  });

  it("is skipped on a single-service visit, as it already was", () => {
    expect(skipsBlock("1v2", [{ service_name: "FILLERS", recommendations: "1v2" }] as typeof RATHISH)).toBe(true);
  });
});
