import { describe, it, expect } from "vitest";
import {
  appointmentStatusClasses,
  appointmentStatusLabel,
  ALL_APPOINTMENT_STATUSES,
  AUTOMATIC_APPOINTMENT_STATUSES,
  MANUAL_APPOINTMENT_STATUSES,
} from "./appointmentStatus";

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

/**
 * The front desk reads a row to find out whether the bill is done. "Completed"
 * is set by a trigger when the invoice is paid, so that is what it means - but
 * it does not say so.
 */
describe("appointmentStatusLabel", () => {
  it("calls a paid visit Billed", () => {
    expect(appointmentStatusLabel("Completed")).toBe("Billed");
    expect(appointmentStatusLabel(" Completed ")).toBe("Billed");
  });

  it("leaves every other status exactly as it is", () => {
    for (const status of ALL_APPOINTMENT_STATUSES) {
      if (status === "Completed") continue;
      expect(appointmentStatusLabel(status)).toBe(status);
    }
  });

  // Salesforce-era values that predate the list above still have to read.
  it("passes through a status it has never heard of", () => {
    expect(appointmentStatusLabel("Scheduled")).toBe("Scheduled");
    expect(appointmentStatusLabel("Checked-in")).toBe("Checked-in");
    expect(appointmentStatusLabel("Requested")).toBe("Requested");
  });

  it("has nothing to say about nothing", () => {
    expect(appointmentStatusLabel(null)).toBe("");
    expect(appointmentStatusLabel(undefined)).toBe("");
    expect(appointmentStatusLabel("")).toBe("");
  });

  /**
   * The guard that matters. "Billed" is a word on a badge; "Completed" is the
   * value a database trigger writes, the dashboard counts, saved views filter
   * on and the visit rollups read. If anyone ever "tidies" the label into the
   * stored value, this fails before it reaches the clinic.
   */
  it("is a label, not a rename - the stored value is still Completed", () => {
    expect(AUTOMATIC_APPOINTMENT_STATUSES).toContain("Completed");
    expect(ALL_APPOINTMENT_STATUSES).toContain("Completed");
    for (const list of [MANUAL_APPOINTMENT_STATUSES, AUTOMATIC_APPOINTMENT_STATUSES]) {
      expect(list).not.toContain("Billed");
    }
    expect(appointmentStatusClasses("Completed")).toContain("text-success");
    expect(appointmentStatusClasses("Billed")).toBe("bg-muted text-muted-foreground");
  });
});

/**
 * The reported fault: a patient paid ₹1,250 at 06:20 for a 06:30 appointment,
 * and the row still read "Confirmed" while the dashboard's Billed card read 0.
 *
 * The trigger that writes "Completed" only fires once, on the invoice, and
 * skips any appointment whose start time has not arrived - so paying early
 * leaves the status wrong for ever. The status cannot be trusted to answer
 * "is this billed?"; the invoice can.
 */
describe("appointmentStatusLabel, when the caller knows about the bill", () => {
  it("says Billed for a visit that has one, whatever the status says", () => {
    expect(appointmentStatusLabel("Confirmed", true)).toBe("Billed");
    expect(appointmentStatusLabel("Reserved", true)).toBe("Billed");
    expect(appointmentStatusLabel("Completed", true)).toBe("Billed");
  });

  // 45 visits in 90 days are marked Completed with no bill behind them.
  it("does not call a visit Billed when there is no bill", () => {
    expect(appointmentStatusLabel("Completed", false)).toBe("Completed");
    expect(appointmentStatusLabel("Confirmed", false)).toBe("Confirmed");
    expect(appointmentStatusLabel("Cancelled", false)).toBe("Cancelled");
  });

  // The print sheet and the patient's Appts tab fetch no invoices, so they
  // keep reading the status - the best answer available to them.
  it("falls back to the status when the caller cannot tell", () => {
    expect(appointmentStatusLabel("Completed")).toBe("Billed");
    expect(appointmentStatusLabel("Completed", undefined)).toBe("Billed");
    expect(appointmentStatusLabel("Confirmed")).toBe("Confirmed");
  });

  it("still has nothing to say about nothing", () => {
    expect(appointmentStatusLabel(null, false)).toBe("");
    expect(appointmentStatusLabel(undefined, true)).toBe("Billed");
    expect(appointmentStatusLabel("", false)).toBe("");
  });
});
