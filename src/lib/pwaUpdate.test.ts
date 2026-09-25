import { describe, it, expect } from "vitest";
import { updateActionFor, UPDATE_AT_LOAD_GRACE_MS, UPDATE_CHECK_INTERVAL_MS } from "./pwaUpdate";

describe("updateActionFor", () => {
  it("applies a build that was already waiting when the page loaded", () => {
    // Nothing is typed a moment after registration, so there is nothing to lose.
    expect(updateActionFor(0)).toBe("apply");
    expect(updateActionFor(2_000)).toBe("apply");
    expect(updateActionFor(UPDATE_AT_LOAD_GRACE_MS)).toBe("apply");
  });

  it("asks about a build that turns up mid-session", () => {
    expect(updateActionFor(UPDATE_AT_LOAD_GRACE_MS + 1)).toBe("ask");
    expect(updateActionFor(60_000)).toBe("ask");
    expect(updateActionFor(8 * 60 * 60 * 1000)).toBe("ask");
  });

  it("never silently reloads a tab that has been open a while", () => {
    // The whole point of asking: a long-open tab is someone's working session.
    expect(updateActionFor(UPDATE_CHECK_INTERVAL_MS)).toBe("ask");
  });

  it("treats a clock that went backwards as a fresh load rather than interrupting", () => {
    expect(updateActionFor(-1_000)).toBe("apply");
  });

  it("checks often enough that an all-day tab still finds an update", () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(UPDATE_CHECK_INTERVAL_MS).toBeGreaterThan(0);
  });
});
