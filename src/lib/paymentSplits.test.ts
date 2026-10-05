import { describe, it, expect } from "vitest";
import { paymentModeForSplits, splitProblem, splitTotal, splitsFromInvoice } from "./paymentSplits";

/** INV-49320, Basavaraju: ₹32,175 taken as ₹30,000 cash and ₹2,175 UPI. */
const INV_49320 = [
  { mode: "Cash", amount: 30000 },
  { mode: "UPI", amount: 2175 },
];

describe("splitsFromInvoice", () => {
  it("reads the rows stored on the invoice", () => {
    expect(splitsFromInvoice(INV_49320)).toEqual(INV_49320);
  });

  it("reads nothing from an invoice that was paid one way", () => {
    expect(splitsFromInvoice(null)).toEqual([]);
    expect(splitsFromInvoice(undefined)).toEqual([]);
    expect(splitsFromInvoice([])).toEqual([]);
    expect(splitsFromInvoice("Cash")).toEqual([]);
  });

  it("survives a row stored with the amount as text", () => {
    expect(splitsFromInvoice([{ mode: "Cash", amount: "30000" }])).toEqual([{ mode: "Cash", amount: 30000 }]);
  });
});

describe("paymentModeForSplits", () => {
  it("reads Split when the money came in two ways", () => {
    expect(paymentModeForSplits(INV_49320, "Cash")).toBe("Split");
  });

  it("names the mode when a split has only one row - it is just that payment", () => {
    expect(paymentModeForSplits([{ mode: "UPI", amount: 500 }], "Cash")).toBe("UPI");
  });

  it("leaves the chosen mode alone when there are no rows", () => {
    expect(paymentModeForSplits([], "Card")).toBe("Card");
  });
});

describe("splitProblem", () => {
  it("passes the real invoice's figures", () => {
    expect(splitTotal(INV_49320)).toBe(32175);
    expect(splitProblem(INV_49320, 32175)).toBeNull();
  });

  it("refuses a row with no mode", () => {
    expect(splitProblem([{ mode: "", amount: 100 }], 100)).toContain("payment mode");
  });

  it("refuses a row with nothing in it", () => {
    expect(splitProblem([{ mode: "Cash", amount: 0 }], 0)).toContain("amount");
  });

  it("refuses rows that do not add up to what was paid", () => {
    // The clinic edits UPI down to 2,000 and forgets the Paid Amount.
    expect(splitProblem([{ mode: "Cash", amount: 30000 }, { mode: "UPI", amount: 2000 }], 32175)).toContain(
      "equal paid amount",
    );
  });

  it("adds up in paise, so rounding cannot refuse a correct bill", () => {
    expect(splitProblem([{ mode: "Cash", amount: 0.1 }, { mode: "UPI", amount: 0.2 }], 0.3)).toBeNull();
  });

  it("has nothing to say about an invoice paid one way", () => {
    expect(splitProblem([], 5000)).toBeNull();
  });
});
