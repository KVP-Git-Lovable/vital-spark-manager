import { describe, it, expect } from "vitest";
import { appointmentStatusClasses, ALL_APPOINTMENT_STATUSES } from "./appointmentStatus";

/**
 * A patient's Appts tab showed Cancelled in the same grey badge as Completed,
 * so front desk could not see at a glance that a visit had been called off.
 */
describe("appointmentStatusClasses", () => {
  it("puts a cancelled visit in red", () => {
    expect(appointmentStatusClasses("Cancelled")).toContain("text-destructive");
  });

  it("puts a no show in red too - front desk read them the same way", () => {
    expect(appointmentStatusClasses("No Show")).toContain("text-destructive");
  });

  it("does not paint a completed visit red", () => {
    expect(appointmentStatusClasses("Completed")).not.toContain("destructive");
    expect(appointmentStatusClasses("Completed")).toContain("text-success");
  });

  it("falls back to a normal badge for a status it does not know", () => {
    // Older Salesforce rows still carry statuses the app no longer offers.
    expect(appointmentStatusClasses("Scheduled")).toBe("bg-muted text-muted-foreground");
  });

  it("falls back rather than returning nothing for a blank status", () => {
    expect(appointmentStatusClasses(null)).toBe("bg-muted text-muted-foreground");
    expect(appointmentStatusClasses(undefined)).toBe("bg-muted text-muted-foreground");
    expect(appointmentStatusClasses("")).toBe("bg-muted text-muted-foreground");
  });

  it("tolerates stray whitespace around a stored status", () => {
    expect(appointmentStatusClasses(" Cancelled ")).toContain("text-destructive");
  });

  it("styles every status the app can set", () => {
    for (const status of ALL_APPOINTMENT_STATUSES) {
      expect(appointmentStatusClasses(status)).not.toBe("bg-muted text-muted-foreground");
    }
  });
});
