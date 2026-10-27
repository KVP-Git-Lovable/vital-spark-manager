import { describe, it, expect } from "vitest";
import { referralKind, referrerStillApplies } from "./patientReferral";
import { PATIENT_SOURCE_OPTIONS } from "./patientSourceOptions";

describe("referralKind", () => {
  it("reads the two sources the Add form offers", () => {
    expect(referralKind("Dr. referral")).toBe("doctor");
    expect(referralKind("Referred by Patient")).toBe("patient");
  });

  // The whole reason this exists. Every one of these is a real source on live
  // patients, and the old checks matched none of them, so 546 patients had no
  // referrer field on any screen.
  it("reads the Salesforce-era sources no screen used to recognise", () => {
    expect(referralKind("Reference - other Dr")).toBe("doctor");
    expect(referralKind("Reference - other patients")).toBe("patient");
    expect(referralKind("Other Dr. referral")).toBe("doctor");
  });

  it("is not thrown by case or stray spacing", () => {
    expect(referralKind("  reference - OTHER DR  ")).toBe("doctor");
    expect(referralKind("REFERRED BY PATIENT")).toBe("patient");
  });

  it("treats a bare referral as a doctor, as the form always has", () => {
    expect(referralKind("Referral")).toBe("doctor");
  });

  it("says none for the sources that are not referrals", () => {
    for (const s of ["Walk-in", "Advertisement", "Campaign", "Other", "Social media", "salesforce"]) {
      expect(referralKind(s)).toBe("none");
    }
    expect(referralKind(null)).toBe("none");
    expect(referralKind(undefined)).toBe("none");
    expect(referralKind("   ")).toBe("none");
  });

  it("covers every source the app offers without a surprise", () => {
    for (const s of PATIENT_SOURCE_OPTIONS) {
      expect(["doctor", "patient", "none"]).toContain(referralKind(s));
    }
  });
});

describe("referrerStillApplies", () => {
  it("keeps the referrer while the kind is unchanged", () => {
    expect(referrerStillApplies("Dr. referral", "Reference - other Dr")).toBe(true);
    expect(referrerStillApplies("Referred by Patient", "Reference - other patients")).toBe(true);
  });

  // A doctor's name left behind in a column that is now read as a patient id is
  // how a referrer turns into an unresolvable uuid lookup on the Details tab.
  it("drops it when the kind changes", () => {
    expect(referrerStillApplies("Dr. referral", "Referred by Patient")).toBe(false);
    expect(referrerStillApplies("Referred by Patient", "Dr. referral")).toBe(false);
  });

  it("drops it when the new source is not a referral at all", () => {
    expect(referrerStillApplies("Dr. referral", "Walk-in")).toBe(false);
    expect(referrerStillApplies("Referred by Patient", "Advertisement")).toBe(false);
  });

  it("does not resurrect one when neither source is a referral", () => {
    expect(referrerStillApplies("Walk-in", "Advertisement")).toBe(false);
  });
});
