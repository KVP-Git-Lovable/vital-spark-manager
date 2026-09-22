import { describe, it, expect } from "vitest";
import {
  appointmentForBill,
  clinicDay,
} from "../../supabase/functions/sf-import-clinical/billAppointment";

/**
 * A bill whose Salesforce record names no appointment used to be stored with
 * appointment_id null, and the Appointments list - which looks invoices up by
 * that column alone - printed a dash where the money should be.
 */

const ids = (pairs: Array<[string, string]>) => new Map(pairs);
const starts = (pairs: Array<[string, string]>) => new Map(pairs);

describe("clinicDay", () => {
  it("judges the day in the clinic's timezone, not UTC", () => {
    // 20:00 UTC on the 20th is 01:30 IST on the 21st.
    expect(clinicDay("2026-09-20T20:00:00Z")).toBe("2026-09-21");
    expect(clinicDay("2026-09-21T04:30:00Z")).toBe("2026-09-21");
  });

  it("has nothing to say about a missing or unusable date", () => {
    expect(clinicDay(null)).toBeNull();
    expect(clinicDay(undefined)).toBeNull();
    expect(clinicDay("")).toBeNull();
    expect(clinicDay("not a date")).toBeNull();
  });
});

describe("appointmentForBill - Salesforce named the appointment", () => {
  it("uses that link and does not second-guess it by date", () => {
    const got = appointmentForBill(
      "SFAPPT1",
      "2026-09-21T06:00:00Z",
      ids([["SFAPPT1", "local-1"], ["SFAPPT2", "local-2"]]),
      starts([["SFAPPT1", "2026-01-01T06:00:00Z"], ["SFAPPT2", "2026-09-21T05:00:00Z"]]),
    );
    expect(got).toBe("local-1");
  });

  it("links nothing when the named appointment is not here yet", () => {
    expect(
      appointmentForBill("MISSING", "2026-09-21T06:00:00Z", ids([]), starts([])),
    ).toBeNull();
  });
});

describe("appointmentForBill - Salesforce named none", () => {
  it("falls back to the patient's single appointment that day", () => {
    const got = appointmentForBill(
      null,
      "2026-09-21T09:00:00Z",
      ids([["A", "local-a"], ["B", "local-b"]]),
      starts([["A", "2026-09-21T05:00:00Z"], ["B", "2026-09-19T05:00:00Z"]]),
    );
    expect(got).toBe("local-a");
  });

  it("refuses to guess when the patient was seen twice that day", () => {
    const got = appointmentForBill(
      "",
      "2026-09-21T09:00:00Z",
      ids([["A", "local-a"], ["B", "local-b"]]),
      starts([["A", "2026-09-21T05:00:00Z"], ["B", "2026-09-21T11:00:00Z"]]),
    );
    expect(got).toBeNull();
  });

  it("ignores an appointment that has no row here to link to", () => {
    const got = appointmentForBill(
      null,
      "2026-09-21T09:00:00Z",
      ids([["A", "local-a"]]),
      starts([["A", "2026-09-21T05:00:00Z"], ["GHOST", "2026-09-21T11:00:00Z"]]),
    );
    expect(got).toBe("local-a");
  });

  it("links nothing when no appointment falls on the bill's day", () => {
    const got = appointmentForBill(
      null,
      "2026-09-21T09:00:00Z",
      ids([["A", "local-a"]]),
      starts([["A", "2026-09-18T05:00:00Z"]]),
    );
    expect(got).toBeNull();
  });

  it("links nothing when the bill carries no usable date", () => {
    expect(
      appointmentForBill(null, null, ids([["A", "local-a"]]), starts([["A", "2026-09-21T05:00:00Z"]])),
    ).toBeNull();
  });

  it("matches a late-evening visit against the bill raised at it", () => {
    // 19:00 IST on the 21st is 13:30 UTC; both sides must read as the 21st.
    const got = appointmentForBill(
      null,
      "2026-09-21T14:00:00Z",
      ids([["A", "local-a"]]),
      starts([["A", "2026-09-21T13:30:00Z"]]),
    );
    expect(got).toBe("local-a");
  });
});
