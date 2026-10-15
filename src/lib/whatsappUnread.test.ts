import { describe, it, expect } from "vitest";
import { isThreadUnread, unreadCount } from "./whatsappUnread";

const patientWrote = { phone: "+919876543210", last_at: "2026-10-15T10:04:00Z", last_direction: "inbound" };

describe("isThreadUnread", () => {
  it("marks a reply that arrived since the thread was last opened", () => {
    expect(isThreadUnread(patientWrote, "2026-10-15T09:00:00Z")).toBe(true);
  });

  it("marks a thread nobody has ever opened", () => {
    expect(isThreadUnread(patientWrote, null)).toBe(true);
    expect(isThreadUnread(patientWrote, undefined)).toBe(true);
  });

  it("clears once the thread has been opened", () => {
    expect(isThreadUnread(patientWrote, "2026-10-15T10:05:00Z")).toBe(false);
  });

  it("never marks the clinic's own reply", () => {
    // The old "Waiting" chip could not tell these apart, which is what sent
    // front desk into every thread to check.
    expect(isThreadUnread({ ...patientWrote, last_direction: "outbound" }, null)).toBe(false);
    expect(isThreadUnread({ ...patientWrote, last_direction: null }, null)).toBe(false);
  });

  it("does not leave a mark nobody can clear", () => {
    // An unparseable timestamp, and a read stamp from a machine whose clock
    // runs slightly ahead: neither should pin a dot on the list for ever.
    expect(isThreadUnread({ ...patientWrote, last_at: "not a date" }, null)).toBe(false);
    expect(isThreadUnread(patientWrote, "2026-10-15T10:04:30Z")).toBe(false);
  });

  it("treats an unreadable read stamp as never read", () => {
    expect(isThreadUnread(patientWrote, "nonsense")).toBe(true);
  });
});

describe("unreadCount", () => {
  it("counts only the threads waiting on the clinic", () => {
    const threads = [
      { phone: "a", last_at: "2026-10-15T10:00:00Z", last_direction: "inbound" },
      { phone: "b", last_at: "2026-10-15T10:00:00Z", last_direction: "inbound" },
      { phone: "c", last_at: "2026-10-15T10:00:00Z", last_direction: "outbound" },
    ];
    expect(unreadCount(threads, { b: "2026-10-15T11:00:00Z" })).toBe(1);
  });

  it("is zero when everything has been read", () => {
    expect(unreadCount([patientWrote], { [patientWrote.phone]: "2026-10-16T00:00:00Z" })).toBe(0);
  });
});
