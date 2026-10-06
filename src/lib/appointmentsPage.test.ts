import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Appointments list reported 56,530 appointments over a table holding
 * 56,776, because it asked PostgREST for `count: "planned"`/`"estimated"` -
 * Postgres's table statistics rather than a count. Any saved view counted the
 * same appointments exactly and disagreed, and printAppointments used the
 * under-reported total as a loop bound and stopped early. These hold it to a
 * real count, under every filter combination the old code branched on.
 */

interface Call {
  selectOptions: unknown;
  or: string[];
  range?: [number, number];
}

const calls: Call[] = [];
let rowCount = 0;
let serverCount = 0;

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = () => {
    const record: Call = { selectOptions: undefined, or: [] };
    calls.push(record);
    const q: Record<string, unknown> = {
      select: (_cols: string, opts?: unknown) => {
        record.selectOptions = opts;
        return q;
      },
      range: (from: number, to: number) => {
        record.range = [from, to];
        return Promise.resolve({
          data: Array.from({ length: rowCount }, (_, i) => ({ id: `a-${i}` })),
          count: serverCount,
          error: null,
        });
      },
    };
    q.or = (filter: string) => {
      record.or.push(filter);
      return q;
    };
    for (const m of ["order", "gte", "lte", "in", "eq", "not", "is", "limit", "ilike"]) {
      q[m] = () => q;
    }
    return q;
  };
  return { supabase: { from: () => makeQuery() } };
});

const { fetchAppointmentsPage } = await import("./appointmentsPage");
import type { FetchAppointmentsPageParams } from "./appointmentsPage";

const base: FetchAppointmentsPageParams = {
  page: 1,
  pageSize: 50,
  dateRange: null,
  doctorIds: [],
  status: "all",
  visitStatus: "all",
  search: "",
  sortColumn: "start_time",
  sortDirection: "desc",
};

beforeEach(() => {
  calls.length = 0;
  rowCount = 0;
  serverCount = 0;
});

describe("fetchAppointmentsPage", () => {
  it("counts rather than estimates, whatever is being filtered", async () => {
    const variations: Array<Partial<FetchAppointmentsPageParams>> = [
      {},
      { dateRange: { start: new Date("2026-10-01"), end: new Date("2026-10-07") } },
      { doctorIds: ["doc-1"] },
      { status: "Confirmed" },
      { visitStatus: "Completed" },
      { search: "hair" },
    ];
    for (const v of variations) {
      calls.length = 0;
      await fetchAppointmentsPage({ ...base, ...v });
      const counting = calls.filter((c) => c.selectOptions !== undefined);
      expect(counting.map((c) => c.selectOptions)).toContainEqual({ count: "exact" });
      expect(JSON.stringify(counting)).not.toMatch(/planned|estimated/);
    }
  });

  it("reports the server's count, not the size of the page", async () => {
    rowCount = 51;
    serverCount = 56776;
    const res = await fetchAppointmentsPage(base);
    expect(res.total).toBe(56776);
    expect(res.rows).toHaveLength(50);
  });

  it("still takes 'is there a next page' from the probe row", async () => {
    rowCount = 51;
    serverCount = 56776;
    expect((await fetchAppointmentsPage(base)).hasMore).toBe(true);

    rowCount = 50;
    serverCount = 56776;
    expect((await fetchAppointmentsPage(base)).hasMore).toBe(false);
  });
});

describe("searching appointments by patient name", () => {
  it("keeps searching the stored copy of the name", async () => {
    // The screens show the joined patient record now, but PostgREST cannot
    // filter top-level rows by a joined column - so the search has to keep
    // asking about appointments.patient_name. Removing it would make the
    // search box stop finding people by name altogether.
    await fetchAppointmentsPage({ ...base, search: "baazi" });
    const filters = calls.flatMap((c) => c.or).join(" ");
    expect(filters).toContain("patient_name.ilike.%baazi%");
  });
});
