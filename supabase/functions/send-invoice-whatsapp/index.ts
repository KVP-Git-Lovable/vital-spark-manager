const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  return `+${cleaned}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      phone,
      patientName,
      invoiceNumber,
      totalAmount,
      paidAmount,
      balanceAmount,
      status,
    } = await req.json();

    if (!phone || !patientName || !invoiceNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, patientName, invoiceNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");
    const templateSid = Deno.env.get("TWILIO_INVOICE_TEMPLATE_SID");

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const toNumber = normalizePhone(phone);
    if (!toNumber) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromFormatted = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
    const toFormatted = `whatsapp:${toNumber}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    let body: URLSearchParams;

    if (templateSid) {
      // Use approved template (recommended for WhatsApp Business outside session window)
      const contentVariables = JSON.stringify({
        "1": String(patientName),
        "2": String(invoiceNumber),
        "3": String(totalAmount ?? ""),
        "4": String(paidAmount ?? ""),
        "5": String(balanceAmount ?? ""),
        "6": String(status ?? ""),
      });
      body = new URLSearchParams({
        To: toFormatted,
        From: fromFormatted,
        ContentSid: templateSid,
        ContentVariables: contentVariables,
      });
    } else {
      // Fallback: free-form message (works only inside 24h customer-care window)
      const text =
        `Hello ${patientName},\n\n` +
        `Your invoice ${invoiceNumber} has been created.\n` +
        `Total: ${totalAmount}\n` +
        `Paid: ${paidAmount}\n` +
        `Balance: ${balanceAmount}\n` +
        `Status: ${status}\n\n` +
        `Thank you for choosing The Skin Clinic.`;
      body = new URLSearchParams({
        To: toFormatted,
        From: fromFormatted,
        Body: text,
      });
    }

    const twilioRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const result = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message", details: result }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Invoice WhatsApp sent:", { sid: result.sid, to: toFormatted, invoiceNumber });

    return new Response(
      JSON.stringify({ success: true, messageSid: result.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-invoice-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});