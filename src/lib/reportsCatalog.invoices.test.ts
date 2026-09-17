import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

const invoicesReport = async () => {
  const { REPORTS } = await import("./reportsCatalog");
  const report = REPORTS.find((r) => r.key === "invoices");
  if (!report) throw new Error("invoices report missing");
  return report;
};

const rows = [
  { invoice_number: "B-48834", total_amount: 7750, paid_amount: 7750, payment_mode: "Part-Payment" },
  { invoice_number: "B-48830", total_amount: 5000, paid_amount: 5000, payment_mode: "Google Pay" },
  { invoice_number: "B-48824", total_amount: 800, paid_amount: 800, payment_mode: "Cash" },
  { invoice_number: "B-48821", total_amount: 3500, paid_amount: 3500, payment_mode: "Credit Card" },
  { invoice_number: "B-48810", total_amount: 2000, paid_amount: 0, payment_mode: null },
];

describe("Invoices & Revenue summary", () => {
  it("breaks the collection down by instrument instead of one lump", async () => {
    const report = await invoicesReport();
    const labels = report.summary!(rows).map((s) => s.label);
    expect(labels.slice(0, 2)).toEqual(["Invoices", "Total Billed"]);
    expect(labels).toContain("UPI");
    expect(labels).toContain("Cash");
    expect(labels).toContain("Card");
    expect(labels).not.toContain("Collected");
    expect(labels).not.toContain("Outstanding");
  });

  it("does not show a card for an instrument the period never used", async () => {
    const report = await invoicesReport();
    const labels = report.summary!(rows).map((s) => s.label);
    expect(labels).not.toContain("Cheque");
    expect(labels).not.toContain("Bank Transfer");
  });

  it("shows a cheque card as soon as a cheque is taken", async () => {
    const report = await invoicesReport();
    const labels = report
      .summary!([...rows, { total_amount: 900, paid_amount: 900, payment_mode: "Cheque" }])
      .map((s) => s.label);
    expect(labels).toContain("Cheque");
  });

  it("never abbreviates a figure to lakhs or crores", async () => {
    // "Rs 1.95 L" cannot be reconciled against a bank statement or the cash
    // drawer, which is the only reason these cards exist.
    const report = await invoicesReport();
    const big = report.summary!(rows.map((r) => ({ ...r, total_amount: 194800, paid_amount: 194800 })));
    for (const card of big) {
      expect(card.value, card.label).not.toMatch(/\d\s?(L|Cr|K|M|B)$/);
    }
    expect(big.find((s) => s.label === "Total Billed")?.value).toBe("₹9,74,000");
  });

  it("still counts every invoice and the full billed amount", async () => {
    const report = await invoicesReport();
    const summary = report.summary!(rows);
    expect(summary.find((s) => s.label === "Invoices")?.value).toBe("5");
    // 7,750 + 5,000 + 800 + 3,500 + 2,000
    expect(summary.find((s) => s.label === "Total Billed")?.value).toMatch(/19/);
  });
});

describe("Invoices & Revenue columns", () => {
  it("shows the doctor where the cancellation reason used to be", async () => {
    const report = await invoicesReport();
    const keys = report.columns.map((c) => c.key);
    expect(keys).toContain("doctor_name");
    expect(keys).not.toContain("cancellation_reason");
  });

  it("names the doctor from the invoice's own staff link", async () => {
    const report = await invoicesReport();
    const column = report.columns.find((c) => c.key === "doctor_name")!;
    expect(column.accessor!({ doctor: { first_name: "Vindhya", last_name: "Pai" } })).toBe("Vindhya Pai");
  });

  it("falls back to the name recorded on the appointment", async () => {
    // Almost all the Salesforce-imported history has no staff record to point
    // at, and a blank Doctor column on a 2021 report is not a report on 2021.
    const report = await invoicesReport();
    const column = report.columns.find((c) => c.key === "doctor_name")!;
    expect(column.accessor!({ doctor: null, appointment: { doctor_name: "Dr. Shricharith Shetty" } }))
      .toBe("Dr. Shricharith Shetty");
  });

  it("gives an empty string, not 'undefined undefined', with neither", async () => {
    const report = await invoicesReport();
    const column = report.columns.find((c) => c.key === "doctor_name")!;
    expect(column.accessor!({})).toBe("");
  });
});

describe("Invoices & Revenue payment mode filter", () => {
  it("matches by instrument so UPI finds the Google Pay rows the UPI card counted", async () => {
    const report = await invoicesReport();
    const filter = report.filters.find((f) => f.key === "payment_mode")!;
    expect(filter.matches!({ payment_mode: "Google Pay" }, "UPI")).toBe(true);
    expect(filter.matches!({ payment_mode: "Credit Card" }, "Card")).toBe(true);
    expect(filter.matches!({ payment_mode: "Google Pay" }, "Cash")).toBe(false);
  });

  it("offers the same buckets the cards use", async () => {
    const report = await invoicesReport();
    const filter = report.filters.find((f) => f.key === "payment_mode")!;
    expect(filter.options!.map((o) => o.value)).toEqual(["UPI", "Cash", "Card", "Bank Transfer", "Cheque", "Other"]);
  });
});
