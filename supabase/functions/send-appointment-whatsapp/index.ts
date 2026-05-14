import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_SID = "HX1750d865022c866cf68dc134cd93c6eb";

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  // Indian numbers: 10 digits => prefix +91
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  return `+${cleaned}`;
}

function titleFromGender(gender?: string | null): string {
  if (!gender) return "";
  const g = gender.toLowerCase();
  if (g.startsWith("m")) return "Mr.";
  if (g.startsWith("f")) return "Ms.";
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, patientName, appointmentDate, appointmentTime, serviceName, patientGender } = await req.json();

    if (!phone || !patientName || !appointmentDate || !appointmentTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, patientName, appointmentDate, appointmentTime" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

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

    // Fetch clinic phone + city for template variables 4 & 5
    let clinicPhone = "";
    let clinicCity = "";
    try {
      const supaUrl = Deno.env.get("SUPABASE_URL")!;
      const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supa = createClient(supaUrl, supaKey);
      const { data: clinic } = await supa
        .from("clinic_settings")
        .select("phone, city")
        .limit(1)
        .maybeSingle();
      clinicPhone = clinic?.phone || "";
      clinicCity = clinic?.city || "";
    } catch (e) {
      console.error("clinic_settings fetch failed", e);
    }

    const title = titleFromGender(patientGender);
    const namedPatient = title ? `${title} ${patientName}`.trim() : patientName;

    const contentVariables = JSON.stringify({
      "1": namedPatient,
      "2": appointmentTime,
      "3": serviceName || "Consultation",
      "4": clinicPhone || "-",
      "5": clinicCity || "-",
    });

    const body = new URLSearchParams({
      To: toFormatted,
      From: fromFormatted,
      ContentSid: TEMPLATE_SID,
      ContentVariables: contentVariables,
    });

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

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

    console.log("WhatsApp sent:", { sid: result.sid, to: toFormatted, patientName });

    return new Response(
      JSON.stringify({ success: true, messageSid: result.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-appointment-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});