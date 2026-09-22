import { describe, it, expect } from "vitest";
import {
  GENDERS,
  normaliseDob,
  normaliseEmail,
  normaliseSex,
} from "../../supabase/functions/sf-import-demographics/demographics";

/**
 * Prescriptions print "Sex: -" and "Email: -" because these fields were never
 * imported. Salesforce has Sex__c for 100% of patients and Email_ID__c for
 * 96.7% - but a 97% fill rate on a clinic system usually means a required box
 * somebody had to put something in, so the filler has to be caught here.
 */

describe("normaliseSex", () => {
  it("maps the spellings a clinic actually types", () => {
    expect(normaliseSex("M")).toBe("Male");
    expect(normaliseSex("male")).toBe("Male");
    expect(normaliseSex(" Female ")).toBe("Female");
    expect(normaliseSex("F")).toBe("Female");
    expect(normaliseSex("Other")).toBe("Other");
    expect(normaliseSex("Prefer not to say")).toBe("Prefer not to say");
  });

  it("only ever returns a value the gender column will accept", () => {
    for (const raw of ["m", "F", "other", "TRANS", "unspecified"]) {
      const out = normaliseSex(raw);
      expect(out === null || (GENDERS as readonly string[]).includes(out)).toBe(true);
    }
  });

  it("refuses to guess at anything it does not recognise", () => {
    // Reported by the dry run so it can be mapped deliberately, not dropped.
    expect(normaliseSex("Unknown")).toBeNull();
    expect(normaliseSex("123")).toBeNull();
    expect(normaliseSex("")).toBeNull();
    expect(normaliseSex(null)).toBeNull();
  });
});

describe("normaliseEmail", () => {
  it("accepts a real address, lower-cased", () => {
    expect(normaliseEmail("  Priya.Rao@Gmail.com ")).toBe("priya.rao@gmail.com");
  });

  it("rejects the filler that a required field collects", () => {
    for (const junk of ["na", "N/A", "-", "none", "test@test.com", "abc@abc.com", "aaa@gmail.com"]) {
      expect(normaliseEmail(junk)).toBeNull();
    }
  });

  it("rejects anything that is not shaped like an address", () => {
    expect(normaliseEmail("priya at gmail")).toBeNull();
    expect(normaliseEmail("priya@gmail")).toBeNull();
    expect(normaliseEmail("@gmail.com")).toBeNull();
    expect(normaliseEmail("a@b.com")).toBeNull();
    expect(normaliseEmail("two@at@gmail.com")).toBeNull();
    expect(normaliseEmail("")).toBeNull();
  });
});

describe("normaliseDob", () => {
  const today = new Date("2026-09-21T00:00:00Z");

  it("keeps a plausible birth date", () => {
    expect(normaliseDob("1982-07-31", today)).toBe("1982-07-31");
    expect(normaliseDob("1982-07-31T00:00:00.000+0000", today)).toBe("1982-07-31");
  });

  it("rejects a date that does not exist rather than rolling it forward", () => {
    expect(normaliseDob("2001-02-30", today)).toBeNull();
    expect(normaliseDob("1990-13-01", today)).toBeNull();
  });

  it("rejects a birth date in the future or before 1900", () => {
    expect(normaliseDob("2030-01-01", today)).toBeNull();
    expect(normaliseDob("1899-12-31", today)).toBeNull();
  });

  it("rejects anything unparseable, leaving what this database already holds", () => {
    // 7,916 patients have a birth date here and Salesforce has one for 6.7% -
    // so a bad value must never become a write.
    expect(normaliseDob("31/07/1982", today)).toBeNull();
    expect(normaliseDob("", today)).toBeNull();
    expect(normaliseDob(null, today)).toBeNull();
  });
});
