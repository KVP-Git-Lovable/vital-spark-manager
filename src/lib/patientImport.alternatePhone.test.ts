import { describe, it, expect } from "vitest";
import { autoDetectMapping, PATIENT_FIELDS } from "./patientImport";

describe("importing a spreadsheet that carries two numbers", () => {
  it("tells the alternate number apart from the main one", () => {
    const mapping = autoDetectMapping(["Phone", "Alternate Phone"]);
    expect(mapping["Phone"]).toBe("phone");
    expect(mapping["Alternate Phone"]).toBe("alternate_phone");
  });

  it("recognises the names the clinic's own sheets use", () => {
    for (const header of ["Alternate Number", "Secondary Phone", "International Number", "Phone 2"]) {
      expect(autoDetectMapping([header])[header]).toBe("alternate_phone");
    }
  });

  it("does not steal the plain phone column", () => {
    for (const header of ["Phone", "Mobile Number", "Contact"]) {
      expect(autoDetectMapping([header])[header]).toBe("phone");
    }
  });

  it("is an importable field at all", () => {
    expect(PATIENT_FIELDS).toContain("alternate_phone");
  });
});
