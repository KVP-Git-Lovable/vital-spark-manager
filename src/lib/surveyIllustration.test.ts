import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  ILLUSTRATION_RULES,
  SURVEY_ILLUSTRATION_KEYS,
  illustrationFor,
  normalizeQuestionText,
  type SurveyIllustrationKey,
} from "./surveyIllustration";

/**
 * Every question in the clinic's six live templates, with the type it is
 * stored as. Read out of the database so the resolver is tested against the
 * wording patients actually see rather than invented examples.
 */
const LIVE_QUESTIONS: ReadonlyArray<[text: string, type: string]> = [
  // Acne
  ["How much does your acne bother you on a scale of 1 to 10, where 1 is not at all and 10 is very much?", "scale"],
  ["How long have you been dealing with acne?", "single_choice"],
  ["What does your acne typically look like?", "multi_choice"],
  ["Where on your body do you usually get acne?", "multi_choice"],
  ["How often do you have acne flare-ups or new breakouts?", "single_choice"],
  ["What treatments have you tried for your acne?", "multi_choice"],
  ["Do you notice any triggers that make your acne worse?", "multi_choice"],
  ["How does your acne affect your daily life?", "text"],
  ["What do you hope to achieve with acne treatment?", "multi_choice"],
  ["Is there anything else you would like us to know about your acne?", "text"],
  // Aesthetic skin
  ["What made you think about getting aesthetic skin treatments?", "multi_choice"],
  ["What specific skin concerns do you want to improve or address?", "multi_choice"],
  ["How much do these skin concerns bother you on a scale of 1 to 10?", "scale"],
  ["Have you had any aesthetic skin treatments before?", "single_choice"],
  ["What type of aesthetic treatments are you most interested in or curious about?", "multi_choice"],
  ["How important is it for you to see quick results from a treatment?", "scale"],
  ["What is your biggest concern about getting aesthetic skin treatments?", "single_choice"],
  ["Is there anything else you would like us to know about your skin concerns or treatment preferences?", "text"],
  // Body sculpting
  ["What areas of your body are you hoping to improve?", "multi_choice"],
  ["How much does your body shape bother you?", "scale"],
  ["What are your main goals for a body contouring or fat loss treatment?", "multi_choice"],
  ["Have you tried anything else to achieve your body goals?", "single_choice"],
  ["How long have you been concerned about these areas of your body?", "single_choice"],
  ["Are you looking for a treatment with little to no downtime, or are you open to a longer recovery period?", "single_choice"],
  ["What is your current activity level?", "single_choice"],
  ["Are you currently pregnant or breastfeeding?", "single_choice"],
  ["Do you have any health conditions that might affect treatment?", "text"],
  ["What does a successful outcome look like to you?", "text"],
  // General
  ["What is your current occupation or day-to-day job?", "text"],
  ["Where do you spend most of your working day?", "single_choice"],
  ["What activities do you spend the most time doing outside of work?", "multi_choice"],
  ["On an average day, how much time do you spend outside in the sun?", "single_choice"],
  ["On a scale from 1 to 10, how would you rate your everyday stress level? (1 = very relaxed, 10 = extremely stressed)", "scale"],
  ["On average, how many hours of sleep do you get each night?", "single_choice"],
  ["Do you currently smoke or use tobacco products?", "single_choice"],
  ["Does anyone in your close family (parents, siblings) have a history of skin conditions?", "multi_choice"],
  ["Do you notice your skin problems flare up when you feel stressed or run down?", "single_choice"],
  ["Is there anything else about your daily routine, habits, or family background you'd like us to know?", "text"],
  // Hair loss
  ["How much does your hair loss bother you?", "scale"],
  ["When did you first notice your hair starting to fall out or get thinner?", "single_choice"],
  ["Have you noticed hair falling out in specific areas, or all over your head?", "single_choice"],
  ["How would you describe your current hair thinning?", "single_choice"],
  ["Do you also experience dandruff or an itchy scalp?", "single_choice"],
  ["Have you tried any treatments for your hair loss or thinning?", "multi_choice"],
  ["How often do you wash your hair?", "single_choice"],
  ["Do you notice more hair falling out when you brush, wash, or style your hair?", "multi_choice"],
  ["Has anyone in your close family (parents, siblings) experienced similar hair loss or thinning?", "single_choice"],
  ["Is there anything else you want to tell us about your hair loss or scalp concerns?", "text"],
  // Pigmentation
  ["When did you first notice the changes in your skin color?", "single_choice"],
  ["Where on your body do you notice the skin darkening or spots?", "multi_choice"],
  ["How much does the change in your skin color bother you?", "scale"],
  ["Have the dark spots or patches changed in size or color recently?", "single_choice"],
  ["Do you notice your skin color getting darker after being in the sun?", "single_choice"],
  ["What does your daily skincare routine look like?", "text"],
  ["Have you tried any treatments or products for your skin discoloration?", "single_choice"],
  ["Are you currently pregnant or have you recently given birth?", "single_choice"],
  ["Do you use any hormonal medications, like birth control pills?", "single_choice"],
  ["Do you have any family members with similar skin discoloration?", "single_choice"],
];

