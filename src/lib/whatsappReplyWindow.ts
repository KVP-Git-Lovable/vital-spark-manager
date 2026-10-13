/**
 * When a typed reply may be sent, and what to say when it may not.
 *
 * WhatsApp's own rule, not the clinic's: a message written freely can only be
 * sent within 24 hours of the patient's last message. After that only an
 * approved template is allowed, and Twilio refuses the send with error 63016.
 *
 * So the box says so rather than letting the front desk type a reply into a
 * refusal. The clock runs from the patient's last message in - a reply the
 * clinic sends does not reopen it.
 */

export const REPLY_WINDOW_HOURS = 24;

export interface ReplyWindow {
  /** Whether a freely typed reply can be sent right now. */
  open: boolean;
  /** What the box says when it cannot. Empty while the window is open. */
  note: string;
}

const SHUT =
  "The patient last wrote more than 24 hours ago, so WhatsApp will not deliver a typed reply until they message again.";

const NEVER_WROTE =
  "This number has never written in, so WhatsApp will not deliver a typed reply to it.";

/**
 * Is the 24-hour window open, counted from the patient's last message in?
 *
 * No inbound message at all is not the same as an old one, and the two read
 * differently to whoever is looking at the thread.
 */
export function replyWindow(
  lastInboundAt: string | number | Date | null | undefined,
  now: Date = new Date(),
): ReplyWindow {
  if (lastInboundAt === null || lastInboundAt === undefined || lastInboundAt === "") {
    return { open: false, note: NEVER_WROTE };
  }
  const when = lastInboundAt instanceof Date ? lastInboundAt : new Date(lastInboundAt);
  const at = when.getTime();
  if (Number.isNaN(at)) return { open: false, note: NEVER_WROTE };

  const elapsed = now.getTime() - at;
  // Exactly 24 hours is outside: WhatsApp counts the window as under 24 hours.
  return elapsed < REPLY_WINDOW_HOURS * 60 * 60 * 1000
    ? { open: true, note: "" }
    : { open: false, note: SHUT };
}
