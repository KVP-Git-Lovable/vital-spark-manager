import { describe, it, expect } from "vitest";
import { appointmentChangeKind, appointmentEventId, openAppointmentNotice } from "./liveAppointments";

const ID = "d398da7a-1965-4328-adb0-dc0c3ef96a2c";

describe("appointmentEventId", () => {
  it("reads the id off a new booking", () => {
    expect(appointmentEventId({ eventType: "INSERT", new: { id: ID, status: "Confirmed" }, old: {} })).toBe(ID);
  });

  it("reads it off a retimed one", () => {
    expect(appointmentEventId({ eventType: "UPDATE", new: { id: ID }, old: { id: ID } })).toBe(ID);
  });

  it("reads it off a deletion, which carries only the key", () => {
    expect(appointmentEventId({ eventType: "DELETE", new: {}, old: { id: ID } })).toBe(ID);
  });

  it("ignores anything that does not look like either, rather than guessing", () => {
    expect(appointmentEventId(null)).toBeNull();
    expect(appointmentEventId(undefined)).toBeNull();
    expect(appointmentEventId({ eventType: "DELETE", new: {}, old: {} })).toBeNull();
    expect(appointmentEventId({ eventType: "UPDATE", new: { id: 42 } as never })).toBeNull();
    expect(appointmentEventId({ eventType: "UPDATE", new: { id: "   " } })).toBeNull();
  });
});

describe("appointmentChangeKind", () => {
  it("calls a deletion a deletion", () => {
    expect(appointmentChangeKind({ eventType: "DELETE", old: { id: ID } })).toBe("deleted");
    expect(appointmentChangeKind({ eventType: "delete", old: { id: ID } })).toBe("deleted");
  });

  it("treats everything else as a change", () => {
    expect(appointmentChangeKind({ eventType: "UPDATE", new: { id: ID } })).toBe("changed");
    expect(appointmentChangeKind({ eventType: "INSERT", new: { id: ID } })).toBe("changed");
    expect(appointmentChangeKind(null)).toBe("changed");
  });
});

describe("openAppointmentNotice", () => {
  it("answers the question a deletion raises: have I lost what I typed", () => {
    const notice = openAppointmentNotice("deleted");
    expect(notice).toContain("deleted");
    expect(notice).toContain("patient's record");
  });

  it("says a change plainly, without alarming anyone", () => {
    expect(openAppointmentNotice("changed")).toBe("This appointment was changed at the front desk.");
  });
});
