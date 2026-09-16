import { describe, it, expect } from "vitest";
import {
  buildConsultationReasonsForSave,
  parseConsultationReasonsForEdit,
} from "./ConsultationReasonPicker";

/**
 * These two must stay exact inverses. The consultation reasons now live on the
 * patient, which means they are EDITED rather than only created - and a lossy
 * round trip would quietly drop whatever a doctor typed into "Others" the next
 * time anyone opened and saved that patient.
 */
describe("consultation reasons round trip", () => {
  const cases: [string, string[], string, string][] = [
    ["plain reasons", ["Acne", "Hair Loss"], "", ""],
    ["others aesthetic with text", ["Acne", "Others (Aesthetic)"], "Melasma flare", ""],
    ["others clinical with text", ["Itching", "Others (Clinical)"], "", "Contact dermatitis"],
    ["both others", ["Others (Aesthetic)", "Others (Clinical)"], "Bridal prep", "Eczema"],
    ["others with no text typed", ["Others (Aesthetic)"], "", ""],
    ["nothing at all", [], "", ""],
  ];

  for (const [name, reasons, aesthetic, clinical] of cases) {
    it(`survives a save/load cycle: ${name}`, () => {
      const saved = buildConsultationReasonsForSave(reasons, aesthetic, clinical);
      const back = parseConsultationReasonsForEdit(saved);
      expect(back.reasons).toEqual(reasons);
      expect(back.othersAestheticText).toBe(aesthetic);
      expect(back.othersClinicalText).toBe(clinical);
    });
  }

  it("survives being saved twice, which is what repeated edits do", () => {
    const once = buildConsultationReasonsForSave(["Others (Clinical)"], "", "Psoriasis");
    const back = parseConsultationReasonsForEdit(once);
    const twice = buildConsultationReasonsForSave(back.reasons, back.othersAestheticText, back.othersClinicalText);
    expect(twice).toEqual(once);
  });

  it("copes with null, as a patient who has never had one recorded", () => {
    expect(parseConsultationReasonsForEdit(null)).toEqual({
      reasons: [], othersAestheticText: "", othersClinicalText: "",
    });
  });

  it("keeps a free-text value that itself contains a colon", () => {
    const saved = buildConsultationReasonsForSave(["Others (Aesthetic)"], "Ref: Dr Rao", "");
    expect(parseConsultationReasonsForEdit(saved).othersAestheticText).toBe("Ref: Dr Rao");
  });
});
