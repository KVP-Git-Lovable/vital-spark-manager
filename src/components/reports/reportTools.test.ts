import { describe, it, expect } from "vitest";
import { reportTool, visibleReportTool } from "./reportTools";
import { REPORTS } from "@/lib/reportsCatalog";

/**
 * Actions a report offers beside Export.
 *
 * The clinic asked for the Salesforce doctor-contacts import to sit on the
 * Doctor Referrals report rather than on an admin page of its own - the
 * report is where the blank phone numbers are noticed.
 *
 * The registry is keyed by report key and deliberately lives outside
 * ReportConfig, so src/lib/reportsCatalog.ts stays a plain data module with
 * no React in it.
 */
describe("reportTool", () => {
  it("gives the Doctor Referrals report its contacts import", () => {
    const tool = reportTool("doctor_referrals");
    expect(tool).not.toBeNull();
    expect(tool?.label).toBe("Doctor contacts");
    expect(typeof tool?.Component).toBe("function");
  });

  it("gives every OTHER report nothing, so no button appears on them", () => {
    // The whole catalog, not a sample: a tool leaking onto an unrelated
    // report would put a Salesforce import in front of somebody reading
    // invoices.
    const withTools = REPORTS.map((r) => r.key).filter((k) => reportTool(k) !== null);
    expect(withTools).toEqual(["doctor_referrals"]);
  });

  it("has nothing to say about a key that is not a report", () => {
    expect(reportTool("")).toBeNull();
    expect(reportTool(null)).toBeNull();
    expect(reportTool(undefined)).toBeNull();
    expect(reportTool("no_such_report")).toBeNull();
  });

  it("names the dialog and says what it will do", () => {
    // The tool writes to the clinic's doctor list, so the dialog has to say
    // so before somebody presses anything.
    const tool = reportTool("doctor_referrals");
    expect(tool?.title).toMatch(/salesforce/i);
    expect(tool?.description).toMatch(/overwritten/i);
  });
});

/**
 * The permission boundary.
 *
 * Moving the contacts import off an admin page and onto a report widened who
 * can reach it: /admin/referring-doctors sits behind `settings`, the Doctor
 * Referrals report behind `reports`. Without this check anyone who can read
 * a report could run a Salesforce import against the clinic's doctor list.
 */
describe("visibleReportTool", () => {
  it("shows the tool to an admin", () => {
    expect(visibleReportTool("doctor_referrals", true)?.label).toBe("Doctor contacts");
  });

  it("shows NOTHING to everyone else, on the report that has one", () => {
    // Not disabled, not refused on press - absent. A receptionist opening
    // Doctor Referrals sees the report exactly as before.
    expect(visibleReportTool("doctor_referrals", false)).toBeNull();
  });

  it("shows nothing to an admin on a report with no tool", () => {
    expect(visibleReportTool("patients", true)).toBeNull();
    expect(visibleReportTool("invoices", true)).toBeNull();
  });

  it("is closed by default for anything unrecognised", () => {
    expect(visibleReportTool("no_such_report", true)).toBeNull();
    expect(visibleReportTool(null, true)).toBeNull();
    expect(visibleReportTool(undefined, false)).toBeNull();
  });
});
