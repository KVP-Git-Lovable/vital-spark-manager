import { describe, it, expect } from "vitest";
import { stampCaption, captionFontSize, stampTimeOrOriginal } from "./stampPhoto";

describe("stampCaption", () => {
  it("reads dd/mm/yyyy with a 12-hour clock, as the rest of the clinic does", () => {
    expect(stampCaption(new Date(2026, 10, 2, 9, 42))).toBe("02/11/2026 · 09:42 AM");
  });

  it("pads the day, month, hour and minute so the band never jumps width", () => {
    expect(stampCaption(new Date(2026, 0, 5, 8, 7))).toBe("05/01/2026 · 08:07 AM");
  });

  it("gets the two times a 12-hour clock usually gets wrong", () => {
    // Midnight is 12 AM and noon is 12 PM - not 00 and not 12 AM.
    expect(stampCaption(new Date(2026, 10, 2, 0, 5))).toContain("12:05 AM");
    expect(stampCaption(new Date(2026, 10, 2, 12, 5))).toContain("12:05 PM");
  });

  it("puts the afternoon in the afternoon", () => {
    expect(stampCaption(new Date(2026, 10, 2, 18, 30))).toContain("06:30 PM");
    expect(stampCaption(new Date(2026, 10, 2, 23, 59))).toContain("11:59 PM");
  });
});

describe("captionFontSize", () => {
  it("scales with the picture, so it reads the same on any phone", () => {
    expect(captionFontSize(1280)).toBeGreaterThan(captionFontSize(640));
  });

  it("never goes so small it cannot be read", () => {
    // A tiny upload used to produce one-pixel text, which is no caption at all.
    expect(captionFontSize(100)).toBeGreaterThanOrEqual(11);
    expect(captionFontSize(0)).toBeGreaterThanOrEqual(11);
  });
});

describe("stampTimeOrOriginal", () => {
  it("hands back the original photo rather than throwing", async () => {
    // jsdom has no real canvas, so stamping fails here exactly as it would on
    // a phone whose canvas is unavailable. A caption is worth having; it is
    // not worth refusing somebody's attendance over, so the photo must still
    // come back.
    const original = new Blob(["not really a jpeg"], { type: "image/jpeg" });
    const out = await stampTimeOrOriginal(original, new Date(2026, 10, 2, 9, 42));
    expect(out).toBe(original);
  });
});
