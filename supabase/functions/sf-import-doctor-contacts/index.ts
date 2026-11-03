// Fetches the referring doctors' contact details Salesforce holds.
//
// The clinic asked for the doctors' phone numbers: "in salesforce it has all
// the doctors contact number and all, we need that here too". This database
// has an external_doctors table with phone, email and clinic_name columns -
// and seven rows, none of which carries any of them.
//
// WHICH OBJECT holds the doctors, and which fields hold their details, is not
// guessed here. sf-describe-patient-fields lists the objects and their
// fields; a human picks; the choice arrives as `object` and the field names.
// Guessing at a Salesforce schema is how somebody's mobile number ends up in
// a column labelled clinic.
//
//   object      - Salesforce object API name holding the doctors (required)
//   nameField   - field holding the doctor's name (required)
//   phoneField  - field holding the phone (optional)
//   emailField  - field holding the email (optional)
//   clinicField - field holding the clinic or hospital (optional)
//   apply       - true to write; anything else only reports
//
// FILL-ONLY, in both directions. A doctor already in external_doctors keeps
// the name as the clinic spells it, and only gains a phone, email or clinic
// where that column is currently EMPTY - so anything a receptionist typed by
// hand outranks anything Salesforce sends. A doctor who is not there yet is
// added. Nothing is ever deleted or overwritten, so re-running costs nothing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { describeSfFailure } from "./sfError.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";

/** Salesforce API names are letters, digits and underscores - nothing that
 *  could add a clause of its own to the SELECT below. */
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Salesforce writes a dash or a dot where nobody filled anything in. */
const PLACEHOLDERS = new Set(["", "-", "--", ".", "n/a", "na", "nil", "none", "null", "0"]);

function usable(value: unknown): string {
  const text = String(value ?? "").trim();
  return PLACEHOLDERS.has(text.toLowerCase()) ? "" : text;
}

function usableName(value: unknown): string {
  const text = usable(value);
  return /[A-Za-z]/.test(text) ? text : "";
}

/**
 * An Indian mobile or landline, or nothing.
 *
 * Salesforce free-text phone fields in this org hold everything from
 * "9845012345" to "+91 98450 12345 / 0824-2222222". The digits are what
 * matters; anything that cannot be a real number is dropped rather than
 * stored, because a phone column nobody can dial is worse than an empty one.
 */
function usablePhone(value: unknown): string {
  const text = usable(value);
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) return "";
  // Keep the last 10 for a plain Indian number, otherwise hand back what was
  // written - a number with an extension or a second line is still useful to
  // a human, and mangling it would lose information.
  return digits.length === 10 || digits.length === 12 ? digits.slice(-10) : text;
}

/**
 * Mirrors doctorNameKey in src/lib/referralDoctorName.ts - Deno cannot import
 * from the browser bundle. Keep the two in step: this is what decides whether
 * a doctor Salesforce sends is the one already in external_doctors.
 */
