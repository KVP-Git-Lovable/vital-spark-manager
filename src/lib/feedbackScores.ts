/**
 * How the clinic reads a piece of patient feedback.
 *
 * Feedback is two numbers - an NPS score out of 10 and a service rating out of
 * 5 - and the wording around them was written inline in the appointment sheet's
 * Feedback tab. The report needs exactly the same wording, so it lives here
 * rather than being copied: a second set of cut-offs would have the same visit
 * reading "Passive" on one screen and "Promoter" on another.
 */

export type NpsCategory = "Promoter" | "Passive" | "Detractor";

/** The standard bands: 0-6 detractor, 7-8 passive, 9-10 promoter. */
export const npsCategory = (score: number | null | undefined): NpsCategory | "" => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return "";
  const n = Number(score);
  if (n <= 6) return "Detractor";
  if (n <= 8) return "Passive";
  return "Promoter";
};

/** The word under the stars. */
export const ratingLabel = (rating: number | null | undefined): string => {
  if (rating === null || rating === undefined || Number.isNaN(Number(rating))) return "";
  const n = Number(rating);
  if (n <= 2) return "Poor";
  if (n === 3) return "Average";
  if (n === 4) return "Good";
  return "Excellent";
};

/**
 * Does this feedback need somebody to find out what went wrong?
 *
 * The threshold that opens a root-cause case. It lives here, beside the bands
 * it is built from, for the same reason npsCategory does: a second copy would
 * let the same visit be "needs review" on one screen and fine on another.
 *
 * supabase/migrations/20261106090000_a_low_score_that_someone_owns.sql carries
 * the identical rule as feedback_needs_root_cause(), because the case is
 * opened by a database trigger rather than by a screen - a patient editing
 * their own score down from the portal has to open one too, and no client code
 * runs on that path. feedbackRca.test.ts reads that SQL and fails if the two
 * ever disagree.
 *
 * Both scores, not just NPS: the live data contradicts itself. One patient
 * gave NPS 8 with a service rating of 1, another NPS 1 with a rating of 5.
 * Either rule on its own misses one of them.
 *
 * Note `rating <= 3` is deliberately wider than this file's own "Poor", which
 * stops at 2. A 3 out of 5 is not a happy patient, and the clinic set the line
 * here knowing it means about four cases a week rather than three.
 */
export const needsRootCause = (
  row: { nps_score?: number | null; service_rating?: number | null } | null | undefined,
): boolean => {
  if (!row) return false;
  const nps = row.nps_score ?? 10;
  const rating = row.service_rating ?? 5;
  return Number(nps) <= 6 || Number(rating) <= 3;
};

export interface NpsBreakdown {
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** The Net Promoter Score itself: % promoters minus % detractors, -100..100. */
  nps: number | null;
  /** Mean of the raw 0-10 scores, which is not the same thing as the NPS. */
  averageScore: number | null;
  averageRating: number | null;
}

export const npsBreakdown = (
  rows: { nps_score?: number | null; service_rating?: number | null }[],
): NpsBreakdown => {
  const scored = rows.filter((r) => r?.nps_score !== null && r?.nps_score !== undefined);
  const rated = rows.filter((r) => r?.service_rating !== null && r?.service_rating !== undefined);

  const promoters = scored.filter((r) => npsCategory(r.nps_score) === "Promoter").length;
  const passives = scored.filter((r) => npsCategory(r.nps_score) === "Passive").length;
  const detractors = scored.filter((r) => npsCategory(r.nps_score) === "Detractor").length;

  const mean = (values: number[]) =>
    values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;

  return {
    responses: rows.length,
    promoters,
    passives,
    detractors,
    // Net Promoter Score, not the average of the scores - they are different
    // numbers and the industry one is the difference of the two proportions.
    nps: scored.length ? Math.round(((promoters - detractors) / scored.length) * 100) : null,
    averageScore: mean(scored.map((r) => Number(r.nps_score))),
    averageRating: mean(rated.map((r) => Number(r.service_rating))),
  };
};
