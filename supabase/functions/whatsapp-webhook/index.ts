// Twilio WhatsApp incoming-message webhook
// Twilio sends application/x-www-form-urlencoded payloads.
// Phone bound to this webhook: +917411675656 (Account SID: AC2bed17b2742df7031ebc7de2d726b62f)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let payload: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      form.forEach((v, k) => {
        payload[k] = String(v);
      });
    } else if (contentType.includes("application/json")) {
      payload = await req.json();
    }

    console.log("[whatsapp-webhook] Incoming message:", JSON.stringify(payload));

    const from = payload.From || "";
    const to = payload.To || "";
    const body = payload.Body || "";
    const messageSid = payload.MessageSid || payload.SmsMessageSid || "";

    console.log(
      `[whatsapp-webhook] SID=${messageSid} From=${from} To=${to} Body="${body}"`,
    );

    // Respond with empty TwiML — acknowledges receipt without auto-reply.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return new Response(twiml, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("[whatsapp-webhook] Error:", error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return new Response(twiml, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});