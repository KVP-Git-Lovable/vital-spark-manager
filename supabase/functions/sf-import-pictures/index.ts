// One-off Salesforce → Lovable Cloud import for a hardcoded list of
// patients. Pulls up to N `Pictures` records from Salesforce
// `Notes_Pictures__c`, downloads each attached ContentVersion binary via
// the Salesforce connector gateway, uploads to the `patient-photos`
// storage bucket, and inserts a `patient_photos` row mapped to the
// matching Lovable patient. Traceable via `sf_np_id=<id>` in notes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;

const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Lovable patient UUID -> Salesforce Patient__c Id
const MAPPING: Array<{ lovable_id: string; sf_id: string; name: string }> = [
  { lovable_id: "713adea2-0f76-4417-99a1-6f549c361d4b", sf_id: "a0D9F000000aL1YUAU", name: "Lavita Jacob" },
  { lovable_id: "32378284-1c8a-4af9-8926-62fbd758862c", sf_id: "a0D2w00000DJcL6EAL", name: "Nikitha Hegde" },
  { lovable_id: "8c476060-4e42-44ce-b63f-f00ab5ac7da0", sf_id: "a0D2w0000018jHPEAY", name: "Ridhima Shetty" },
  { lovable_id: "4b5aef92-6207-416a-badc-5af24ea21534", sf_id: "a0D2w0000025aFlEAI", name: "Megha Shetty" },
  { lovable_id: "3f2ae043-6ffa-47f4-b623-38b763b754fc", sf_id: "a0D2w00000265v7EAA", name: "Casilla Peter" },
];

// Cap SF Notes_Pictures records fetched per patient. Set very high so we
// import every Picture record available for the mapped patients.
const PICTURES_PER_PATIENT = 500;

const EXT_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif", bmp: "image/bmp",
  pdf: "application/pdf",
};

async function sfQuery(soql: string): Promise<any> {
  const r = await fetch(`${GATEWAY}/query?q=${encodeURIComponent(soql)}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SALESFORCE_API_KEY,
    },
  });
  if (!r.ok) throw new Error(`SF query failed [${r.status}]: ${await r.text()}`);
  return r.json();
}

async function sfDownload(versionId: string, ext?: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const r = await fetch(`${GATEWAY}/sobjects/ContentVersion/${versionId}/VersionData`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SALESFORCE_API_KEY,
    },
  });
  if (!r.ok) throw new Error(`SF download failed [${r.status}]: ${await r.text()}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const raw = r.headers.get("content-type") || "";
  const contentType = (!raw || raw.includes("octet-stream"))
    ? (EXT_CONTENT_TYPE[(ext || "").toLowerCase()] || "image/jpeg")
    : raw;
  return { bytes, contentType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: any[] = [];
  const errors: any[] = [];
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";
  const only = url.searchParams.get("only") || "";
  const targets = only ? MAPPING.filter((m) => m.name.toLowerCase().includes(only.toLowerCase()) || m.lovable_id === only) : MAPPING;

  try {
    if (reset) {
      for (const p of targets) {
        await admin.from("patient_photos").delete().eq("patient_id", p.lovable_id).ilike("notes", "%sf_np_id=%");
      }
    }

    for (const p of targets) {
      const patientLog: any = { patient: p.name, lovable_id: p.lovable_id, sf_id: p.sf_id, imported: 0, skipped: 0, items: [] };

      // 1. Fetch the top N Pictures records for this patient
      const npQ = await sfQuery(
        `SELECT Id, Name, Notes_if_any__c, CreatedDate FROM Notes_Pictures__c WHERE Patient_ID__c = '${p.sf_id}' AND Document_Type__c = 'Pictures' ORDER BY CreatedDate DESC LIMIT ${PICTURES_PER_PATIENT}`,
      );
      const npRecords = (npQ.records || []) as any[];
      if (npRecords.length === 0) {
        patientLog.note = "No Pictures records in Salesforce";
        results.push(patientLog);
        continue;
      }

      const npIds = npRecords.map((r) => `'${r.Id}'`).join(",");

      // 2. Fetch ContentDocumentLinks for those Notes_Pictures records
      const cdlQ = await sfQuery(
        `SELECT LinkedEntityId, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.FileType, ContentDocument.LatestPublishedVersionId FROM ContentDocumentLink WHERE LinkedEntityId IN (${npIds})`,
      );
      const cdlByNp = new Map<string, any[]>();
      for (const link of cdlQ.records || []) {
        const arr = cdlByNp.get(link.LinkedEntityId) || [];
        arr.push(link);
        cdlByNp.set(link.LinkedEntityId, arr);
      }

      for (const np of npRecords) {
        const links = cdlByNp.get(np.Id) || [];
        if (links.length === 0) {
          patientLog.items.push({ np_id: np.Id, status: "no-attachment" });
          continue;
        }

        // Import every attachment linked to this Notes_Pictures record (parallel).
        await Promise.all(links.map(async (link: any) => {
          const versionId = link.ContentDocument?.LatestPublishedVersionId;
          const ext = (link.ContentDocument?.FileExtension || link.ContentDocument?.FileType || "jpg").toLowerCase();
          if (!versionId) {
            patientLog.items.push({ np_id: np.Id, status: "no-version" });
            return;
          }

          // Idempotency: skip if we already imported this ContentVersion for this patient.
          const tag = `sf_np_id=${np.Id} sf_cv_id=${versionId}`;
          const { data: existing } = await admin
            .from("patient_photos")
            .select("id")
            .eq("patient_id", p.lovable_id)
            .ilike("notes", `%sf_cv_id=${versionId}%`)
            .maybeSingle();
          if (existing?.id) {
            patientLog.skipped++;
            patientLog.items.push({ np_id: np.Id, cv_id: versionId, status: "already-imported" });
            return;
          }

          try {
            const { bytes, contentType } = await sfDownload(versionId, ext);
            const path = `${p.lovable_id}/sf-${np.Id}-${versionId}.${ext}`;
            const { error: upErr } = await admin.storage
              .from("patient-photos")
              .upload(path, bytes, { contentType, upsert: true });
            if (upErr) throw upErr;

            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/patient-photos/${path}`;
            const notesText = [
              `Imported from Salesforce (${np.Name})`,
              np.Notes_if_any__c || null,
              tag,
            ].filter(Boolean).join("\n");

            const { error: insErr } = await admin.from("patient_photos").insert({
              patient_id: p.lovable_id,
              photo_url: publicUrl,
              photo_type: "before",
              taken_at: np.CreatedDate,
              notes: notesText,
            });
            if (insErr) throw insErr;

            patientLog.imported++;
            patientLog.items.push({ np_id: np.Id, cv_id: versionId, status: "imported", url: publicUrl });
          } catch (e) {
            const msg = (e as Error).message;
            patientLog.items.push({ np_id: np.Id, cv_id: versionId, status: "error", error: msg });
            errors.push({ patient: p.name, np_id: np.Id, error: msg });
          }
        }));
      }

      results.push(patientLog);
    }

    return new Response(
      JSON.stringify({ ok: true, results, error_count: errors.length, errors }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sf-import-pictures failed:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, results, errors }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});