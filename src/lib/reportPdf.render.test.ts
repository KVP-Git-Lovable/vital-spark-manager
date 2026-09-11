import { describe, it, expect, vi } from "vitest";

/**
 * End-to-end check on the generated document. The unit tests cover the formatting
 * helpers; this one catches the failures they cannot see - jsPDF throwing during
 * assembly, and any non-ASCII reaching the page (the rupee sign would be drawn as
 * the wrong glyph, silently, on every money figure in the report).
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { first_name: "Vindhya", last_name: "Pai" } }) }),
        limit: () => ({
          maybeSingle: async () => ({
            data: {
              name: "The Skin Clinic",
              address: "Vyas Rao Lane, Kadri",
              city: "Mangalore",
              phone: "+91 6360 75 3030",
              email: "theskinclinic30@gmail.com",
              logo_url: null,
            },
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/assets/skin-clinic-logo.png", () => ({ default: "/logo.png" }));

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
global.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob([PNG], { type: "image/png" }) })) as any;

const report: any = {
  key: "invoices",
  title: "Invoices & Revenue",
  description: "All invoices with paid and pending amounts.",
  columns: [
    { key: "invoice_number", label: "Invoice #" },
    { key: "patient_name", label: "Patient" },
    { key: "total_amount", label: "Total", type: "currency" },
    { key: "status", label: "Status", type: "badge" },
    { key: "created_at", label: "Date", type: "date" },
  ],
  filters: [
    { key: "dateRange", label: "Created", type: "dateRange" },
    { key: "doctor", label: "Doctor", type: "doctor" },
  ],
};

const rows = Array.from({ length: 120 }, (_, i) => ({
  invoice_number: `INV-${1000 + i}`,
  patient_name: `Patient ${i}`,
  total_amount: 1234 * (i + 1),
  status: i % 2 ? "Paid" : "Pending",
  created_at: "2026-09-11T06:30:00.000Z",
}));

/** Every literal string the document actually draws. */
function drawnText(bytes: Buffer): string[] {
  const zlib = require("node:zlib");
  const out: string[] = [];
  for (const [, body] of bytes.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let data = body;
    try { data = zlib.inflateSync(Buffer.from(body, "latin1")).toString("latin1"); } catch { /* uncompressed */ }
    for (const [, s] of data.matchAll(/\((.*?)\)\s*Tj/g)) out.push(s.replace(/\\([()])/g, "$1"));
  }
  return out;
}

describe("report PDF", () => {
  it("draws the clinic header, filters, summary and every row", async () => {
    const { buildReportPdf } = await import("./reportPdf");
    const doc = await buildReportPdf({
      report,
      rows,
      summary: [
        { label: "Invoices", value: "68" },
        { label: "Total Billed", value: "₹3.34 L" },
        { label: "Outstanding", value: "₹7.4K" },
      ],
      filterState: {
        search: "",
        dateFrom: new Date(2026, 8, 1),
        dateTo: new Date(2026, 8, 11),
        datePreset: "this_month",
        selects: { doctor: "some-uuid" },
      },
      dayOnly: false,
    });

    const bytes = Buffer.from(doc.output("arraybuffer"));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const text = drawnText(bytes);

    expect(text).toContain("The Skin Clinic");
    expect(text).toContain("Invoices & Revenue");
    // The period is spelled out with real dates, and the doctor id is resolved.
    expect(text).toContain("Current Month (01 Sep 2026 - 11 Sep 2026) - Vindhya Pai");
    expect(text.some((t) => /^120 record\(s\) - generated \d{2} \w{3} \d{4} \d{1,2}:\d{2} [AP]M$/.test(t))).toBe(true);
    expect(text).toContain("Total (Rs)");
    expect(text).toContain("1,234");       // Indian grouping, no symbol
    expect(text).toContain("11 Sep 2026"); // dates formatted, not raw ISO
    expect(text).toContain("Rs 3.34 L");   // summary symbol swapped, not dropped

    // Every row made it in, across pages - not just the 50 shown on screen.
    expect(text).toContain("INV-1000");
    expect(text).toContain("INV-1119");
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(text).toContain(`Page ${doc.getNumberOfPages()}`);
  });

  it("puts no character in the file that the PDF font cannot draw", async () => {
    const { buildReportPdf } = await import("./reportPdf");
    const doc = await buildReportPdf({
      report,
      rows: [{ invoice_number: "INV-1", patient_name: "Anushaᵗ – café", total_amount: 500, status: "Paid", created_at: "2026-09-11T06:30:00.000Z" }],
      summary: [{ label: "Total Billed", value: "₹1,00,000" }],
      filterState: { search: "", dateFrom: new Date(2026, 8, 11), dateTo: new Date(2026, 8, 11), datePreset: "custom", selects: {} },
      dayOnly: false,
    });

    const bytes = Buffer.from(doc.output("arraybuffer"));
    expect(bytes.includes(Buffer.from("₹", "utf8"))).toBe(false);
    for (const s of drawnText(bytes)) {
      expect(s, `non-ASCII reached the page: ${JSON.stringify(s)}`).toMatch(/^[\x20-\x7E]*$/);
    }
  });
});
