import { describe, it, expect } from "vitest";
import { investigationText } from "./investigationText";

describe("investigationText", () => {
  it("prefers the investigation text over the resolved service name", () => {
    expect(
      investigationText({ reason_for_consultation: "PRP for hair fall", service: "Consultation" }),
    ).toBe("PRP for hair fall");
  });

  it("falls back to the service name when there is no investigation text", () => {
    expect(investigationText({ reason_for_consultation: null, service: "TATTOO REMOVAL" })).toBe(
      "TATTOO REMOVAL",
    );
    expect(investigationText({ reason_for_consultation: "", service: "RADIANCE A" })).toBe(
      "RADIANCE A",
    );
  });

  it("treats whitespace-only imported text as missing", () => {
    expect(investigationText({ reason_for_consultation: "   \n ", service: "SCALP BOOSTER" })).toBe(
      "SCALP BOOSTER",
    );
  });

  it("trims the text it returns", () => {
    expect(investigationText({ reason_for_consultation: "  Acne review  " })).toBe("Acne review");
  });

  it("uses the fallback when neither field has anything", () => {
    expect(investigationText({ reason_for_consultation: null, service: null }, "—")).toBe("—");
    expect(investigationText({}, "—")).toBe("—");
    expect(investigationText(null, "—")).toBe("—");
    expect(investigationText(undefined)).toBe("");
  });
});
