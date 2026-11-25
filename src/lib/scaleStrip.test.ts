import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NPS_ANCHORS, SCALE_GRADIENT, SCALE_STRIP_MAX, scaleAnchors, scaleFitsStrip, scaleSegmentStyle,
} from "./scaleStrip";
import { feedbackQuestionSchema, type FeedbackQuestion } from "./feedbackQuestions";

/**
 * The strip's arithmetic and its wording.
 *
 * Both are the kind of thing that looks right on one screen and is wrong on
 * the next: a ramp that stops short of green is only visible if you know what
 * full green looks like, and a borrowed label is only wrong if you know what
 * question it was borrowed onto.
 */

const question = (over: Partial<FeedbackQuestion> = {}): FeedbackQuestion =>
  feedbackQuestionSchema.parse({
    id: "q1",
    question_text: "How likely are you to recommend us to a friend or colleague?",
    question_type: "scale_10",
    options: { min: 0, max: 10 },
    builtin: "nps",
    ...over,
  });

/** The horizontal half only, so a change to the vertical half cannot quietly
    turn every assertion below into a comparison against NaN. */
const positionOf = (index: number, count: number): number =>
  Number(String(scaleSegmentStyle(index, count).backgroundPosition).split(" ")[0].replace("%", ""));

describe("scaleSegmentStyle", () => {
  it("starts the first segment at the worst end and finishes the last at the best", () => {
    expect(positionOf(0, 11)).toBe(0);
    expect(positionOf(10, 11)).toBe(100);
  });

  it("walks the ramp in step, so no two segments share a colour", () => {
    const positions = Array.from({ length: 11 }, (_, i) => positionOf(i, 11));
    expect(positions).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("sizes the gradient to the whole strip, whatever its length", () => {
    expect(scaleSegmentStyle(0, 11).backgroundSize).toBe("1100% 100%");
    expect(scaleSegmentStyle(0, 7).backgroundSize).toBe("700% 100%");
  });

  it("reaches the best end on a shorter scale too", () => {
    expect(positionOf(6, 7)).toBe(100);
    expect(positionOf(3, 7)).toBe(50);
  });

  it("does not divide by zero on a one-answer scale", () => {
    const style = scaleSegmentStyle(0, 1);
    expect(style.backgroundPosition).toBe("0% 50%");
    expect(String(style.backgroundPosition)).not.toContain("NaN");
    expect(String(style.backgroundSize)).not.toContain("NaN");
  });

  it("paints every segment from the same three theme tokens", () => {
    expect(scaleSegmentStyle(4, 11).backgroundImage).toBe(SCALE_GRADIENT);
    for (const token of ["--scale-low", "--scale-mid", "--scale-high"]) {
      expect(SCALE_GRADIENT).toContain(`hsl(var(${token}))`);
    }
    // A hardcoded colour here would survive dark mode by accident at best.
    expect(SCALE_GRADIENT).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("scaleFitsStrip", () => {
  it("takes the lengths a feedback form actually asks", () => {
    expect(scaleFitsStrip(11)).toBe(true); // 0 to 10, the recommend question
    expect(scaleFitsStrip(7)).toBe(true); // 1 to 7
    expect(scaleFitsStrip(2)).toBe(true);
  });

  it("hands back a scale too long to put a finger on", () => {
    // Written out, not SCALE_STRIP_MAX ± 1, which would agree with the
    // constant wherever it was moved to and pin nothing.
    expect(scaleFitsStrip(21)).toBe(true);
    expect(scaleFitsStrip(22)).toBe(false);
    expect(SCALE_STRIP_MAX).toBe(21);
    expect(scaleFitsStrip(101)).toBe(false); // 0 to 100, one stray digit away
  });

  it("hands back what is not a scale at all", () => {
    expect(scaleFitsStrip(1)).toBe(false); // min equals max
    expect(scaleFitsStrip(0)).toBe(false);
    expect(scaleFitsStrip(-3)).toBe(false); // max below min
    expect(scaleFitsStrip(11.5)).toBe(false); // a fractional bound skews the ramp
    expect(scaleFitsStrip(Number.NaN)).toBe(false);
  });
});

describe("the tokens the strip paints with", () => {
  const css = readFileSync("src/index.css", "utf8");
  const block = (selector: string): string => {
    const at = css.indexOf(selector);
    expect(at, `${selector} is gone from index.css`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("\n  }", at));
  };

  /* Nothing else would notice these going missing: an undeclared token paints
     a transparent plate, and the numbers would sit on the card in near-black
     with the ramp simply absent. --success, --warning and --info have no dark
     value at all, which is why the strip has its own stops rather than
     borrowing theirs - so both themes have to be checked. */
  it.each(["--scale-low", "--scale-mid", "--scale-high", "--scale-ink"])(
    "declares %s for light and for dark",
    (token) => {
      expect(block(":root")).toContain(`${token}:`);
      expect(block(".dark")).toContain(`${token}:`);
    },
  );
});

describe("scaleAnchors", () => {
  it("labels the recommend question's two ends", () => {
    expect(scaleAnchors(question())).toEqual({
      low: "Not at all likely",
      high: "Extremely likely",
    });
    expect(NPS_ANCHORS.low).toBe("Not at all likely");
  });

  it("says nothing under a question it was not written for", () => {
    expect(scaleAnchors(question({ builtin: null, question_text: "How clean was the room?" }))).toBeNull();
  });

  it("prefers wording the clinic set on the question itself", () => {
    const asked = question({
      builtin: null,
      options: { min: 1, max: 7, minLabel: "Very difficult", maxLabel: "Very easy" },
    });
    expect(scaleAnchors(asked)).toEqual({ low: "Very difficult", high: "Very easy" });
  });

  it("lets the clinic's wording override the built-in default", () => {
    const asked = question({ options: { min: 0, max: 10, minLabel: "Never", maxLabel: "Definitely" } });
    expect(scaleAnchors(asked)).toEqual({ low: "Never", high: "Definitely" });
  });

  it("keeps one end when only one end is worded", () => {
    const asked = question({ builtin: null, options: { minLabel: "Worst" } });
    expect(scaleAnchors(asked)).toEqual({ low: "Worst", high: "" });
  });

  it("ignores options that are not usable text", () => {
    expect(scaleAnchors(question({ builtin: null, options: { minLabel: 7, maxLabel: null } }))).toBeNull();
    expect(scaleAnchors(question({ builtin: null, options: { minLabel: "   " } }))).toBeNull();
    expect(scaleAnchors(question({ builtin: null, options: ["Very difficult"] }))).toBeNull();
  });

  it("trims what it is given, so a stray space is not drawn as wording", () => {
    const asked = question({ builtin: null, options: { minLabel: "  Low  ", maxLabel: " High " } });
    expect(scaleAnchors(asked)).toEqual({ low: "Low", high: "High" });
  });
});
