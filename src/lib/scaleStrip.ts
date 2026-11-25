import type { CSSProperties } from "react";
import type { FeedbackQuestion } from "@/lib/feedbackQuestions";

/**
 * A scoring question drawn as one strip, worst end to best.
 *
 * Eleven identical outlined squares told the person filling the form nothing
 * about which end was good - the numbers were the only clue, and they had to
 * be read. A ramp says it before anything is read.
 *
 * ── Why each segment paints the whole gradient ──
 *
 * The obvious build is one gradient on the container with transparent buttons
 * over it. It cannot be: the chosen segment has to lift out of the strip, and
 * a transparent child lifts nothing - the colour would stay behind on the
 * parent. So every segment carries the same full-width gradient, sized to the
 * whole strip and slid to its own position, and the segments reassemble one
 * continuous ramp while each still owns the colour under it.
 *
 * The alternative, a per-segment colour from color-mix(), would have been one
 * CSS feature between a clinic phone and a form it has to fill in. This needs
 * nothing newer than a background-position.
 */

/** The three stops, as tokens, so the ramp follows the theme. */
export const SCALE_GRADIENT =
  "linear-gradient(90deg, hsl(var(--scale-low)), hsl(var(--scale-mid)), hsl(var(--scale-high)))";

/**
 * Where one segment's slice of the ramp sits.
 *
 * The divisor is count - 1, not count: with eleven segments the last one must
 * land at 100%, the right-hand end of the gradient. Divided by eleven it would
 * stop at 91% and the strip would never reach full green.
 */
export function scaleSegmentStyle(index: number, count: number): CSSProperties {
  const span = count - 1;
  const position = span > 0 ? (index / span) * 100 : 0;
  return {
    backgroundImage: SCALE_GRADIENT,
    backgroundSize: `${count * 100}% 100%`,
    backgroundPosition: `${position}% 50%`,
  };
}

/**
 * How long a strip can be and still be a control.
 *
 * The bounds are read from free-form json, so a scale of 0 to 100 is one
 * stray digit away. Twenty-one segments (0 to 20) is about where a segment
 * stops being wide enough for a fingertip on the narrowest screen this is
 * drawn on - the portal's dialog, around 300px. Longer than that, or a
 * fraction, and the caller draws the plain row of buttons, which wraps.
 */
export const SCALE_STRIP_MAX = 21;

export const scaleFitsStrip = (count: number): boolean =>
  Number.isInteger(count) && count >= 2 && count <= SCALE_STRIP_MAX;

/** The words under the two ends of the recommend question. */
export const NPS_ANCHORS = { low: "Not at all likely", high: "Extremely likely" } as const;

export interface ScaleAnchors {
  low: string;
  high: string;
}

/**
 * What to write under each end, or nothing.
 *
 * A clinic can add its own scoring questions, and root-cause cases ask their
 * own. Putting "Not at all likely" under one of those would be this file
 * inventing wording for a question it has never seen, so the default is only
 * ever offered to the recommend question itself. Anything else says so in
 * options, which is free-form json and needs no migration to start using.
 */
export function scaleAnchors(question: FeedbackQuestion): ScaleAnchors | null {
  const options =
    question.options && typeof question.options === "object" && !Array.isArray(question.options)
      ? (question.options as Record<string, unknown>)
      : {};
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  const low = text(options.minLabel);
  const high = text(options.maxLabel);
  if (low || high) return { low, high };
  return question.builtin === "nps" ? { ...NPS_ANCHORS } : null;
}
