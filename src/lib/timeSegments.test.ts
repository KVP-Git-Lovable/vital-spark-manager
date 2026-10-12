import { describe, it, expect } from "vitest";
import { hourAdvances, clearsWholeTime } from "./timeSegments";

describe("hourAdvances", () => {
  it("moves on once the hour is two digits", () => {
    expect(hourAdvances("10")).toBe(true);
    expect(hourAdvances("12")).toBe(true);
  });

  it("moves on from a digit nothing can follow", () => {
    // On a twelve-hour clock only 1 begins a two-digit hour, so 2 to 9 are
    // already the whole hour and the minutes are where the next digit goes.
    expect(hourAdvances("2")).toBe(true);
    expect(hourAdvances("9")).toBe(true);
  });

  it("waits on a digit that could still be the start of one", () => {
    expect(hourAdvances("1")).toBe(false);
    expect(hourAdvances("0")).toBe(false);
  });

  it("waits on an empty box", () => {
    expect(hourAdvances("")).toBe(false);
  });
});

describe("clearsWholeTime", () => {
  it("is only true once both halves are empty", () => {
    expect(clearsWholeTime("", "")).toBe(true);
    expect(clearsWholeTime("  ", "")).toBe(true);
  });

  it("is false while the other half still holds digits", () => {
    // Backspacing the hour used to wipe the minutes with it, and left behind
    // a half time that crashed the appointment screen.
    expect(clearsWholeTime("", "30")).toBe(false);
    expect(clearsWholeTime("11", "")).toBe(false);
  });
});
