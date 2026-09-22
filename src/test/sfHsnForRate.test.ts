import { describe, it, expect } from "vitest";
import {
  HSN_EXEMPT,
  HSN_SERVICES_5,
  hsnForRate,
} from "../../supabase/functions/sf-import-clinical/hsnForRate";

/**
 * The HSN column printed blank on every bill because the import hardcoded
 * `hsn: ""`. The codes live in the clinic's Tax Master and are identified by
 * their rate.
 */
describe("hsnForRate", () => {
  it("gives the exempt code for a consultation at 0%", () => {
    expect(hsnForRate(0)).toBe(HSN_EXEMPT);
    expect(hsnForRate("0")).toBe(HSN_EXEMPT);
  });

  it("gives the services code at 5%", () => {
    expect(hsnForRate(5)).toBe(HSN_SERVICES_5);
    expect(hsnForRate("5")).toBe(HSN_SERVICES_5);
  });

  it("leaves 18% blank rather than guessing a code", () => {
    // 30,682 bills before the Sept 2025 rate change. The Tax Master has no code
    // at 18%; a wrong HSN on a tax invoice is worse than a visibly empty one.
    expect(hsnForRate(18)).toBe("");
  });

  it("leaves anything unrecognised or missing blank", () => {
    expect(hsnForRate(12)).toBe("");
    expect(hsnForRate(null)).toBe("");
    expect(hsnForRate(undefined)).toBe("");
    expect(hsnForRate("abc")).toBe("");
  });
});
