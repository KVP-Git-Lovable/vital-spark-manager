import { normalizePhone } from "@/lib/audienceImport";

/**
 * Asking a patient for a Google review.
 *
 * The Feedback tab shows what somebody thought of their visit and then stops.
 * When the comment reads "Dr. Ashwini explained me the procedures and i was
 * happy", that is the moment to ask for a public review, and there was nothing
 * on the screen to do it with.
 *
 * The wording below is the clinic's own, kept exactly as they wrote it - the
 * link, the address and the number included. It is also the body of the
 * `google_review_request` template in Communications Centre, so the two say
 * the same thing: today staff send it from their own WhatsApp, and once Meta
 * approves the template the app will send it itself. If one is ever edited,
 * the other has to be edited with it.
 *
 * No name placeholder, deliberately. The clinic wrote it without one, and a
 * body with no variables is also the easiest kind for Meta to approve.
 *
 * This text is now the APPROVED template, character for character - Twilio
 * content SID HXf1521e98ec4adb966dd73ac571050e29, approved 23 Oct 2026. Meta
 * approves a body, not a template name, so editing a word here without
 * resubmitting the template means the app sends one thing and WhatsApp
 * delivers another. The test below holds it in place.
 */
export const GOOGLE_REVIEW_MESSAGE = `It has been a great pleasure serving you. Your feedback really matter to us. Please leave us a review and share your experience about the treatment and clinic with us. 
Click on the link: https://g.co/kgs/6Zy6nc

The Skin Clinic
Vyasa Rao Road, Kadri Kambla Rd, Mangalore, Karnataka 575002
063607 53030`;

/** Where the review actually goes, pulled out so a test can hold it still. */
export const GOOGLE_REVIEW_LINK = "https://g.co/kgs/6Zy6nc";

/**
 * A WhatsApp link that opens a chat with this patient, message already typed.
 *
 * null when the number cannot be made into a real one, so the caller can
 * disable the button and say why rather than opening WhatsApp on nothing.
 *
 * normalizePhone rather than another phone parser: it already strips
 * punctuation, drops leading zeros and puts the country code on a bare
 * ten-digit Indian mobile, which is how the clinic's numbers are stored.
 */
export function whatsappShareUrl(
  phone: string | null | undefined,
  message: string = GOOGLE_REVIEW_MESSAGE,
): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  // encodeURIComponent, not encodeURI: the message holds newlines, a colon and
  // a slash-heavy URL, and only the former escapes all of them.
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * What the Feedback tab's review button should do, decided here rather than in
 * the component.
 *
 * The component then renders a decision instead of making one, which is the
 * only way this is testable - the appointment sheet it lives in would need the
 * whole of Supabase, React Query and the router mocked to assert one button.
 */
export interface ReviewRequestState {
  enabled: boolean;
  /** Where the button goes. null when there is nowhere to send it. */
  url: string | null;
  /** Shown under a disabled button, so it is clear why. Empty when enabled. */
  reason: string;
}

export function reviewRequestState(phone: string | null | undefined): ReviewRequestState {
  const url = whatsappShareUrl(phone);
  if (!url) {
    return {
      enabled: false,
      url: null,
      reason: "This patient has no usable phone number on their record.",
    };
  }
  return { enabled: true, url, reason: "" };
}

/**
 * What the sender records when Twilio returns no body for a template send.
 *
 * send-google-review-whatsapp writes result.body into whatsapp_conversations,
 * and for a template message Twilio often returns none - so this fallback is
 * the common case, not the rare one. Recognising a previous send has to match
 * both it and the real body.
 */
export const REVIEW_SENT_FALLBACK_TEXT = "Google review request";

/**
 * Is this recorded outbound message one of these review requests?
 *
 * Used to notice that a patient has already had one. A patient received the
 * same message twice a minute apart because nothing in the app knew the first
 * had gone: Meta's marketing cap is intermittent, so when nothing arrives the
 * natural thing is to press again, and when the cap lifts every queued copy
 * lands at once.
 */
export function isReviewRequestMessage(content: string | null | undefined): boolean {
  const text = String(content ?? "");
  if (!text.trim()) return false;
  return text.includes(GOOGLE_REVIEW_LINK) || text.includes(REVIEW_SENT_FALLBACK_TEXT);
}

/**
 * When the last one went, in words - so a second send is a decision rather
 * than a reflex. Empty when none has been sent.
 */
export function reviewAlreadySentNotice(
  lastSentAt: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!lastSentAt) return "";
  const when = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt);
  if (Number.isNaN(when.getTime())) return "";

  const time = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay =
    when.getFullYear() === now.getFullYear() &&
    when.getMonth() === now.getMonth() &&
    when.getDate() === now.getDate();
  if (sameDay) return `Already sent today at ${time}`;

  const date = when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `Already sent on ${date} at ${time}`;
}
