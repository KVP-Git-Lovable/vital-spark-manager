import { describe, it, expect } from "vitest";
import { acceptCorrection, didChange } from "./fixSpelling";

describe("acceptCorrection", () => {
  it("takes a spelling correction", () => {
    // The reported case: "thss and alsi".
    expect(acceptCorrection("thss and alsi", "this and also")).toBe("this and also");
  });

  it("keeps the note when nothing comes back", () => {
    expect(acceptCorrection("mild rosacea", "")).toBe("mild rosacea");
    expect(acceptCorrection("mild rosacea", null)).toBe("mild rosacea");
    expect(acceptCorrection("mild rosacea", "   ")).toBe("mild rosacea");
  });

  it("refuses a rewrite that adds words", () => {
    expect(acceptCorrection("itching 3 weeks", "The patient reports itching for 3 weeks")).toBe(
      "itching 3 weeks",
    );
  });

  it("refuses a rewrite that drops words", () => {
    expect(acceptCorrection("redness and itching on cheeks", "redness and itching")).toBe(
      "redness and itching on cheeks",
    );
  });

  it("refuses anything that changes a dose", () => {
    // The one that would matter most: 500mg must never become 50mg.
    expect(acceptCorrection("Doxycyclin 500mg BD", "Doxycycline 50mg BD")).toBe(
      "Doxycyclin 500mg BD",
    );
  });

  it("corrects the word beside a dose while the dose stands", () => {
    expect(acceptCorrection("Doxycyclin 500mg BD", "Doxycycline 500mg BD")).toBe(
      "Doxycycline 500mg BD",
    );
  });

  it("refuses to reflow the note", () => {
    expect(acceptCorrection("line one\nline two", "line one line two")).toBe("line one\nline two");
    expect(acceptCorrection("line one\nline two", "line\none\nline two")).toBe("line one\nline two");
  });

  it("keeps a note that was already correct", () => {
    expect(acceptCorrection("mild rosacea", "mild rosacea")).toBe("mild rosacea");
  });

  it("leaves lines and spacing alone when it does accept", () => {
    expect(acceptCorrection("redness on forhead\nitching for 3 weeks", "redness on forehead\nitching for 3 weeks")).toBe(
      "redness on forehead\nitching for 3 weeks",
    );
  });
});

describe("didChange", () => {
  it("knows when there is something to report", () => {
    expect(didChange("thss", "this")).toBe(true);
    expect(didChange("mild rosacea", "mild rosacea")).toBe(false);
  });
});
