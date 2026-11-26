import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The Clinic 360 Dashboard's reads, which used to stop at 1000 rows.
 *
 * On 26 Nov 2026 the Current Quarter card read 1,000 appointments against a
 * real 1,932, 223 billed against a real 1,546, and Rs 34.85 lakh of revenue
 * against a real Rs 56.79 lakh - because `.limit(5000)` is served by Supabase
 * as min(5000, max-rows) and max-rows is 1000. No error, no warning, and the
 * cards were then worked out in JavaScript from that slice.
 *
 * The Supabase client is a module singleton, so it is stubbed before the
 * module under test imports it.
 */

interface Call { table: string; gte: Array<[string, string]>; lte: Array<[string, string]>; order: string[]; ranges: Array<[number, number]>; }

const calls: Call[] = [];
let totalRows = 0;

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const record: Call = { table, gte: [], lte: [], order: [], ranges: [] };
    calls.push(record);
    const q: Record<string, unknown> = {
      select: () => q,
      order: (col: string) => { record.order.push(col); return q; },
      gte: (col: string, v: string) => { record.gte.push([col, v]); return q; },
      lte: (col: string, v: string) => { record.lte.push([col, v]); return q; },
      range: (from: number, to: number) => {
        record.ranges.push([from, to]);
        const n = Math.max(0, Math.min(to, totalRows - 1) - from + 1);
        return Promise.resolve({ data: Array.from({ length: n }, (_, i) => ({ id: `r-${from + i}` })), error: null });
      },
    };
    return q;
  };
  return { supabase: { from: (table: string) => makeQuery(table) } };
});

const {
  DASH_PAGE_SIZE, DASH_ROW_CEILING,
  fetchDashboardAppointments, fetchDashboardFeedback, fetchDashboardInvoices,
} = await import("./dashboardRows");

const WINDOW: [string, string] = ["2026-10-01T00:00:00.000Z", "2026-11-26T18:29:59.999Z"];

beforeEach(() => { calls.length = 0; });

