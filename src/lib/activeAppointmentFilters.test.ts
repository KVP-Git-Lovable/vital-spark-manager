import { describe, it, expect } from "vitest";
import { activeAppointmentFilters, emptyAppointmentsMessage } from "./activeAppointmentFilters";

const LABELS: Record<string, string> = {
  today: "Today",
  this_week: "This Week",
  last_week: "Last Week",
  all: "All Dates",
};
const label = (key: string) => LABELS[key];

describe("activeAppointmentFilters", () => {
  it("says nothing when the list is showing everything", () => {
    expect(
      activeAppointmentFilters({ datePreset: "all", doctorNames: [], status: "all", visitStatus: "all", search: "" })
    ).toEqual([]);
    expect(activeAppointmentFilters({ datePreset: "all" })).toEqual([]);
  });

  it("names a date preset the way the filter panel names it", () => {
    expect(activeAppointmentFilters({ datePreset: "last_week", datePresetLabel: label })).toEqual(["Last Week"]);
  });

  it("falls back to the key when there is no label for it", () => {
    expect(activeAppointmentFilters({ datePreset: "last_quarter", datePresetLabel: label })).toEqual(["last_quarter"]);
  });

  it("names every doctor the list is pinned to", () => {
    expect(
      activeAppointmentFilters({ datePreset: "all", doctorNames: ["Dr Punya Suvarna", "Dr Vindhya Pai"] })
    ).toEqual(["Dr Punya Suvarna", "Dr Vindhya Pai"]);
  });

  it("names a status and a visit status, but never the word all", () => {
    expect(activeAppointmentFilters({ datePreset: "all", status: "Confirmed", visitStatus: "all" })).toEqual([
      "Confirmed",
    ]);
    expect(activeAppointmentFilters({ datePreset: "all", status: "all", visitStatus: "Completed" })).toEqual([
      "Completed",
    ]);
  });

  it("quotes a search term so it reads as something typed", () => {
    expect(activeAppointmentFilters({ datePreset: "all", search: "smitha hegde" })).toEqual(["“smitha hegde”"]);
  });

  it("ignores blanks and whitespace rather than showing an empty chip", () => {
    expect(
      activeAppointmentFilters({ datePreset: "   ", doctorNames: ["", "  "], status: " ", visitStatus: "", search: "  " })
    ).toEqual([]);
  });

  it("lists them in the order the panel shows them", () => {
    // The combination that produced the report: a remembered week, a doctor,
    // and a status, over a day with 43 appointments in it.
    expect(
      activeAppointmentFilters({
        datePreset: "last_week",
        datePresetLabel: label,
        doctorNames: ["Dr Punya Suvarna"],
        status: "Confirmed",
        visitStatus: "Completed",
        search: "hegde",
      })
    ).toEqual(["Last Week", "Dr Punya Suvarna", "Confirmed", "Completed", "“hegde”"]);
  });
});

describe("emptyAppointmentsMessage", () => {
  it("stays the plain line when nothing is filtering", () => {
    expect(emptyAppointmentsMessage([])).toBe("No appointments found");
  });

  it("says what to clear when something is", () => {
    expect(emptyAppointmentsMessage(["Last Week", "Dr Punya Suvarna"])).toBe(
      "No appointments match Last Week · Dr Punya Suvarna"
    );
  });
});
