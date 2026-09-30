import { describe, it, expect } from "vitest";
import { looksLikeInvestigation } from "./investigationAsService";

/** Taken from the clinic's own appointments. */
const HISTORY =
  "2Rx Revlite laser toning for fine hair (Face) last session on 27/2/2026 + 4rx Bikini Hair Reduction last session on 1/4/2026 +  5rx Bikini Hair Reduction last session on 13/06/2026";

describe("looksLikeInvestigation", () => {
  it("catches a service column holding the Investigation word for word", () => {
    // 264 appointments in 90 days look exactly like this.
    expect(looksLikeInvestigation(HISTORY, HISTORY)).toBe(true);
  });

  it("catches a service column holding part of the Investigation", () => {
    const service =
      "2Rx Revlite laser toning for fine hair (Face) last session on 27/2/2026 + 4rx Bikini Hair Reduction last session on 1/4/2026";
    expect(looksLikeInvestigation(service, HISTORY)).toBe(true);
  });

  it("also reports a real service that sits inside a longer Investigation", () => {
    // 485 appointments do this. The form still fills them in - it matches the
    // name against the Service Master once that loads, which is the right way
    // round, with the service's id, notes and price.
    expect(looksLikeInvestigation("HYDRA CLEAN UP", "HYDRA CLEAN UP + 2rx peel")).toBe(true);
  });

  it("leaves a service the clinic typed alone when the visit has no Investigation", () => {
    expect(looksLikeInvestigation("RF under EMLA", null)).toBe(false);
    expect(looksLikeInvestigation("Needling under EMLA", "")).toBe(false);
  });

  it("leaves a service that is nothing like the Investigation alone", () => {
    expect(looksLikeInvestigation("HYDRADELUXE", "New Consult")).toBe(false);
  });

  it("does not mind case or extra spacing", () => {
    expect(looksLikeInvestigation("  hydra   clean up ", "HYDRA CLEAN UP + 2rx peel")).toBe(true);
  });

  it("says no when there is no service to judge", () => {
    expect(looksLikeInvestigation("", HISTORY)).toBe(false);
    expect(looksLikeInvestigation(null, HISTORY)).toBe(false);
  });
});
