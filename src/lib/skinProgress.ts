/**
 * The Skin Tracker's number, kept.
 *
 * The AI already returns an improvement out of 100. Until now a clinician
 * picked the two photos by hand and the answer lived inside an
 * ai_repository JSON blob, where nothing could list it or report on it.
 *
 * ── Why a pair has to be vouched for ──
 *
 * Picking the photos automatically has nothing to go on. photo_type is
 * 'before' on all 91,522 of them, 94% have no appointment, and a patient
 * averages fifteen photos - a face, a scalp, a back, an arm. "First" and
 * "latest" will often be different parts of a person, and an improvement
 * percentage computed across those is not a weak number, it is a made-up one
 * in a medical record.
 *
 * So the model is asked first whether the two photos show the same area and
 * view, and a pair it will not vouch for is stored as not comparable with no
 * score at all. Everything here exists to keep that promise: a score that
 * arrives without the vouch, or outside 0-100, is dropped rather than shown.
 */

export type SkinMeasure = "overall" | "since_last";

export interface PhotoForPairing {
  id: string;
  photo_url: string;
  /** When the photo was taken; the clinic's own ordering, not created_at. */
  taken_at: string | null;
}

export interface SkinPair {
  measure: SkinMeasure;
  before: PhotoForPairing;
  after: PhotoForPairing;
}

/** Oldest first. A photo with no date sorts last rather than pretending to be first. */
export function orderedPhotos(photos: PhotoForPairing[]): PhotoForPairing[] {
  return [...photos]
    .filter((p) => p?.id && p?.photo_url)
    .sort((a, b) => {
      const at = a.taken_at ? Date.parse(a.taken_at) : Number.POSITIVE_INFINITY;
      const bt = b.taken_at ? Date.parse(b.taken_at) : Number.POSITIVE_INFINITY;
      if (Number.isNaN(at) || Number.isNaN(bt)) return 0;
      return at - bt;
    });
}

/**
 * The two comparisons the clinic asked for.
 *
 * "overall" is the first photo against the latest. "since_last" is the one
 * before the latest against the latest - the change since the previous time.
 * With exactly two photos those are the same comparison, so only the overall
 * one is made: running the AI twice on one pair would be paying twice for an
 * identical answer.
 */
export function skinPairs(photos: PhotoForPairing[]): SkinPair[] {
  const ordered = orderedPhotos(photos);
  if (ordered.length < 2) return [];

  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];

  const pairs: SkinPair[] = [{ measure: "overall", before: first, after: latest }];
  if (previous.id !== first.id) {
    pairs.push({ measure: "since_last", before: previous, after: latest });
  }
  return pairs;
}

export interface SkinVerdict {
  comparable: boolean;
  improvement: number | null;
  reason: string | null;
  metrics: unknown[];
  summary: string | null;
}

const REFUSED = (reason: string): SkinVerdict => ({
  comparable: false, improvement: null, reason, metrics: [], summary: null,
});

/**
 * What the model said, taken only as far as it can be trusted.
 *
 * Three ways a reply is refused, and each has been seen from a vision model:
 * it says the photos are not comparable (what the gate is for); it says they
 * are but gives no usable number; or it gives a number outside the scale it
 * was asked for. The dialog today renders whatever arrives, unclamped - a
 * "160% improvement" would print.
 */
export function readVerdict(raw: unknown): SkinVerdict {
  if (!raw || typeof raw !== "object") return REFUSED("The AI sent nothing readable back.");
  const r = raw as Record<string, unknown>;

  if (r.comparable === false) {
    const why = typeof r.reason === "string" && r.reason.trim()
      ? r.reason.trim()
      : "The two photos do not show the same area.";
    return REFUSED(why);
  }
  if (r.comparable !== true) {
    // No vouch, no score. Silence is not consent here.
    return REFUSED("The AI did not confirm the photos show the same area.");
  }

  // Number(null) and Number("") are 0, which is a real score and a finite
  // one - so a reply that vouched for the pair and gave no figure would be
  // stored as "0% improvement". Rejected before the conversion.
  const raw0 = r.overallImprovement;
  if (raw0 === null || raw0 === undefined || raw0 === "") return REFUSED("The AI gave no improvement figure.");
  const value = Number(raw0);
  if (!Number.isFinite(value)) return REFUSED("The AI gave no improvement figure.");
  if (value < 0 || value > 100) return REFUSED(`The AI gave an improvement of ${value}, which is outside 0-100.`);

  return {
    comparable: true,
    improvement: Math.round(value * 10) / 10,
    reason: null,
    metrics: Array.isArray(r.metrics) ? r.metrics : [],
    summary: typeof r.summary === "string" ? r.summary : null,
  };
}

export interface SkinProgressRow {
  measure: string;
  improvement: number | string | null;
  comparable: boolean;
  not_comparable_reason: string | null;
  computed_at: string | null;
}

/** The line on the patient's record. A missing number reads as missing. */
export function progressLabel(row: SkinProgressRow | null | undefined): string {
  if (!row) return "Not measured yet";
  if (!row.comparable) return row.not_comparable_reason || "Not comparable";
  // Not `Number(row.improvement)` alone: Number(null) and Number("") are both
  // 0, so a row with no figure would have printed "0% improvement" - which is
  // the one thing this whole feature must never say about photos nobody
  // measured.
  if (row.improvement === null || row.improvement === undefined || row.improvement === "") {
    return "Not measured yet";
  }
  const n = Number(row.improvement);
  if (!Number.isFinite(n)) return "Not measured yet";
  return `${n}% improvement`;
}

export const measureLabel = (measure: string): string =>
  measure === "since_last" ? "Since the previous photo" : "First photo to latest";