const TITLE_WORDS = "dr|doctor|prof|professor|mr|mrs|ms|miss";
const TITLES = new RegExp(`^(?:${TITLE_WORDS})\\s*\\.\\s*|^(?:${TITLE_WORDS})\\s+`, "i");
function doctorNameKey(name: unknown): string {
  const text = String(name ?? "").trim();
  if (!text) return "";
  return text.replace(TITLES, "").toLowerCase().replace(/[^a-z0-9]/g, "");
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const pick = (k: string) => String(body[k] ?? url.searchParams.get(k) ?? "").trim();
  const object = pick("object");
  const nameField = pick("nameField");
  const phoneField = pick("phoneField");
  const emailField = pick("emailField");
  const clinicField = pick("clinicField");
  const apply = body.apply === true || url.searchParams.get("apply") === "true";

  const reply = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const named = { object, nameField, phoneField, emailField, clinicField };
  for (const [label, value] of Object.entries(named)) {
    if (!value) continue;
    if (!SAFE_NAME.test(value)) return reply({ ok: false, error: `Not a Salesforce name: ${label}=${value}` }, 400);
  }
  if (!object || !nameField) {
    return reply({
      ok: false,
      error: "Pass object= and nameField=. Run sf-describe-patient-fields with no object to list what Salesforce has.",
    }, 400);
  }

  try {
    const wanted = ["Id", nameField, phoneField, emailField, clinicField].filter(Boolean);
    const select = Array.from(new Set(wanted)).join(", ");
    const rows = await sfQuery(`SELECT ${select} FROM ${object} LIMIT 5000`, AbortSignal.timeout(45_000));

    // What Salesforce actually has, keyed the way this app matches doctors.
    const incoming = new Map<string, { name: string; phone: string; email: string; clinic: string }>();
    let unnamed = 0;
    for (const r of rows) {
      const name = usableName((r as Record<string, unknown>)[nameField]);
      if (!name) { unnamed++; continue; }
      const key = doctorNameKey(name);
      if (!key) { unnamed++; continue; }
      const next = {
        name,
        phone: phoneField ? usablePhone((r as Record<string, unknown>)[phoneField]) : "",
        email: emailField ? usable((r as Record<string, unknown>)[emailField]) : "",
        clinic: clinicField ? usable((r as Record<string, unknown>)[clinicField]) : "",
      };
      const seen = incoming.get(key);
      // Two Salesforce rows for one doctor: keep whichever carries a phone.
      if (!seen || (!seen.phone && next.phone)) incoming.set(key, next);
    }

    const { data: existingRows, error: readErr } = await admin
      .from("external_doctors")
      .select("id, name, phone, email, clinic_name");
    if (readErr) throw readErr;

    const existing = new Map<string, Record<string, unknown>>();
    for (const d of existingRows ?? []) {
      const key = doctorNameKey(d.name);
      if (key && !existing.has(key)) existing.set(key, d);
    }

    const toInsert: { name: string; phone: string | null; email: string | null; clinic_name: string | null }[] = [];
    const toFill: { id: string; patch: Record<string, string>; name: string }[] = [];

    for (const [key, inc] of incoming) {
      const have = existing.get(key);
      if (!have) {
        toInsert.push({
          name: inc.name,
          phone: inc.phone || null,
          email: inc.email || null,
          clinic_name: inc.clinic || null,
        });
        continue;
      }
      // Fill-only: a value typed by somebody here is never overwritten.
      const patch: Record<string, string> = {};
      if (inc.phone && !String(have.phone ?? "").trim()) patch.phone = inc.phone;
      if (inc.email && !String(have.email ?? "").trim()) patch.email = inc.email;
      if (inc.clinic && !String(have.clinic_name ?? "").trim()) patch.clinic_name = inc.clinic;
      if (Object.keys(patch).length) toFill.push({ id: String(have.id), patch, name: String(have.name) });
    }

    let inserted = 0;
    let filled = 0;
    if (apply) {
      for (let i = 0; i < toInsert.length; i += 200) {
        const batch = toInsert.slice(i, i + 200);
        const { error } = await admin.from("external_doctors").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }
      for (const f of toFill) {
        const { error } = await admin.from("external_doctors").update(f.patch).eq("id", f.id);
        if (error) throw error;
        filled++;
      }
    }

    return reply({
      ok: true,
      object,
      fields: { nameField, phoneField, emailField, clinicField },
      applied: apply,
      salesforceRows: rows.length,
      withoutAName: unnamed,
      distinctDoctors: incoming.size,
      wouldInsert: toInsert.length,
      wouldFill: toFill.length,
      inserted,
      filled,
      sampleNew: toInsert.slice(0, 15),
      sampleFilled: toFill.slice(0, 15).map((f) => ({ name: f.name, ...f.patch })),
      note: apply
        ? "Added the doctors that were missing and filled only the blank contact fields. Nothing was overwritten."
        : "Nothing was written. Re-run with apply=true.",
    });
  } catch (e) {
    return reply({ ok: false, object, error: (e as Error).message }, 500);
  }
});
