import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UNCOUNTED_TABS, tabIsCounted, tabLabel } from "@/lib/appointmentTabCounts";

/**
 * Numbers on the appointment sheet's tabs.
 *
 * The patient record's tabs have carried these for a long time and the
 * appointment sheet's did not, so the clinic had to open each one to find out
 * whether anything was in it.
 */

const code = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SHEET = "src/components/appointments/AppointmentDetailSheet.tsx";

describe("the number beside the name", () => {
  it("reads like the patient record's", () => {
    expect(tabLabel("Billing", 5)).toBe("Billing (5)");
    expect(tabLabel("Previous Appointments", 12)).toBe("Previous Appointments (12)");
  });

  it("prints a zero rather than hiding it", () => {
    // A tab with no number beside nine that have one reads as still loading,
    // and "nothing here" is what somebody wants to know without clicking.
    expect(tabLabel("Survey", 0)).toBe("Survey (0)");
  });

  it("waits rather than showing a count it does not have", () => {
    // A number that flickers from (0) to (3) is worse than one that appears.
    expect(tabLabel("Notes", undefined)).toBe("Notes");
    expect(tabLabel("Notes", null)).toBe("Notes");
  });

  it("leaves the tabs that are a screen, not a list, bare", () => {
    expect(tabLabel("Details", 7)).toBe("Details");
    expect(tabLabel("AI Repository", 7)).toBe("AI Repository");
    expect(tabIsCounted("Details")).toBe(false);
    expect(tabIsCounted("AI Repository")).toBe(false);
    expect(tabIsCounted("Billing")).toBe(true);
    expect(UNCOUNTED_TABS).toHaveLength(2);
  });
});

describe("every list tab on the sheet has one", () => {
  const source = code(SHEET);

  for (const [name, from] of [
    ["Prescriptions", "procedures.length"],
    ["Previous Appointments", "previousAppointments.length"],
    ["Previous Prescriptions", "previousProcedures.length"],
    ["Billing", "invoices.length"],
    ["Photos", "photos.length"],
    ["Feedback", "tabFeedback ? 1 : 0"],
    ["Survey", "tabSurveys.length"],
    ["Attachments", "tabAttachments.length"],
    ["Notes", "tabNotes.length"],
  ] as const) {
    it(`${name} is counted`, () => {
      expect(source).toContain(`tabLabel("${name}", ${from})`);
    });
  }

  it("leaves Details and AI Repository alone", () => {
    expect(source).toContain('text-xs py-3">Details</TabsTrigger>');
    expect(source).toContain('text-xs py-3">AI Repository</TabsTrigger>');
  });

  it("counts feedback as one or none, which is all it can be", () => {
    // patient_feedback carries UNIQUE (appointment_id).
    expect(source).toContain("useAppointmentFeedback(appointmentId)");
    expect(source).toContain("tabFeedback ? 1 : 0");
  });
});

describe("a count must never change what a tab body gets", () => {
  /**
   * Only the OPEN tab's body is mounted. Opening the sheet at Details makes
   * the count the sole consumer of the shared key, so ITS queryFn fills the
   * cache - and the body then renders whatever the count fetched. A lighter
   * count query would quietly strip joined columns off the rows.
   *
   * The guard: each query exists exactly once, in a hook both use.
   */
  const files = {
    sheet: code(SHEET),
    attachments: code("src/components/patients/PatientAttachments.tsx"),
    patientPage: code("src/pages/PatientDetail.tsx"),
    surveys: code("src/components/surveys/SurveyRecommendations.tsx"),
    notes: code("src/components/shared/StickyNotes.tsx"),
    attachmentsHook: code("src/hooks/usePatientAttachments.ts"),
    tabHook: code("src/hooks/useAppointmentTabData.ts"),
  };

  /**
   * A second useQuery on the key - not an invalidateQueries, which is how a
   * write tells everybody to refetch and must stay.
   */
  const secondQueryOn = (key: string) =>
    new RegExp(`useQuery\\(\\{[\\s\\S]{0,80}?queryKey: \\["${key}"`);

  it("the attachments query lives only in its hook", () => {
    expect(files.attachmentsHook).toContain('from("procedure_attachments")');
    for (const source of [files.sheet, files.attachments, files.patientPage]) {
      expect(source).not.toMatch(secondQueryOn("patient-attachments"));
    }
    expect(files.attachments).toContain("usePatientAttachments(patientId)");
    expect(files.patientPage).toContain("usePatientAttachments(id)");
  });

  it("the survey-responses query lives only in its hook", () => {
    expect(files.tabHook).toContain('from("survey_responses")');
    expect(files.tabHook).toContain("survey_templates(name)");
    for (const source of [files.sheet, files.surveys]) {
      expect(source).not.toMatch(secondQueryOn("survey-responses"));
    }
    expect(files.surveys).toContain("useAppointmentSurveyResponses(appointmentId, patientId)");
  });

  it("the sticky-notes query lives only in its hook", () => {
    expect(files.tabHook).toContain('.order("updated_at", { ascending: false })');
    for (const source of [files.sheet, files.notes]) {
      expect(source).not.toMatch(secondQueryOn("sticky-notes"));
    }
    expect(files.notes).toContain("useStickyNotes(owner)");
  });

  it("the feedback query lives only in its hook", () => {
    expect(files.tabHook).toContain('from("patient_feedback")');
    expect(files.tabHook).toContain("maybeSingle()");
    expect(files.sheet).not.toMatch(secondQueryOn("patient-feedback"));
  });

  it("notes still work for a procedure, not only an appointment", () => {
    // StickyNotes serves both, and the hook takes the OWNER for that reason.
    expect(files.tabHook).toContain("export function useStickyNotes(owner:");
    expect(files.tabHook).toContain('owner.table as "procedure_sticky_notes"');
    expect(files.notes).toContain("stickyNoteOwner({ procedureId, appointmentId })");
  });
});
