import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  forgetOpenAppointment,
  readOpenAppointment,
  rememberOpenAppointment,
  returnLabel,
  shouldOfferReturn,
} from "./openAppointment";

/**
 * Front desk open an appointment, go to Billing, then tap the Appointments menu
 * item to come back - and get the list. This is what lets every other page offer
 * one tap back to the appointment they actually left.
 */
describe("shouldOfferReturn", () => {
  const open = { id: "abc", patientName: "Ram Sundar" };

  it("offers the way back from another section", () => {
    expect(shouldOfferReturn("/billing", open)).toBe(true);
    expect(shouldOfferReturn("/patients", open)).toBe(true);
  });

  it("offers it on the appointments list too - that is where the menu lands you", () => {
    expect(shouldOfferReturn("/appointments", open)).toBe(true);
  });

  it("stays out of the way on the appointment's own page", () => {
    expect(shouldOfferReturn("/appointments/abc", open)).toBe(false);
  });

  it("still offers it on a different appointment's page", () => {
    expect(shouldOfferReturn("/appointments/xyz", open)).toBe(true);
  });

  it("offers nothing when no appointment is open", () => {
    expect(shouldOfferReturn("/billing", null)).toBe(false);
    expect(shouldOfferReturn("/billing", { id: "", patientName: "X" })).toBe(false);
  });
});

describe("returnLabel", () => {
  it("names the patient, so it is clear which appointment it returns to", () => {
    expect(returnLabel({ id: "a", patientName: "Ram Sundar" })).toBe("Back to Ram Sundar's appointment");
  });

  it("falls back when the name is missing rather than reading 'Back to 's appointment'", () => {
    expect(returnLabel({ id: "a", patientName: "" })).toBe("Back to the appointment");
    expect(returnLabel({ id: "a", patientName: "   " })).toBe("Back to the appointment");
    expect(returnLabel(null)).toBe("Back to the appointment");
  });
});

describe("remembering across a page navigation", () => {
  beforeEach(() => forgetOpenAppointment());

  it("round trips", () => {
    rememberOpenAppointment({ id: "abc", patientName: "Ram Sundar" });
    expect(readOpenAppointment()).toEqual({ id: "abc", patientName: "Ram Sundar" });
  });

  it("reads nothing once the appointment is closed", () => {
    rememberOpenAppointment({ id: "abc", patientName: "Ram Sundar" });
    forgetOpenAppointment();
    expect(readOpenAppointment()).toBeNull();
  });

  it("treats a corrupt value as nothing open, rather than throwing in the layout", () => {
    sessionStorage.setItem("openAppointment", "{not json");
    expect(readOpenAppointment()).toBeNull();
  });

  it("survives storage being unavailable, as in a private window", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readOpenAppointment()).toBeNull();
    getItem.mockRestore();
  });
});
