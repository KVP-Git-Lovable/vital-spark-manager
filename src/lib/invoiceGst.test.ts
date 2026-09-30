import { describe, it, expect } from "vitest";
import { amountBeforeGst, totalWithGst, gstRate, gstRateLabel } from "./invoiceGst";

/** Real bills from the clinic's own data. Numerics arrive as strings. */
const TAXED = { total_amount: "11445.00", tax_amount: "545", tax_rate: null };
const PART_TAXED = { total_amount: "9775.00", tax_amount: "125", tax_rate: "5" };
const FLAT_5 = { total_amount: "2940.00", tax_amount: "140", tax_rate: "5" };
const NO_GST = { total_amount: "850.00", tax_amount: null, tax_rate: null };

describe("amountBeforeGst", () => {
  it("is the total less the GST on it", () => {
    expect(amountBeforeGst(TAXED)).toBe(10900);
    expect(amountBeforeGst(FLAT_5)).toBe(2800);
  });

  it("is the total itself when no GST was charged", () => {
    expect(amountBeforeGst(NO_GST)).toBe(850);
  });

  it("always adds back up to the total, so nothing is lost", () => {
    for (const row of [TAXED, PART_TAXED, FLAT_5, NO_GST]) {
      expect(amountBeforeGst(row) + Number(row.tax_amount ?? 0)).toBeCloseTo(totalWithGst(row), 2);
    }
  });

  it("reads a missing row as nothing rather than throwing", () => {
    expect(amountBeforeGst(null)).toBe(0);
    expect(amountBeforeGst({})).toBe(0);
  });
});

describe("totalWithGst", () => {
  it("is the bill's own total, untouched", () => {
    expect(totalWithGst(TAXED)).toBe(11445);
    expect(totalWithGst(NO_GST)).toBe(850);
  });
});

describe("gstRate", () => {
  it("shows the rate the bill was raised at", () => {
    expect(gstRate(FLAT_5)).toBe(5);
  });

  it("keeps the recorded rate even where GST covered only part of the bill", () => {
    // Rs 125 on Rs 9,650 works out at 1.3%, but the bill carries 5% and that is
    // what the clinic asked to see.
    expect(gstRate(PART_TAXED)).toBe(5);
  });

  it("works the rate out when none was recorded", () => {
    expect(gstRate(TAXED)).toBe(5);
  });

  it("is nothing at all for a bill with no GST", () => {
    expect(gstRate(NO_GST)).toBeNull();
    expect(gstRate({ total_amount: "500", tax_amount: "0", tax_rate: "5" })).toBeNull();
  });
});

describe("gstRateLabel", () => {
  it("reads as a plain percentage", () => {
    expect(gstRateLabel(FLAT_5)).toBe("5%");
    expect(gstRateLabel({ total_amount: "1180", tax_amount: "180", tax_rate: "18" })).toBe("18%");
  });

  it("does not pad a whole number with zeros", () => {
    expect(gstRateLabel(TAXED)).toBe("5%");
  });

  it("keeps the odd rate honest when it has to work one out", () => {
    expect(gstRateLabel({ total_amount: "9775", tax_amount: "125", tax_rate: null })).toBe("1.3%");
  });

  it("is blank for a bill with no GST, rather than 0%", () => {
    expect(gstRateLabel(NO_GST)).toBeNull();
  });
});
