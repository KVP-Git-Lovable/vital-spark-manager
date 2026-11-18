import type { RcaStatus } from "@/lib/feedbackRca";

/**
 * Whether a piece of feedback still needs somebody to say what happens next.
 *
 * A low score already opens a case by itself - the trigger in
 * 20261106090000 does it the moment the feedback is written, and today that
 * is 29 of 1,224 rows. What the clinic had no way to record was the decision
 * that follows: is this one worth investigating, or not?
 *
 * ── Why the case, and not the score ──
 *
 * "Below the configured limit" is a rule that lives in three places now -
 * feedback_settings, the per-question thresholds, and the trigger that reads
 * both. Re-deriving it here would make a fourth, and a fourth that can
 * disagree with the database. A case EXISTS exactly when the database decided
 * the score was low enough, so the case is the signal.
 */

export interface FeedbackCaseRow {
  rca_case_id?: string | null;
  rca_status?: string | null;
}

/**
 * `none` - the score was fine, there is nothing to decide.
 * `undecided` - a case is open and nobody has said whether to work it.
 * `decided` - somebody has: it is being worked, resolved, or waved off.
 */
export type CaseDecision = "none" | "undecided" | "decided";

/** Ticking says the case is worth working. The clinic's existing vocabulary. */
export const RCA_REQUIRED_STATUS: RcaStatus = "in_progress";
/** Crossing says it is not. Equally existing - "No action needed". */
export const RCA_NOT_REQUIRED_STATUS: RcaStatus = "no_action";

/**
 * The report table hands every row to this, and those rows are whatever each
 * report's fetcher built. Narrowed rather than asserted, so a report with no
 * case fields simply comes back as "nothing to decide".
 */
function asCaseRow(row: unknown): FeedbackCaseRow {
  if (!row || typeof row !== "object") return {};
  const r = row as Record<string, unknown>;
  return {
    rca_case_id: typeof r.rca_case_id === "string" ? r.rca_case_id : null,
    rca_status: typeof r.rca_status === "string" ? r.rca_status : null,
  };
}

export function caseDecision(row: FeedbackCaseRow | null | undefined): CaseDecision {
  if (!row?.rca_case_id) return "none";
  return row.rca_status === "open" ? "undecided" : "decided";
}

/** The rows a person should look at today. */
export const needsDecision = (row: FeedbackCaseRow | null | undefined): boolean =>
  caseDecision(row) === "undecided";

/**
 * The red line down a row that is still waiting on somebody.
 *
 * Only while it waits. A row that has been ticked or crossed goes back to
 * looking like every other row and shows its status instead, so red keeps
 * meaning "this needs you" rather than "this visit went badly once".
 *
 * Returns "" rather than undefined so a caller can concatenate it safely.
 */
export const decisionRowClass = (row: unknown): string =>
  needsDecision(asCaseRow(row))
    ? "bg-destructive/10 hover:bg-destructive/15 border-l-4 border-l-destructive"
    : "";

/** What the RCA column reads when there is nothing to choose. */
export function decisionSummary(
  row: FeedbackCaseRow | null | undefined,
  statusLabel: (value: string | null | undefined) => string,
): string {
  const state = caseDecision(row);
  if (state === "none") return "";
  if (state === "undecided") return "Needs a decision";
  return statusLabel(row?.rca_status) || "";
}
