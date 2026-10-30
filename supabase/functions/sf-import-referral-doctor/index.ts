// Fetches the referring doctor Salesforce still holds, for the patients whose
// name never came across.
//
// The migration brought the referral FLAG and not the NAME: 152 patients read
// "Reference - other Dr" and not one says who sent them. They are worth about
// Rs 12.9 lakh of billing between them, and the clinic wants to thank those
// doctors at Diwali.
//
// WHICH FIELD holds the name is not guessed here. sf-describe-patient-fields
// reports what Salesforce actually has, a human picks from it, and that choice
// arrives as `field`. Guessing at a clinical field name is how the wrong column
// ends up in a patient record.
//
// Only the patients who need it are asked about. The sf_ids come from this
// database - doctor-referral patients with nothing recorded - so one SOQL query
// covers all 152 rather than scanning 27,000.
//
//   field - Salesforce API name holding the referring doctor (required)
//   apply - true to write; anything else only reports
//
// Both may arrive in the JSON body or on the query string. The app invokes
// edge functions with a body, so that is what the Admin screen sends; the
// query string is there so this can also be run by hand with curl.
//
// FILL-ONLY. The write goes through sf_set_referring_doctor_bulk, which refuses
// a patient whose source is not a doctor referral, refuses one that already has
// a name, and records every change in patient_referral_doctor_corrections.
// Re-running it costs nothing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { describeSfFailure } from "./sfError.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";

/** Salesforce API names are letters, digits and underscores - nothing that
 *  could add a clause of its own to the SELECT below. */
const SAFE_FIELD = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Salesforce writes a dash or a dot where nobody filled anything in. Storing
 *  one would turn "not recorded" into "recorded as nothing". */
const PLACEHOLDERS = new Set(["", "-", "--", ".", "n/a", "na", "nil", "none", "null", "0"]);
function usableName(value: unknown): string {
  const text = String(value ?? "").trim();
  if (PLACEHOLDERS.has(text.toLowerCase())) return "";
  if (!/[A-Za-z]/.test(text)) return "";
  return text;
}

async function sfQuery(soql: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${GATEWAY}/query?q=${encodeURIComponent(soql)}`, {
    signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SALESFORCE_API_KEY,
    },
  });
  if (!res.ok) throw new Error(describeSfFailure(res.status, await res.text()));
  const payload = await res.json();
  return payload.records || [];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") body = (await req.json()) ?? {};
  } catch {
    // A call with no body at all is fine - the query string may carry both.
    body = {};
  }
  const field = String(body.field ?? url.searchParams.get("field") ?? "").trim();
  // Writing is opt-in: a call that forgets to say so only reports.
  const apply = body.apply === true || url.searchParams.get("apply") === "true";

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!SAFE_FIELD.test(field)) {
    return reply({
      ok: false,
      error: field
        ? `Not a Salesforce field name: ${field}`
        : "Pass ?field= the Salesforce API name holding the referring doctor. Run sf-describe-patient-fields to see what is there.",
    }, 400);
  }

  try {
    // Who still needs one. Mirrors referralKind(): mentions a referral, does
    // not mention a patient - so "Reference - other Dr" is in and
    // "Reference - other patients" is out.
    const { data: waiting, error: readErr } = await admin
      .from("patients")
      .select("sf_id")
      .not("sf_id", "is", null)
      .ilike("source", "%refer%")
      .not("source", "ilike", "%patient%")
      .or("source_referral_doctor.is.null,source_referral_doctor.eq.")
      .limit(5000);
    if (readErr) throw readErr;

    const ids = (waiting ?? []).map((r) => String(r.sf_id)).filter(Boolean);
    if (ids.length === 0) {
      return reply({ ok: true, field, waiting: 0, found: 0, filled: 0, note: "Every doctor referral already has a name." });
    }

    let found = 0, placeholders = 0, filled = 0;
    const sample: { sf_id: string; name: string }[] = [];

    for (const batch of chunk(ids, 200)) {
      const quoted = batch.map((id) => `'${id.replace(/'/g, "")}'`).join(",");
      const rows = await sfQuery(
        `SELECT Id, ${field} FROM Patient__c WHERE Id IN (${quoted})`,
        AbortSignal.timeout(30_000),
      );

      const payload: { sf_id: string; referring_doctor: string }[] = [];
      for (const r of rows) {
        const sf_id = String(r.Id || "");
        if (!sf_id) continue;
        const raw = (r as Record<string, unknown>)[field];
        const name = usableName(raw);
        if (!name) {
          if (String(raw ?? "").trim()) placeholders++;
          continue;
        }
        found++;
        if (sample.length < 15) sample.push({ sf_id, name });
        payload.push({ sf_id, referring_doctor: name });
      }

      if (apply && payload.length) {
        const { data, error } = await admin.rpc("sf_set_referring_doctor_bulk", { payload });
        if (error) throw error;
        filled += Number(data ?? 0);
      }
    }

    return reply({
      ok: true,
      field,
      applied: apply,
      waiting: ids.length,
      found,
      placeholdersIgnored: placeholders,
      filled,
      sample,
      note: apply
        ? "Filled only where nothing was recorded. Every change is in patient_referral_doctor_corrections."
        : "Nothing was written. Re-run with &apply=true to fill these in.",
    });
  } catch (e) {
    return reply({ ok: false, field, error: (e as Error).message }, 500);
  }
});