describe("the live survey questions all get a drawing", () => {
  it("covers all 58 of them", () => {
    expect(LIVE_QUESTIONS.length).toBe(58);
  });

  it("resolves every one to a key the component can draw", () => {
    for (const [text, type] of LIVE_QUESTIONS) {
      const key = illustrationFor(text, type);
      expect(SURVEY_ILLUSTRATION_KEYS, `"${text.slice(0, 40)}" gave ${key}`).toContain(key);
    }
  });

  it("spreads them across the set instead of collapsing onto one picture", () => {
    // A keyword edit that makes one rule swallow everything would still
    // "resolve" every question; this is what notices.
    const used = new Set(LIVE_QUESTIONS.map(([t, k]) => illustrationFor(t, k)));
    expect(used.size, `only ${used.size} drawings used`).toBeGreaterThanOrEqual(14);
    const counts = new Map<SurveyIllustrationKey, number>();
    for (const [t, k] of LIVE_QUESTIONS) {
      const key = illustrationFor(t, k);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const biggest = Math.max(...counts.values());
    expect(biggest, "one drawing is used for too many questions").toBeLessThanOrEqual(12);
  });
});

/**
 * The four questions that went to the wrong drawing on the first pass. Each
 * one is a rule-ordering bug, and each would come straight back if the rules
 * were re-sorted alphabetically or "tidied".
 */
describe("the ordering bugs that the live data caught", () => {
  it("reads a scale as severity, not as a body location", () => {
    // The scale's own wording contains "where 1 is not at all".
    expect(
      illustrationFor(
        "How much does your acne bother you on a scale of 1 to 10, where 1 is not at all and 10 is very much?",
        "scale",
      ),
    ).toBe("severity");
  });

  it("reads the closing free-text question as a note, whatever topic it names", () => {
    expect(illustrationFor("Is there anything else you want to tell us about your hair loss or scalp concerns?", "text")).toBe("chat");
    expect(illustrationFor("Is there anything else about your daily routine, habits, or family background you'd like us to know?", "text")).toBe("chat");
    expect(illustrationFor("Is there anything else you would like us to know about your skin concerns or treatment preferences?", "text")).toBe("chat");
  });

  it("still reads a goal question as a goal, despite the words 'anything else'", () => {
    // Why the catch-all asks for "is there anything else" and not just
    // "anything else".
    expect(illustrationFor("Have you tried anything else to achieve your body goals?", "single_choice")).toBe("target");
  });

  it("does not read 'outside of work' as sunshine", () => {
    expect(illustrationFor("What activities do you spend the most time doing outside of work?", "multi_choice")).toBe("checklist");
    expect(illustrationFor("On an average day, how much time do you spend outside in the sun?", "single_choice")).toBe("sun");
  });
});

describe("illustrationFor", () => {
  it("prefers the question's wording over its type", () => {
    expect(illustrationFor("When did you first notice it?", "single_choice")).toBe("calendar");
    expect(illustrationFor("Do you currently smoke?", "single_choice")).toBe("smoking");
  });

  it("falls back on the type when nothing matches", () => {
    expect(illustrationFor("A question about nothing in particular", "text")).toBe("chat");
    expect(illustrationFor("A question about nothing in particular", "multi_choice")).toBe("checklist");
    expect(illustrationFor("A question about nothing in particular", "single_choice")).toBe("choice");
    expect(illustrationFor("A question about nothing in particular", "scale")).toBe("severity");
  });

  it("always returns something, however odd the input", () => {
    for (const text of ["", "   ", null, undefined, "?!?!", "ಹೇಗಿದೆ ನಿಮ್ಮ ಚರ್ಮ"]) {
      expect(SURVEY_ILLUSTRATION_KEYS).toContain(illustrationFor(text, "text"));
    }
    expect(SURVEY_ILLUSTRATION_KEYS).toContain(illustrationFor("anything", "ranking"));
    expect(SURVEY_ILLUSTRATION_KEYS).toContain(illustrationFor(null, null));
  });

  it("ignores case and punctuation", () => {
    expect(illustrationFor("WHERE ON YOUR BODY?", "multi_choice")).toBe("bodyMap");
    expect(illustrationFor("Where, on your body...?", "multi_choice")).toBe("bodyMap");
  });

  it("does not depend on the question's position", () => {
    // The shop's keyword router cycles its images by index. Doing that here
    // would change a question's picture whenever it was dragged to a new
    // place in the builder.
    const source = readFileSync("src/lib/surveyIllustration.ts", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "the resolver takes an index").not.toMatch(/index/);
  });
});

describe("normalizeQuestionText", () => {
  it("flattens to lowercase words", () => {
    expect(normalizeQuestionText("Where, on your BODY?")).toBe("where on your body");
    expect(normalizeQuestionText(null)).toBe("");
    expect(normalizeQuestionText("  ")).toBe("");
  });
});

describe("the rule table", () => {
  it("names no key twice and no key the component cannot draw", () => {
    const keys = ILLUSTRATION_RULES.map((r) => r.key);
    expect(new Set(keys).size, "a key appears in two rules").toBe(keys.length);
    for (const key of keys) expect(SURVEY_ILLUSTRATION_KEYS).toContain(key);
  });

  it("uses no keyword twice, so 'which rule wins' is only about order", () => {
    const seen = new Map<string, SurveyIllustrationKey>();
    for (const rule of ILLUSTRATION_RULES) {
      for (const keyword of rule.keywords) {
        expect(seen.has(keyword), `"${keyword}" is in both ${seen.get(keyword)} and ${rule.key}`).toBe(false);
        seen.set(keyword, rule.key);
      }
    }
  });

  it("every key has a drawing in the component", () => {
    const component = readFileSync("src/components/portal/SurveyIllustration.tsx", "utf8");
    for (const key of SURVEY_ILLUSTRATION_KEYS) {
      expect(component, `no drawing for "${key}"`).toContain(`case "${key}"`);
    }
  });

  it("the drawings carry no hardcoded colours", () => {
    // AGENTS.md: semantic CSS tokens, so the set themes itself in dark mode.
    const component = readFileSync("src/components/portal/SurveyIllustration.tsx", "utf8");
    expect(component, "a hex colour is baked into a drawing").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(component, "an hsl() literal is baked into a drawing").not.toMatch(/hsl\(\s*\d/);
  });
});
