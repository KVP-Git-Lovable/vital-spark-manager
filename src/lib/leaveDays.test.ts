import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HALF_SESSIONS, canBeHalfDay, leaveDayLabel, leaveDays } from "./leaveDays";

/**
 * What a leave application is worth, in days.
 *
 * This is the number a staff member's balance is reduced by when the leave is
 * approved, so a wrong answer here is a wrong allowance for the rest of the
 * year. Before this, the page subtracted one date from the other inline and
 * could only ever produce whole days.
 */

describe("leaveDays", () => {
  it("counts a single date as one day", () => {
    expect(leaveDays("2026-12-02", "2026-12-02", null)).toBe(1);
  });

  it("counts a half day as half, whichever half it is", () => {
    expect(leaveDays("2026-12-02", "2026-12-02", "first")).toBe(0.5);
    expect(leaveDays("2026-12-02", "2026-12-02", "second")).toBe(0.5);
  });

  it("counts a span inclusively, as the clinic always has", () => {
    expect(leaveDays("2026-12-02", "2026-12-04", null)).toBe(3);
    expect(leaveDays("2026-12-01", "2026-12-31", null)).toBe(31);
  });

  it("will not charge half a day for a week off", () => {
    // A session left behind by someone moving the end date after choosing
    // "First half" must not turn three days into half of one.
    expect(leaveDays("2026-12-02", "2026-12-04", "first")).toBe(3);
  });

  it("counts across a month and a year boundary", () => {
    expect(leaveDays("2026-11-30", "2026-12-01", null)).toBe(2);
    expect(leaveDays("2026-12-31", "2027-01-01", null)).toBe(2);
  });

  it("counts across the end of March, when the clocks do not move here but the month is short", () => {
    expect(leaveDays("2026-02-27", "2026-03-01", null)).toBe(3); // 2026 is not a leap year
  });

  it("returns nothing usable when a date is missing or malformed", () => {
    // The page's own guard turns this into "Select dates" / "End date must be
    // after start date"; what matters is that it never returns a silent 1.
    expect(leaveDays("", "2026-12-02", null)).toBe(0);
    expect(leaveDays("2026-12-02", "", null)).toBe(0);
    expect(leaveDays("02/12/2026", "02/12/2026", null)).toBe(0);
  });

  it("goes non-positive when the end is before the start, so the page can refuse it", () => {
    expect(leaveDays("2026-12-04", "2026-12-02", null)).toBeLessThanOrEqual(0);
  });
});

describe("canBeHalfDay", () => {
  it("is true only for one date chosen twice", () => {
    expect(canBeHalfDay("2026-12-02", "2026-12-02")).toBe(true);
  });

  it("is false for a range, and while either box is still empty", () => {
    expect(canBeHalfDay("2026-12-02", "2026-12-03")).toBe(false);
    expect(canBeHalfDay("2026-12-02", "")).toBe(false);
    expect(canBeHalfDay("", "")).toBe(false);
  });
});

describe("leaveDayLabel", () => {
  it("says which half, because a bare 0.5 leaves the approver guessing", () => {
    expect(leaveDayLabel(0.5, "first")).toBe("0.5 — first half");
    expect(leaveDayLabel(0.5, "second")).toBe("0.5 — second half");
  });

  it("leaves a whole day alone", () => {
    expect(leaveDayLabel(1, null)).toBe("1");
    expect(leaveDayLabel(3, undefined)).toBe("3");
    expect(leaveDayLabel("12", null)).toBe("12");
  });

  it("ignores a session it does not recognise rather than printing it", () => {
    expect(leaveDayLabel(1, "morning")).toBe("1");
    expect(leaveDayLabel(1, "")).toBe("1");
  });

  it("offers exactly the two halves the database will accept", () => {
    // The check constraint is `half_session in ('first','second')`; a third
    // option here would be refused on insert.
    expect(HALF_SESSIONS.map((s) => s.value)).toEqual(["first", "second"]);
  });
});

describe("the leave page", () => {
  /* Comments stripped, the way the five existing readers of this file do it,
     so an assertion cannot pass on prose. */
  const page = () =>
    readFileSync("src/pages/LeaveManagement.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  it("opens a calendar on every date box", () => {
    // Three: leave start, leave end, and the attendance correction date.
    expect((page().match(/<DateInput withCalendar/g) ?? []).length).toBe(3);
    expect(page()).not.toMatch(/<DateInput\s+className/);
  });

  it("works the days out through the tested helper, not inline", () => {
    const src = page();
    expect(src).toContain("const days = leaveDays(appStartDate, appEndDate, half);");
    // The inline subtraction this replaced could only ever yield whole days.
    expect(src).not.toMatch(/Math\.ceil\(\(end\.getTime\(\) - start\.getTime\(\)\)/);
  });

  it("records which half, and only on a single date", () => {
    const src = page();
    expect(src).toContain("const half = canBeHalfDay(appStartDate, appEndDate) ? appHalfSession : null;");
    expect(src).toContain("half_session: half,");
    expect(src).toContain("{canBeHalfDay(appStartDate, appEndDate) && (");
  });

  it("forgets a chosen half when either date moves", () => {
    // Otherwise a half day picked first, then widened to a range, is charged
    // against the wrong span.
    const src = page();
    expect((src.match(/setAppHalfSession\(null\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("shows the approver which half, in both tables", () => {
    const src = page();
    expect(src).toContain("{leaveDayLabel(a.days, a.half_session)}");
    expect(src).toContain("{leaveDayLabel(app.days, app.half_session)}");
  });
});

describe("the migration behind it", () => {
  /* The `--` preamble explains the change in prose, and prose that says
     "nothing renamed" must not read as a rename. */
  const sql = readFileSync("supabase/migrations/20261126120000_half_day_leave.sql", "utf8")
    .replace(/^\s*--.*$/gm, "");

  it("adds the column without breaking the build the clinic is running", () => {
    // AGENTS.md: a schema change must keep the CURRENTLY PUBLISHED build
    // working with no deploy. Nullable, no default, nothing renamed.
    expect(sql).toMatch(/add column if not exists half_session text;/);
    expect(sql).not.toMatch(/not null/i);
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/rename/i);
  });

  it("lets the database refuse anything but the two halves", () => {
    expect(sql).toMatch(/check \(half_session is null or half_session in \('first', 'second'\)\)/);
  });
});
