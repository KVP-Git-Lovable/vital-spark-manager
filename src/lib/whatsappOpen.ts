import { toast } from "sonner";
import { EMBEDDED_WHATSAPP_DETAIL, EMBEDDED_WHATSAPP_NOTICE, isEmbedded } from "@/lib/embeddedPreview";

/**
 * The one place the app opens WhatsApp for a staff member.
 *
 * Both the Google review request and the two post-treatment follow-ups come
 * through here. They had a copy each, which is how the same three hard-won
 * rules came to be written out twice and would eventually have drifted.
 *
 * ── The three rules, none of them negotiable ──
 *
 *  1. The URL must be web.whatsapp.com, never wa.me. wa.me redirects through
 *     api.whatsapp.com, which refuses to be framed and produced
 *     "api.whatsapp.com is blocked" for the front desk. That decision lives in
 *     whatsappShareUrl; this function only ever opens what it is handed.
 *  2. window.open with NO "noopener" in the features string. The HTML spec
 *     makes window.open return null whenever noopener is set, even when the
 *     tab opened perfectly, so the blocked-popup branch would fire on every
 *     successful click. The opener is disowned by hand instead - same
 *     protection, truthful return value.
 *  3. NEVER a confirm(), alert() or prompt() between the click and
 *     window.open. The new tab takes focus, and Chrome silently ignores a
 *     dialog asked for by a background tab: it returns false and nothing
 *     happens. Anything to ask is asked BEFORE this is called.
 *
 * Returns true only when a tab really opened and WhatsApp can be expected to
 * load in it. Callers record "we put this message in front of somebody" on
 * that answer and on nothing else: a row written for a tab that showed an
 * error page is a lie that later tells the clinic a patient has been contacted.
 */
export function openWhatsApp(url: string, message: string): boolean {
  if (isEmbedded()) {
    // No window.open at all. Opening a tab that is certain to show
    // ERR_BLOCKED_BY_RESPONSE wastes a click and - worse - looks like a send.
    offerCopy(EMBEDDED_WHATSAPP_NOTICE, EMBEDDED_WHATSAPP_DETAIL, message);
    return false;
  }

  const win = window.open(url, "_blank");
  if (!win) {
    offerCopy(
      "Your browser blocked the WhatsApp tab",
      "Copy the message, then paste it into the patient's WhatsApp chat.",
      message,
    );
    return false;
  }
  win.opener = null;
  return true;
}

/** The message, offered for the clipboard, when a tab is not an option. */
function offerCopy(title: string, description: string, message: string): void {
  toast.message(title, {
    description,
    action: {
      label: "Copy message",
      onClick: () => {
        navigator.clipboard.writeText(message).then(
          () => toast.success("Message copied"),
          () => toast.error("Could not copy - your browser blocked the clipboard."),
        );
      },
    },
    duration: 20000,
  });
}
