import type { ComponentType } from "react";
import { Phone, type LucideIcon } from "lucide-react";
import { DoctorContactsImport } from "@/components/reports/DoctorContactsImport";

/**
 * Actions a report offers beside Export, for fixing what the report shows.
 *
 * The clinic asked for the Salesforce doctor-contacts import to live on the
 * Doctor Referrals report rather than on an admin page of its own: the
 * report is where you are standing when you notice the blank names and
 * phone numbers, and walking somewhere else to fill them in is the kind of
 * detour nobody makes.
 *
 * Kept OUT of ReportConfig deliberately. src/lib/reportsCatalog.ts is a
 * plain data module - a .ts file its tests treat as data - and putting a
 * React component in it would drag JSX in with it. A registry keyed by
 * report key lets any report gain a tool later without the catalog knowing
 * anything about React.
 *
 * WHO MAY PRESS IT is not decided here. These tools came from pages behind
 * admin settings, and a report is a wider audience than that, so ReportView
 * renders them for admins only. A tool added here inherits that.
 */
export interface ReportTool {
  /** On the button, beside Export CSV and Export PDF. */
  label: string;
  icon: LucideIcon;
  /** The dialog's heading. */
  title: string;
  /** One line under it, saying what the tool will do. */
  description?: string;
  Component: ComponentType;
}

const REPORT_TOOLS: Record<string, ReportTool> = {
  doctor_referrals: {
    label: "Doctor contacts",
    icon: Phone,
    title: "Doctor contact details from Salesforce",
    description:
      "Fills the Doctor Phone column on this report. Nothing typed here is overwritten.",
    Component: DoctorContactsImport,
  },
};

/** The tool for a report, or nothing - which is the case for all but one. */
export function reportTool(key: string | null | undefined): ReportTool | null {
  if (!key) return null;
  return REPORT_TOOLS[key] ?? null;
}

/**
 * The tool a given person may actually see on a given report.
 *
 * The permission boundary, kept as a plain function so it can be tested
 * without standing up the whole report page.
 *
 * These tools came from pages behind admin settings, and reports are a much
 * wider audience: the Doctor Referrals report is readable by anyone with
 * `reports` access, while the contacts import it now carries writes to the
 * clinic's doctor list from Salesforce. Non-admins see the report exactly
 * as they did before - the button is not rendered at all, rather than
 * rendered and refused.
 */
export function visibleReportTool(
  key: string | null | undefined,
  isAdmin: boolean,
): ReportTool | null {
  if (!isAdmin) return null;
  return reportTool(key);
}
