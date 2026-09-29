// Pulls appointment-confirmation WhatsApp messages from Twilio's send history
// and records each one (with its latest delivery status) in
// whatsapp_delivery_log, matched to the patient by phone number.
// Safe to re-run: rows are upserted by Twilio message SID.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ days: z.number().int().min(1).max(90).optional() }).optional();

const CONFIRMATION_MARK = "You have an appointment";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);

    let raw: unknown = undefined;
    try { raw = await req.json(); } catch { /* empty body ok */ }
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const days = parsed.data?.days ?? 3;

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!sid || !tok) return json({ error: "WhatsApp service not configured" }, 500);
    const auth = "Basic " + btoa(`${sid}:${tok}`);

    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    let next: string | null =
      `/2010-04-01/Accounts/${sid}/Messages.json?PageSize=500&DateSent%3E=${since}`;
    const started = Date.now();
    const rows: any[] = [];
    while (next && Date.now() - started < 45000) {
      const res = await fetch(`https://api.twilio.com${next}`, { headers: { Authorization: auth } });
      const text = await res.text();
      if (!res.ok) {
        console.error(`Twilio list failed [${res.status}]: ${text}`);
        return json({ error: "Could not read WhatsApp history", status: res.status, details: text }, res.status >= 500 ? 502 : res.status);
      }
      const page = JSON.parse(text);
      for (const m of page.messages || []) {
        if (m.direction === "inbound") continue;
        if (!String(m.body || "").includes(CONFIRMATION_MARK)) continue;
        rows.push({
          message_sid: m.sid,
          phone: String(m.to || "").replace(/^whatsapp:/, ""),
          kind: "confirmation",
          body_preview: String(m.body || "").slice(0, 200),
          status: m.status,
          error_code: m.error_code ? Number(m.error_code) : null,
          error_message: m.error_message || null,
          sent_at: new Date(m.date_sent || m.date_created).toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      next = page.next_page_uri || null;
    }

    // Match phones to patients by last 10 digits.
    const last10s = [...new Set(rows.map((r) => r.phone.replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10))];
    const byPhone = new Map<string, string>();
    for (let i = 0; i < last10s.length; i += 10) {
      await Promise.all(last10s.slice(i, i + 10).map(async (p) => {
        const { data } = await admin.from("patients").select("id").ilike("phone", `%${p}`).limit(1);
        if (data?.[0]) byPhone.set(p, data[0].id);
      }));
    }
    for (const r of rows) r.patient_id = byPhone.get(r.phone.replace(/\D/g, "").slice(-10)) ?? null;

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("whatsapp_delivery_log").upsert(rows.slice(i, i + 500), { onConflict: "message_sid" });
      if (error) { console.error("upsert failed", error); return json({ error: error.message }, 500); }
    }
    return json({ synced: rows.length, matched: rows.filter((r) => r.patient_id).length, complete: !next });
  } catch (e) {
    console.error("whatsapp-delivery-sync error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
