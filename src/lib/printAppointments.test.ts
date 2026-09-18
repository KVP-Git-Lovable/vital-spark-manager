import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchAppointmentsPage = vi.fn();
vi.mock("@/lib/appointmentsPage", () => ({
  fetchAppointmentsPage: (...args: unknown[]) => fetchAppointmentsPage(...args),
}));

import { printAppointments } from "./printAppointments";

/** A print window that records what was written to it instead of opening one. */
function stubPrintWindow() {
  const written: string[] = [];
  const win = {
    document: { write: (html: string) => written.push(html), close: () => {} },
    focus: () => {},
    print: () => {},
  };
  vi.stubGlobal("open", () => win);
  return written;
}

const row = (start: string, patient: string) => ({
  start_time: start,
  patients: { first_name: patient, last_name: "", phone: "" },
  staff_id: null,
  status: "Confirmed",
  reason_for_consultation: "Review",
  service: "Consultation",
});

const opts = { rangeLabel: "Tomorrow", staffName: () => "Dr Vindhya Pai" };

const baseParams = {
  dateRange: null,
  doctorIds: [],
  status: "all",
  visitStatus: "all",
  search: "",
};

describe("printAppointments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchAppointmentsPage.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("always asks for appointments in clock order, earliest first", async () => {
    fetchAppointmentsPage.mockResolvedValue({ rows: [], total: 0 });
    stubPrintWindow();

    await printAppointments(baseParams, opts);

    expect(fetchAppointmentsPage).toHaveBeenCalled();
    const sent = fetchAppointmentsPage.mock.calls[0][0];
    expect(sent.sortColumn).toBe("start_time");
    expect(sent.sortDirection).toBe("asc");
  });

  it("ignores a descending sort coming from the screen", async () => {
    fetchAppointmentsPage.mockResolvedValue({ rows: [], total: 0 });
    stubPrintWindow();

    // What the page used to pass through, and what printed the evening first.
    await printAppointments(
      { ...baseParams, sortColumn: "start_time", sortDirection: "desc" } as never,
      opts,
    );

    const sent = fetchAppointmentsPage.mock.calls[0][0];
    expect(sent.sortDirection).toBe("asc");
  });

  it("keeps the screen's filters", async () => {
    fetchAppointmentsPage.mockResolvedValue({ rows: [], total: 0 });
    stubPrintWindow();

    const range = { start: new Date("2026-09-19T00:00:00Z"), end: new Date("2026-09-19T23:59:59Z") };
    await printAppointments(
      { ...baseParams, dateRange: range, doctorIds: ["abc"], status: "Confirmed", search: "shetty" },
      opts,
    );

    const sent = fetchAppointmentsPage.mock.calls[0][0];
    expect(sent.dateRange).toBe(range);
    expect(sent.doctorIds).toEqual(["abc"]);
    expect(sent.status).toBe("Confirmed");
    expect(sent.search).toBe("shetty");
  });

  it("renders the rows in the order the server returned them", async () => {
    fetchAppointmentsPage.mockResolvedValue({
      rows: [
        row("2026-09-19T05:00:00Z", "Morning"),
        row("2026-09-19T07:00:00Z", "Midday"),
        row("2026-09-19T13:00:00Z", "Evening"),
      ],
      total: 3,
    });
    const written = stubPrintWindow();

    await printAppointments(baseParams, opts);

    const html = written.join("");
    expect(html.indexOf("Morning")).toBeLessThan(html.indexOf("Midday"));
    expect(html.indexOf("Midday")).toBeLessThan(html.indexOf("Evening"));
  });
});
