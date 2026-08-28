// Portal authentication: check phone, set PIN, verify PIN
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cleanPhone(p: string): string {
  return (p || "").replace(/\D/g, "").slice(-10);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  return res;
}

async function findPatientByPhone(phone: string) {
  const cleaned = cleanPhone(phone);
  if (cleaned.length < 10) return null;

  try {
    // Fetch patients with a large limit to handle all records
    const res = await sb(
      `patients?select=id,first_name,last_name,phone,portal_pin_hash,portal_pin_failed_attempts,portal_pin_locked_until&order=created_at.desc&limit=5000`,
    );

    if (!res.ok) {
      console.error(`Query failed: ${res.status}`);
      return null;
    }

    const rows = await res.json();
    console.log(`Found ${rows.length} total patients, searching for phone ${cleaned}`);

    // Find patient with matching cleaned phone (handle various formats)
    const found = rows.find((r: any) => {
      const storedCleaned = cleanPhone(r.phone || "");
      const match = storedCleaned === cleaned;
      if (match) {
        console.log(`✓ Found match: ${r.first_name} ${r.last_name} (${r.phone} -> ${storedCleaned})`);
      }
      return match;
    });

    if (!found) {
      console.log(`No patient found matching phone ${cleaned}`);
      // Log first few patients for debugging
      console.log("First 3 patients in DB:", rows.slice(0, 3).map((r: any) => ({
        name: `${r.first_name} ${r.last_name}`,
        phone: r.phone,
        cleaned: cleanPhone(r.phone || "")
      })));
    }

    return found || null;
  } catch (err: any) {
    console.error("findPatientByPhone error:", err);
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, phone, pin } = await req.json();
    if (!action || !phone) return json({ error: "Missing action or phone" }, 400);

    const patient = await findPatientByPhone(phone);
    if (!patient) {
      return json({ status: "not_registered" }, 200);
    }

    if (action === "check") {
      return json({
        status: patient.portal_pin_hash ? "pin_required" : "set_pin",
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
      });
    }

    if (action === "set_pin") {
      if (!pin || !/^\d{4}$/.test(pin)) return json({ error: "PIN must be 4 digits" }, 400);
      if (patient.portal_pin_hash) return json({ error: "PIN already set. Use Forgot PIN to reset." }, 400);
      const hash = await sha256(`${patient.id}:${pin}`);
      const upd = await sb(`patients?id=eq.${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          portal_pin_hash: hash,
          portal_pin_failed_attempts: 0,
          portal_pin_locked_until: null,
        }),
      });
      if (!upd.ok) return json({ error: "Failed to save PIN" }, 500);
      return json({
        status: "ok",
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
      });
    }

    if (action === "verify") {
      if (!pin || !/^\d{4}$/.test(pin)) return json({ error: "PIN must be 4 digits" }, 400);
      if (!patient.portal_pin_hash) return json({ status: "set_pin", patientId: patient.id }, 200);

      // Locked?
      if (patient.portal_pin_locked_until && new Date(patient.portal_pin_locked_until) > new Date()) {
        return json({
          status: "locked",
          lockedUntil: patient.portal_pin_locked_until,
        }, 200);
      }

      const hash = await sha256(`${patient.id}:${pin}`);
      if (hash === patient.portal_pin_hash) {
        await sb(`patients?id=eq.${patient.id}`, {
          method: "PATCH",
          body: JSON.stringify({ portal_pin_failed_attempts: 0, portal_pin_locked_until: null }),
        });
        return json({
          status: "ok",
          patientId: patient.id,
          patientName: `${patient.first_name} ${patient.last_name}`,
        });
      }

      const attempts = (patient.portal_pin_failed_attempts || 0) + 1;
      const lockNow = attempts >= 3;
      const lockedUntil = lockNow ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await sb(`patients?id=eq.${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          portal_pin_failed_attempts: lockNow ? 0 : attempts,
          portal_pin_locked_until: lockedUntil,
        }),
      });
      return json({
        status: lockNow ? "locked" : "wrong_pin",
        lockedUntil,
        attemptsLeft: lockNow ? 0 : 3 - attempts,
      }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("portal-auth error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});