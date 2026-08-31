// One-off utility: match Salesforce Patient__c records to public.patients by
// normalized phone number and (optionally) backfill patients.sf_id.
//
// Query params:
//   apply=true  - perform the UPDATE for unambiguous 1:1 matches only.
//                 Default is a dry run that only reports counts + samples.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const norm = (v: unknown) => {
  const s = String(v ?? "").replace(/[\s\-()]/g, "").trim();
  const digits = s.replace(/^\+?91/, "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

async function sfAll(soql: string) {
  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": SALESFORCE_API_KEY,
  };
  let url = `${GATEWAY}/query?q=${encodeURIComponent(soql)}`;
  const out: any[] = [];
  for (;;) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`SF query failed [${r.status}]: ${await r.text()}`);
    const d = await r.json();
    out.push(...(d.records || []));
    if (d.done) break;
    url = GATEWAY + String(d.nextRecordsUrl).replace("/services/data/v62.0", "");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const apply = new URL(req.url).searchParams.get("apply") === "true";
  try {
    const sf = await sfAll(
      "SELECT Id, Name, Patient_Name__c, Mobile_Number__c FROM Patient__c",
    );

    // Lovable patients
    const patients: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("patients").select("id, first_name, last_name, phone, sf_id")
        .order("created_at", { ascending: true }).range(from, from + 999);
      if (error) throw error;
      patients.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    const byPhoneL = new Map<string, any[]>();
    let lovableNoPhone = 0;
    for (const p of patients) {
      const k = norm(p.phone);
      if (!k) { lovableNoPhone++; continue; }
      (byPhoneL.get(k) || byPhoneL.set(k, []).get(k)!).push(p);
    }
    const byPhoneS = new Map<string, any[]>();
    let sfNoPhone = 0;
    for (const r of sf) {
      const k = norm(r.Mobile_Number__c);
      if (!k) { sfNoPhone++; continue; }
      (byPhoneS.get(k) || byPhoneS.set(k, []).get(k)!).push(r);
    }

    const oneToOne: any[] = [];
    let ambiguousSf = 0, ambiguousLovable = 0, sfUnmatched = 0;
    for (const [k, srecs] of byPhoneS) {
      const lrecs = byPhoneL.get(k);
      if (!lrecs) { sfUnmatched++; continue; }
      if (srecs.length > 1) { ambiguousSf++; continue; }
      if (lrecs.length > 1) { ambiguousLovable++; continue; }
      oneToOne.push({
        phone: k,
        sf_id: srecs[0].Id,
        sf_name: srecs[0].Patient_Name__c || srecs[0].Name,
        lovable_id: lrecs[0].id,
        lovable_name: `${lrecs[0].first_name} ${lrecs[0].last_name ?? ""}`.trim(),
      });
    }
    const matchedLovable = new Set(oneToOne.map((m) => m.lovable_id));
    const lovableUnmatched = patients.filter((p) => norm(p.phone) && !matchedLovable.has(p.id));

    let updated = 0;
    const updateErrors: any[] = [];
    if (apply) {
      for (const m of oneToOne) {
        const { error } = await admin.from("patients")
          .update({ sf_id: m.sf_id }).eq("id", m.lovable_id).is("sf_id", null);
        if (error) updateErrors.push({ lovable_id: m.lovable_id, error: error.message });
        else updated++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      apply,
      salesforce_records: sf.length,
      salesforce_without_phone: sfNoPhone,
      salesforce_distinct_phones: byPhoneS.size,
      lovable_patients: patients.length,
      lovable_without_phone: lovableNoPhone,
      lovable_distinct_phones: byPhoneL.size,
      matched_one_to_one: oneToOne.length,
      ambiguous_salesforce_side: ambiguousSf,
      ambiguous_lovable_side: ambiguousLovable,
      salesforce_unmatched: sfUnmatched,
      lovable_unmatched: lovableUnmatched.length,
      updated,
      update_errors: updateErrors.slice(0, 20),
      sample_matches: oneToOne.slice(0, 10),
      sample_lovable_unmatched: lovableUnmatched.slice(0, 10).map((p: any) => ({
        id: p.id, name: `${p.first_name} ${p.last_name ?? ""}`.trim(), phone: p.phone,
      })),
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
