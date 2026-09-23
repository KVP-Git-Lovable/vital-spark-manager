// READ-ONLY. Lists what a Salesforce object actually holds, and how much of
// it is filled in.
//
// Why: every Salesforce query this app makes for a patient asks for
// `Id, Patient_Name__c, Mobile_Number__c` and nothing else. Date of birth,
// gender, email and address have never been imported at all - which is why a
// prescription prints "Age: -" and "Sex: -", and why date of birth is filled for
// only 29% of patients, all of it from the April spreadsheet or typed in here.
//
// Before importing those fields, we need their real API names. Guessing at
// clinical field names is how the wrong column ends up in a patient record, so
// this reports what is there and leaves the mapping to a human.
//
// Writes nothing. Touches no table. Reads at most `sample` rows.
//   object - Salesforce object API name to describe (default Patient__c)
//   sample - how many rows to measure fill rates over (default 200)

import { describeSfFailure } from "./sfError.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";

async function sf(path: string): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SALESFORCE_API_KEY,
    },
  });
  if (!res.ok) throw new Error(describeSfFailure(res.status, await res.text()));
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sample = Math.max(1, Math.min(2000, Number(new URL(req.url).searchParams.get("sample") || "200")));

  try {
    // FIELDS(ALL) returns every readable field without naming them up front.
    const q = `SELECT FIELDS(ALL) FROM Patient__c LIMIT ${sample}`;
    const payload = await sf(`/query?q=${encodeURIComponent(q)}`);
    const records: any[] = payload.records || [];
    if (!records.length) {
      return new Response(JSON.stringify({ ok: true, rows: 0, fields: [] }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fill rate per field, so the reply says which of these are worth importing
    // rather than just which exist. No field VALUES are returned - this is a
    // shape report, and patient demographics should not travel further than they
    // must.
    const names = Object.keys(records[0]).filter((k) => k !== "attributes");
    const fields = names
      .map((name) => {
        const filled = records.filter((r) => {
          const v = r[name];
          return v !== null && v !== undefined && String(v).trim() !== "";
        }).length;
        return { name, filled, of: records.length, pct: Math.round((filled / records.length) * 1000) / 10 };
      })
      .sort((a, b) => b.pct - a.pct);

    // Fields whose name suggests the demographics the app is missing, surfaced
    // separately so they are easy to spot in a long list. Still only a hint -
    // the mapping is a decision, not a guess.
    const wanted = /birth|dob|age|gender|sex|email|address|city|blood|pincode|zip/i;
    const likelyMissingDemographics = fields.filter((f) => wanted.test(f.name));

    return new Response(
      JSON.stringify({ ok: true, rows: records.length, likelyMissingDemographics, fields }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
