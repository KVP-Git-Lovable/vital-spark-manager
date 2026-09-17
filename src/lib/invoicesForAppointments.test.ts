import { describe, it, expect } from "vitest";
import {
  chunkIds,
  fetchInvoicesByAppointmentIds,
  invoiceMapByAppointment,
} from "./invoicesForAppointments";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `appt-${i}`);

describe("chunkIds", () => {
  it("splits into chunks small enough to go in a URL", () => {
    expect(chunkIds(ids(320)).map((c) => c.length)).toEqual([150, 150, 20]);
  });

  it("drops duplicates and blanks so a chunk is never wasted", () => {
    expect(chunkIds(["a", "a", "", "b", null as unknown as string])).toEqual([["a", "b"]]);
  });

  it("returns nothing for an empty list", () => {
    expect(chunkIds([])).toEqual([]);
  });
});

describe("fetchInvoicesByAppointmentIds", () => {
  it("does not call the server at all when there is nothing to look up", async () => {
    let calls = 0;
    const out = await fetchInvoicesByAppointmentIds(async () => { calls++; return []; }, []);
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });

  it("asks only for the ids given - never the whole invoices table", async () => {
    const asked: string[] = [];
    await fetchInvoicesByAppointmentIds(
      async (chunk) => { asked.push(...chunk); return []; },
      ["a", "b", "c"],
    );
    expect(asked.sort()).toEqual(["a", "b", "c"]);
  });

  it("returns every chunk's rows, in chunk order", async () => {
    const out = await fetchInvoicesByAppointmentIds(
      async (chunk) => chunk.map((id) => ({ appointment_id: id })),
      ids(400),
      { chunkSize: 2, concurrency: 3 },
    );
    expect(out).toHaveLength(400);
    expect(out.map((r) => r.appointment_id)).toEqual(ids(400));
  });

  it("keeps at most `concurrency` requests in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    await fetchInvoicesByAppointmentIds(
      async (chunk) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return chunk.map((id) => ({ appointment_id: id }));
      },
      ids(40),
      { chunkSize: 1, concurrency: 4 },
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("propagates a failure instead of quietly returning a short list", async () => {
    // A swallowed error is what rendered a whole column of dashes.
    await expect(
      fetchInvoicesByAppointmentIds(async () => { throw new Error("statement timeout"); }, ids(5)),
    ).rejects.toThrow("statement timeout");
  });
});

describe("invoiceMapByAppointment", () => {
  it("keys invoices by their appointment", () => {
    const map = invoiceMapByAppointment([
      { appointment_id: "a", total_amount: 850 },
      { appointment_id: "b", total_amount: 4500 },
    ]);
    expect(map.get("a")?.total_amount).toBe(850);
    expect(map.get("b")?.total_amount).toBe(4500);
  });

  it("skips unattached invoices rather than keying them under null", () => {
    const map = invoiceMapByAppointment([
      { appointment_id: null, total_amount: 100 },
      { appointment_id: undefined, total_amount: 200 },
    ]);
    expect(map.size).toBe(0);
  });
});
