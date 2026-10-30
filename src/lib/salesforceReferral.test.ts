import { describe, it, expect } from "vitest";
import {
  referralFieldCandidates,
  isSafeSoqlField,
  usableReferrerName,
  type SfField,
} from "./salesforceReferral";

const f = (name: string, pct = 50): SfField => ({ name, filled: pct, of: 100, pct });

describe("referralFieldCandidates", () => {
  it("picks out the fields that could hold who referred the patient", () => {
    const got = referralFieldCandidates([
      f("Referred_by__c", 80),
      f("Mobile_Number__c", 99),
      f("Referring_Doctor__c", 40),
      f("Sex__c", 100),
    ]).map((x) => x.name);
    expect(got).toEqual(["Referred_by__c", "Referring_Doctor__c"]);
  });

  it("puts the better-filled field first, since an empty one cannot be it", () => {
    const got = referralFieldCandidates([f("Referral_Notes__c", 2), f("Referred_by__c", 73)]);
    expect(got.map((x) => x.name)).toEqual(["Referred_by__c", "Referral_Notes__c"]);
  });

  it("leaves out Patient_source__c, which is the flag already imported", () => {
    // Matching "source" here would bury the field actually wanted under the
    // one the clinic already has.
    const got = referralFieldCandidates([f("Patient_source__c", 100), f("Referred_by__c", 10)]);
    expect(got.map((x) => x.name)).toEqual(["Referred_by__c"]);
  });

  it("survives a describe call that returned nothing", () => {
    expect(referralFieldCandidates([])).toEqual([]);
    expect(referralFieldCandidates(null)).toEqual([]);
    expect(referralFieldCandidates(undefined)).toEqual([]);
  });
});

describe("isSafeSoqlField", () => {
  it("accepts a real Salesforce API name", () => {
    expect(isSafeSoqlField("Referred_by__c")).toBe(true);
    expect(isSafeSoqlField("Id")).toBe(true);
  });

  it("refuses anything that could carry a clause of its own", () => {
    // The name reaches the gateway inside a SELECT, so this is the guard.
    expect(isSafeSoqlField("Id FROM Patient__c WHERE Name != ''")).toBe(false);
    expect(isSafeSoqlField("Referred_by__c, Mobile_Number__c")).toBe(false);
    expect(isSafeSoqlField("Referred'by")).toBe(false);
    expect(isSafeSoqlField("(SELECT Id)")).toBe(false);
  });

  it("refuses an empty or absurd name", () => {
    expect(isSafeSoqlField("")).toBe(false);
    expect(isSafeSoqlField("   ")).toBe(false);
    expect(isSafeSoqlField(null)).toBe(false);
    expect(isSafeSoqlField("9Referred")).toBe(false);
    expect(isSafeSoqlField("A".repeat(81))).toBe(false);
  });
});

describe("usableReferrerName", () => {
  it("keeps a real name", () => {
    expect(usableReferrerName("Dr. Gaurav Shetty")).toBe("Dr. Gaurav Shetty");
    expect(usableReferrerName("  Dr.Jyothi  ")).toBe("Dr.Jyothi");
  });

  it("treats Salesforce's placeholders as nothing recorded", () => {
    // Storing one would turn "nobody wrote it down" into "written down as
    // nothing", and the report could no longer tell the two apart.
    for (const junk of ["-", "--", ".", "N/A", "na", "NIL", "none", "null", "0", ""]) {
      expect(usableReferrerName(junk)).toBe("");
    }
  });

  it("treats punctuation with no letters in it as nothing", () => {
    expect(usableReferrerName("???")).toBe("");
    expect(usableReferrerName("...")).toBe("");
  });

  it("survives a missing value", () => {
    expect(usableReferrerName(null)).toBe("");
    expect(usableReferrerName(undefined)).toBe("");
  });
});