describe("fetching the rows the dashboard counts", () => {
  it("returns the whole quarter, not the first thousand of it", async () => {
    // The regression itself. 1,932 is the real count for 1 Oct - 26 Nov 2026;
    // the dashboard displayed 1,000.
    totalRows = 1932;
    const { rows, truncated } = await fetchDashboardAppointments(...WINDOW);
    expect(rows).toHaveLength(1932);
    expect(truncated).toBe(false);
  });

  it("keeps paging well past one page", async () => {
    totalRows = 10667; // Current Year, when this was written
    expect((await fetchDashboardInvoices(...WINDOW)).rows).toHaveLength(10667);
  });

  it("asks for consecutive pages of a thousand", async () => {
    totalRows = 2500;
    await fetchDashboardAppointments(...WINDOW);
    expect(calls.flatMap((c) => c.ranges)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(DASH_PAGE_SIZE).toBe(1000);
  });

  it("stops after one round trip when one page holds the answer", async () => {
    // Current Month is 844 rows: it must not cost a second request.
    totalRows = 844;
    const { rows } = await fetchDashboardAppointments(...WINDOW);
    expect(rows).toHaveLength(844);
    expect(calls.flatMap((c) => c.ranges)).toEqual([[0, 999]]);
  });

  it("returns nothing, and no complaint, for an empty window", async () => {
    totalRows = 0;
    const { rows, truncated } = await fetchDashboardInvoices(...WINDOW);
    expect(rows).toEqual([]);
    expect(truncated).toBe(false);
  });
});

describe("when the range is bigger than one view can page through", () => {
  it("says so rather than handing back a quietly short list", async () => {
    totalRows = DASH_ROW_CEILING + 5000;
    const { rows, truncated } = await fetchDashboardAppointments(...WINDOW);
    expect(rows.length).toBeGreaterThanOrEqual(DASH_ROW_CEILING);
    expect(truncated).toBe(true);
  });

  it("does not cry truncation when the window lands exactly under the ceiling", async () => {
    totalRows = DASH_ROW_CEILING - 1;
    expect((await fetchDashboardAppointments(...WINDOW)).truncated).toBe(false);
  });

  it("holds a ceiling high enough for every range the filter offers", () => {
    // The largest is Current Year: 10,667 appointments / 8,918 invoices.
    expect(DASH_ROW_CEILING).toBeGreaterThanOrEqual(20000);
  });
});

describe("what each read asks the database for", () => {
  it("bounds appointments by when the visit starts", async () => {
    totalRows = 10;
    await fetchDashboardAppointments(...WINDOW);
    expect(calls[0].table).toBe("appointments");
    expect(calls[0].gte).toEqual([["start_time", WINDOW[0]]]);
    expect(calls[0].lte).toEqual([["start_time", WINDOW[1]]]);
  });

  it("bounds invoices and feedback by when they were raised", async () => {
    totalRows = 10;
    await fetchDashboardInvoices(...WINDOW);
    await fetchDashboardFeedback(...WINDOW);
    expect(calls.map((c) => c.table)).toEqual(["invoices", "patient_feedback"]);
    for (const c of calls) {
      expect(c.gte).toEqual([["created_at", WINDOW[0]]]);
      expect(c.lte).toEqual([["created_at", WINDOW[1]]]);
    }
  });

  it("orders every page, so paging cannot deal the same row twice", async () => {
    // Without an order the server may return pages in any order, and a row
    // can appear on two pages or none - which would corrupt the counts in a
    // way far harder to spot than a round 1000.
    totalRows = 10;
    await fetchDashboardAppointments(...WINDOW);
    await fetchDashboardInvoices(...WINDOW);
    await fetchDashboardFeedback(...WINDOW);
    expect(calls.map((c) => c.order)).toEqual([["start_time"], ["created_at"], ["created_at"]]);
  });
});

describe("the pages that count these rows", () => {
  /* Comments stripped first: these files explain the bug in prose, and an
     assertion that matched its own explanation would pass or fail on the
     wording rather than on the code. */
  const read = (p: string) =>
    readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("no longer caps the dashboard's reads with a limit the server ignores", () => {
    // `.limit(5000)` is what caused this: Supabase served 1000 and said
    // nothing. Neither page may reintroduce a row cap on these tables.
    for (const page of ["src/pages/Index.tsx", "src/pages/DashboardExplore.tsx"]) {
      const source = read(page);
      expect(source, `${page} still caps rows`).not.toMatch(/\.limit\(\s*(5000|DASH_ROW_CAP)\s*\)/);
      expect(source).not.toContain("DASH_ROW_CAP");
    }
  });

  it("feeds the cards from the paged reads", () => {
    // The call, not the import: a page that imports the function and then
    // fetches some other way still shows the wrong number.
    const source = read("src/pages/Index.tsx");
    for (const fn of ["fetchDashboardAppointments", "fetchDashboardInvoices", "fetchDashboardFeedback"]) {
      expect(source, fn).toContain(`queryFn: () => ${fn}(startISO, endISO)`);
    }
  });

  it("tells the viewer when a range is too big to total", () => {
    // A partial answer presented as the answer is the whole defect, so the
    // condition is pinned whole - a warning wired to something that can
    // never be true is the same as no warning.
    const source = read("src/pages/Index.tsx");
    expect(source).toContain(
      "const partialRange = !!apptPage?.truncated || !!invoicePage?.truncated || !!feedbackPage?.truncated;",
    );
    expect(source).toContain("{partialRange && (");
  });

  it("still pages the drill-down the cards open", () => {
    // If this list stops at 1000 while the card counts 1,932, the clinic is
    // back to two numbers that disagree. All three reads, same ceiling.
    const source = read("src/pages/DashboardExplore.tsx");
    expect(source.match(/fetchAll</g) ?? []).toHaveLength(3);
    expect(source.match(/\}, DASH_PAGE_SIZE, DASH_ROW_CEILING\);/g) ?? []).toHaveLength(3);
  });
});
