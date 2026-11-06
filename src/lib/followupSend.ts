import { isSendableName, rawPatientName, type NamedPatient } from "@/lib/patientName";

/**
 * Whether a post-treatment follow-up can be sent, decided here rather than in
 * the button.
 *
 * The component then renders a decision instead of making one, which is the
 * only way this is testable - the same arrangement reviewRequestState uses in
 * src/lib/googleReview.ts, and for the same reason.
 *
 * The server checks all of this again in send-followup-whatsapp. This exists
 * so a receptionist is told why a button is greyed out, in words they can act
 * on, instead of pressing it and getting a Twilio error code back.
 */

export const FOLLOWUP_KINDS = [
  { kind: "24h", label: "24-hour follow-up", short: "24h follow-up" },
  { kind: "1week", label: "1-week follow-up", short: "1 week follow-up" },
] as const;

export type FollowupKind = (typeof FOLLOWUP_KINDS)[number]["kind"];

export interface FollowupSendState {
  enabled: boolean;
  reason: string;
}

export function followupSendState(
  phone: string | null | undefined,
  patient: NamedPatient | null | undefined,
): FollowupSendState {
  if (!String(phone ?? "").trim()) {
    return { enabled: false, reason: "This patient has no phone number on their record." };
  }
  // 153 patients have a phone number stored where their name should be and 8
  // a name of one character. The template puts that name straight into "Hello {{1}},"
  // and WhatsApp will deliver it, so the refusal has to happen before the send.
  //
  // isSendableName, NOT hasRealName: hasRealName accepts a single letter, which
  // is fine for a list label and wrong for a message. The server enforces the
  // stricter rule, so using the looser one here would enable a button that then
  // fails with a 400.
  if (!isSendableName(rawPatientName(patient))) {
    return {
      enabled: false,
      reason: `This patient is recorded as "${rawPatientName(patient) || "no name"}". Correct the name before sending a follow-up.`,
    };
  }
  return { enabled: true, reason: "" };
}

/**
 * Did this outbound message come from one of the follow-up buttons?
 *
 * Recognised by wording, because Twilio usually returns no body at all for a
 * template send and the sender writes its own fallback text in that case -
 * which makes the fallback the common path, not the rare one. Same approach
 * as isReviewRequestMessage.
 */
export function isFollowupMessage(kind: FollowupKind, content: string | null | undefined): boolean {
  const text = String(content ?? "").toLowerCase();
  if (!text.trim()) return false;
  if (kind === "1week") {
    return text.includes("one week follow up") || text.includes("1-week follow-up");
  }
  return text.includes("follow-up regarding your treatment") || text.includes("24-hour follow-up");
}
