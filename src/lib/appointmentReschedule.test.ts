import { describe, it, expect } from "vitest";
import { rescheduleVerdict, rescheduleWarning } from "./appointmentReschedule";

/** Today, for every case below. */
const NOW = new Date(2026, 9, 1, 11, 30);
const SEP_25 = new Date(2026, 8, 25, 12, 45).toISOString();
const OCT_2 = new Date(2026, 9, 2, 12, 45).toISOString();
const OCT_8 = new Date(2026, 9, 8, 12, 45).toISOString();
const BILLED = { hasInvoice: true };

describe("rescheduleVerdict", () => {
  it("asks before writing next week's booking over last week's visit", () => {
    // Tahniya: seen 25 Sep, billed ₹3,000, moved to 2 Oct without a word.
    expect(rescheduleVerdict({ start_time: SEP_25 }, OCT_2, BILLED, NOW)).toBe("confirm");
  });

  it("asks when the visit has clinical notes rather than a bill", () => {
    expect(rescheduleVerdict({ start_time: SEP_25 }, OCT_2, { hasProcedure: true }, NOW)).toBe("confirm");
  });

  it("lets a future booking move, which is the ordinary case", () => {
    expect(rescheduleVerdict({ start_time: OCT_2 }, OCT_8, BILLED, NOW)).toBe("allow");
  });

  it("lets the time of a past visit be corrected on its own day", () => {
    const sameDayLater = new Date(2026, 8, 25, 17, 0).toISOString();
    expect(rescheduleVerdict({ start_time: SEP_25 }, sameDayLater, BILLED, NOW)).toBe("allow");
  });

  it("lets a past slot nobody turned up to be reused", () => {
    expect(rescheduleVerdict({ start_time: SEP_25 }, OCT_2, {}, NOW)).toBe("allow");
  });

  it("says nothing when there is no date to judge", () => {
    expect(rescheduleVerdict({ start_time: null }, OCT_2, BILLED, NOW)).toBe("allow");
    expect(rescheduleVerdict(null, OCT_2, BILLED, NOW)).toBe("allow");
    expect(rescheduleVerdict({ start_time: SEP_25 }, null, BILLED, NOW)).toBe("allow");
    expect(rescheduleVerdict({ start_time: "not a date" }, OCT_2, BILLED, NOW)).toBe("allow");
  });

  it("takes a Date as readily as a string", () => {
    expect(rescheduleVerdict({ start_time: SEP_25 }, new Date(OCT_2), BILLED, NOW)).toBe("confirm");
  });
});

describe("rescheduleWarning", () => {
  it("names what would be lost", () => {
    expect(rescheduleWarning({ hasInvoice: true })).toContain("bill");
    expect(rescheduleWarning({ hasProcedure: true })).toContain("clinical notes");
    expect(rescheduleWarning({ hasInvoice: true, hasProcedure: true })).toContain("bill and clinical notes");
  });
});
