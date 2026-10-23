/** Approved review template has no substitution variables. */
export function reviewTemplateParams(phoneE164: string, from: string, contentSid: string): URLSearchParams {
  return new URLSearchParams({
    To: `whatsapp:${phoneE164}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    ContentSid: contentSid,
  });
}