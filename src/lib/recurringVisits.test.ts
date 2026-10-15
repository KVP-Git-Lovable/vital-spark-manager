import { describe, it, expect } from "vitest";
import { clearVisitAt, joinVisitDateTime, removeVisitAt, splitVisitDateTime } from "./recurringVisits";

describe("splitVisitDateTime", () => {
  it("separates the day from the clock", () => {
    expect(splitVisitDateTime("2026-10-21T14:30")).toEqual({ date: "2026-10-21", time: "14:30" });
  });

  it("drops seconds a stored value may carry", () => {
    expect(splitVisitDateTime("2026-10-21T14:30:00")).toEqual({ date: "2026-10-21", time: "14:30" });
  });

  it("handles an empty visit", () => {
    expect(splitVisitDateTime("")).toEqual({ date: "", time: "" });
    expect(splitVisitDateTime(null)).toEqual({ date: "", time: "" });
  });
});

describe("joinVisitDateTime", () => {
  it("puts the halves back together", () => {
    expect(joinVisitDateTime("2026-10-21", "14:30")).toBe("2026-10-21T14:30");
  });

  it("is no visit at all without a date", () => {
    // A time on its own would save as an unparseable date.
    expect(joinVisitDateTime("", "14:30")).toBe("");
    expect(joinVisitDateTime("   ", "14:30")).toBe("");
  });

  it("opens at nine rather than midnight when only a date is given", () => {
    expect(joinVisitDateTime("2026-10-21", "")).toBe("2026-10-21T09:00");
  });
});

describe("clearVisitAt", () => {
  it("empties one visit and leaves the others alone", () => {
    expect(clearVisitAt(
      { dates: ["2026-10-21T09:00", "2026-11-04T09:00"], investigations: ["2nd session", "review"] },
      0,
    )).toEqual({ dates: ["", "2026-11-04T09:00"], investigations: ["", "review"] });
  });
});

describe("removeVisitAt", () => {
  it("takes the date and its own investigation out together", () => {
    // The hazard this exists for: splice one list and the visit below inherits
    // somebody else's investigation.
    expect(removeVisitAt(
      { dates: ["d1", "d2", "d3"], investigations: ["i1", "i2", "i3"] },
      1,
    )).toEqual({ dates: ["d1", "d3"], investigations: ["i1", "i3"] });
  });

  it("works when fewer investigations have been typed than there are dates", () => {
    expect(removeVisitAt({ dates: ["d1", "d2", "d3"], investigations: ["i1"] }, 0))
      .toEqual({ dates: ["d2", "d3"], investigations: ["", ""] });
  });

  it("keeps the pairing when the last visit goes", () => {
    expect(removeVisitAt({ dates: ["d1", "d2"], investigations: ["i1", "i2"] }, 1))
      .toEqual({ dates: ["d1"], investigations: ["i1"] });
  });
});
