import { describe, it, expect } from "vitest";
import { collectionCards, collectionsByBucket, paymentBucket } from "./paymentModes";

const money = (n: number) => `Rs ${n}`;

describe("paymentBucket", () => {
  it("files every UPI wallet the clinic has ever typed under UPI", () => {
    for (const mode of ["UPI", "upi", "Google Pay", "GooglePay", "G Pay", "GPay", "PhonePe", "Phone Pe", "Paytm", "BHIM"]) {
      expect(paymentBucket(mode)).toBe("UPI");
    }
  });

  it("files the card spellings under Card", () => {
    for (const mode of ["Card", "Credit Card", "Debit Card", "Credit/Debit", "Visa", "RuPay"]) {
      expect(paymentBucket(mode)).toBe("Card");
    }
  });

  it("files the bank spellings under Bank Transfer", () => {
    for (const mode of ["Bank Transfer", "NEFT", "IMPS", "RTGS", "Net Banking", "netbanking"]) {
      expect(paymentBucket(mode)).toBe("Bank Transfer");
    }
  });

  it("keeps Cash and Cheque apart", () => {
    expect(paymentBucket("Cash")).toBe("Cash");
    expect(paymentBucket("Cheque")).toBe("Cheque");
    expect(paymentBucket("Demand Draft")).toBe("Cheque");
  });

  it("does not mistake Part-Payment for a payment instrument", () => {
    // Salesforce stores it to mean the bill was only partly settled. A rule
    // matching a bare "pay" would have filed it under UPI and inflated the
    // UPI card with money that came in some other way.
    expect(paymentBucket("Part-Payment")).toBe("Other");
  });

  it("calls anything unrecognised Other rather than guessing", () => {
    expect(paymentBucket("")).toBe("Other");
    expect(paymentBucket(null)).toBe("Other");
    expect(paymentBucket(undefined)).toBe("Other");
    expect(paymentBucket("Insurance")).toBe("Other");
  });
});

describe("collectionsByBucket", () => {
  it("adds up what came in on each instrument", () => {
    const totals = collectionsByBucket([
      { paid_amount: 5000, payment_mode: "Google Pay" },
      { paid_amount: 850, payment_mode: "UPI" },
      { paid_amount: 800, payment_mode: "Cash" },
      { paid_amount: 3500, payment_mode: "Credit Card" },
    ]);
    expect(totals.get("UPI")).toBe(5850);
    expect(totals.get("Cash")).toBe(800);
    expect(totals.get("Card")).toBe(3500);
  });

  it("breaks a split payment across its parts", () => {
    const totals = collectionsByBucket([
      {
        paid_amount: 7750,
        payment_mode: "Split",
        payment_splits: [
          { mode: "Cash", amount: 2750 },
          { mode: "Google Pay", amount: 5000 },
        ],
      },
    ]);
    expect(totals.get("Cash")).toBe(2750);
    expect(totals.get("UPI")).toBe(5000);
    expect(totals.get("Other")).toBeUndefined();
  });

  it("never loses a rupee - the buckets always add up to what was collected", () => {
    const rows = [
      { paid_amount: 13045, payment_mode: "Part-Payment" },
      { paid_amount: 4500, payment_mode: "Google Pay" },
      { paid_amount: 850, payment_mode: "Cash" },
      { paid_amount: 1800, payment_mode: "Split", payment_splits: [{ mode: "Cheque", amount: 1000 }, { mode: "NEFT", amount: 800 }] },
      // splits that do not add up to paid_amount: the remainder must still land
      // somewhere rather than vanishing from the report.
      { paid_amount: 1000, payment_mode: "Cash", payment_splits: [{ mode: "UPI", amount: 600 }] },
    ];
    const collected = rows.reduce((a, r) => a + Number(r.paid_amount), 0);
    const totals = collectionsByBucket(rows);
    const bucketed = Array.from(totals.values()).reduce((a, n) => a + n, 0);
    expect(bucketed).toBe(collected);
    expect(totals.get("Cash")).toBe(850 + 400);
    expect(totals.get("UPI")).toBe(4500 + 600);
    expect(totals.get("Other")).toBe(13045);
  });

  it("ignores payment_splits that is not an array", () => {
    const totals = collectionsByBucket([{ paid_amount: 500, payment_mode: "Cash", payment_splits: "{}" }]);
    expect(totals.get("Cash")).toBe(500);
  });
});

describe("collectionCards", () => {
  it("shows only the instruments actually used, in a fixed order", () => {
    const cards = collectionCards(
      [
        { paid_amount: 100, payment_mode: "Cash" },
        { paid_amount: 200, payment_mode: "Google Pay" },
      ],
      money,
    );
    expect(cards).toEqual([
      { label: "UPI", value: "Rs 200" },
      { label: "Cash", value: "Rs 100" },
    ]);
  });

  it("shows nothing at all when nothing was collected", () => {
    expect(collectionCards([{ paid_amount: 0, payment_mode: "Cash" }], money)).toEqual([]);
    expect(collectionCards([], money)).toEqual([]);
  });
});
