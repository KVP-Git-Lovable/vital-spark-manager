/**
 * Which picture a survey question gets.
 *
 * The clinic wanted something friendlier than a wall of radio buttons, and
 * chose drawings in the app over an image field somebody would have to fill
 * in for all 58 existing questions. So each question is matched to one of a
 * small set of drawings by what it asks about.
 *
 * The shape follows `getSampleImage` in src/pages/shop/ShopHome.tsx, with one
 * deliberate difference: there is NO fallback that depends on the question's
 * position. The shop cycles through its images by index; doing that here
 * would change a question's picture whenever the clinic dragged it to a new
 * place in the builder. A question's drawing is a function of what it asks
 * and nothing else.
 *
 * ── Order is the specification ──
 *
 * The rules are tested top to bottom and the first match wins, so the order
 * carries more meaning than the keywords do. It was settled by running the
 * list against all 58 live questions, which caught four that went to the
 * wrong drawing:
 *
 *   - "How much does your acne bother you on a scale of 1 to 10, WHERE 1 is
 *     not at all..." matched the body-location rule, because the scale's own
 *     wording contains "where". Severity is tested first now, and the body
 *     rule asks for "where on" rather than a bare "where".
 *   - The "Is there anything else..." question that ends every template
 *     matched family, hair and treatment in three different surveys, because
 *     each one happens to name its own topic. The catch-all is tested first.
 *     It asks for "is there anything else", so "Have you tried anything else
 *     to achieve your body goals?" still reaches the goal drawing.
 *   - "What activities do you spend the most time doing OUTSIDE of work?"
 *     matched the sun. That rule now asks for "in the sun" or "time outside".
 */

export type SurveyIllustrationKey =
  | "severity"
  | "calendar"
  | "bodyMap"
  | "mirror"
  | "frequency"
  | "bottle"
  | "trigger"
  | "target"
  | "family"
  | "sleep"
  | "sun"
  | "stress"
  | "smoking"
  | "work"
  | "pregnancy"
  | "hair"
  | "chat"
  | "checklist"
  | "choice";

export interface IllustrationRule {
  key: SurveyIllustrationKey;
  keywords: readonly string[];
}

/** First match wins. Changing the order changes which drawing a question gets. */
export const ILLUSTRATION_RULES: readonly IllustrationRule[] = [
  // Always first: the free-text question that closes every template names
  // its own topic and would otherwise match that topic's rule.
  { key: "chat", keywords: ["is there anything else", "anything else you", "tell us about"] },
  { key: "pregnancy", keywords: ["pregnan", "breastfeed", "given birth", "nursing"] },
  { key: "smoking", keywords: ["smoke", "smoking", "tobacco", "cigarette"] },
  { key: "sleep", keywords: ["sleep", "bedtime", "insomnia"] },
  { key: "stress", keywords: ["stress", "relaxed", "anxiet", "tension"] },
  { key: "family", keywords: ["close family", "family members", "parents, siblings", "heredit", "runs in"] },
  { key: "work", keywords: ["occupation", "working day", "day-to-day job", "profession"] },
  { key: "trigger", keywords: ["trigger", "flare up", "make it worse", "makes it worse", "aggravat"] },
  { key: "target", keywords: ["hope to achieve", "goal", "successful outcome", "want to achieve"] },
  // Before the body rule: the scale wording contains the word "where".
  { key: "severity", keywords: ["bother", "scale of 1 to 10", "scale from 1 to 10", "how severe", "how bad"] },
  { key: "calendar", keywords: ["when did you first", "how long have you", "first notice", "since when"] },
  { key: "bodyMap", keywords: ["where on", "where do you", "areas of your body", "what areas", "which areas"] },
  { key: "frequency", keywords: ["how often", "flare-ups", "how many hours", "times a week", "times a day"] },
  // Tightened: a bare "outside" also matches "outside of work".
  { key: "sun", keywords: ["in the sun", "time outside", "being in the sun", "sun exposure", "sunscreen"] },
  { key: "mirror", keywords: ["look like", "describe", "changed in size", "appearance"] },
  { key: "bottle", keywords: ["treatment", "tried any", "products", "routine", "medicat", "prescrib"] },
  { key: "hair", keywords: ["hair", "scalp", "dandruff", "bald", "thinning"] },
];

/** Lower case, punctuation flattened, so keywords match on words not symbols. */
export function normalizeQuestionText(text: string | null | undefined): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Keywords are written with real punctuation; flatten them the same way. */
function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** When nothing in the question's wording matches, go by what it asks for. */
function fallbackForType(questionType: string | null | undefined): SurveyIllustrationKey {
  switch (String(questionType ?? "").trim()) {
    case "text":
      return "chat";
    case "multi_choice":
      return "checklist";
    case "scale":
      return "severity";
    case "single_choice":
      return "choice";
    default:
      // An unrecognised type renders as a textarea, so it reads as a written
      // answer.
      return "chat";
  }
}

export function illustrationFor(
  questionText: string | null | undefined,
  questionType: string | null | undefined,
): SurveyIllustrationKey {
  const text = normalizeQuestionText(questionText);
  if (text) {
    for (const rule of ILLUSTRATION_RULES) {
      for (const keyword of rule.keywords) {
        if (text.includes(normalizeKeyword(keyword))) return rule.key;
      }
    }
  }
  return fallbackForType(questionType);
}

/** Every key the component must be able to draw. */
export const SURVEY_ILLUSTRATION_KEYS: readonly SurveyIllustrationKey[] = [
  "severity",
  "calendar",
  "bodyMap",
  "mirror",
  "frequency",
  "bottle",
  "trigger",
  "target",
  "family",
  "sleep",
  "sun",
  "stress",
  "smoking",
  "work",
  "pregnancy",
  "hair",
  "chat",
  "checklist",
  "choice",
];
