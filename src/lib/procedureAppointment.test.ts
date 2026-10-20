import { describe, it, expect } from "vitest";
import { APPOINTMENT_REMOVED_NOTICE, decideAppointmentLink } from "./procedureAppointment";

const APPOINTMENT = "63b90873-8e57-4e8e-90f6-94371e243d0e";

describe("decideAppointmentLink", () => {
  it("keeps the link when the appointment is still there", () => {
    expect(decideAppointmentLink(APPOINTMENT, true)).toEqual({ id: APPOINTMENT, removed: false });
  });

  it("drops a link to an appointment that has been deleted, rather than losing the visit", () => {
    expect(decideAppointmentLink(APPOINTMENT, false)).toEqual({ id: null, removed: true });
  });

  it("says nothing when no appointment was named - a walk-in is not a loss", () => {
    expect(decideAppointmentLink(null, false)).toEqual({ id: null, removed: false });
    expect(decideAppointmentLink(undefined, false)).toEqual({ id: null, removed: false });
    expect(decideAppointmentLink("", false)).toEqual({ id: null, removed: false });
    expect(decideAppointmentLink("   ", false)).toEqual({ id: null, removed: false });
  });

  it("does not report a removal for a blank id even when nothing exists", () => {
    // The notice is for the front desk. Showing it on every walk-in would
    // teach them to ignore it.
    expect(decideAppointmentLink("", false).removed).toBe(false);
  });

  it("has a notice that explains where the visit went", () => {
    expect(APPOINTMENT_REMOVED_NOTICE).toContain("deleted");
    expect(APPOINTMENT_REMOVED_NOTICE).toContain("patient");
  });
});
