// One-off Salesforce → Lovable Cloud import for non-Pictures documents
// (Consent, Lab reports, Prescription, Skin Clinic Doctor Notes) for a
// hardcoded list of patients. Downloads each attached ContentVersion
// binary via the Salesforce connector gateway, uploads to the
// `patient-photos` storage bucket, and inserts a `procedure_attachments`
// row mapped to the matching Lovable patient, preserving the original
// Salesforce CreatedDate. Traceable via `sf_np_id=<id>` in file_name.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;

const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const MAPPING: Array<{ lovable_id: string; sf_id: string; name: string }> = [
  { lovable_id: "713adea2-0f76-4417-99a1-6f549c361d4b", sf_id: "a0D9F000000aL1YUAU", name: "Lavita Jacob" },
  { lovable_id: "32378284-1c8a-4af9-8926-62fbd758862c", sf_id: "a0D2w00000DJcL6EAL", name: "Nikitha Hegde" },
  { lovable_id: "8c476060-4e42-44ce-b63f-f00ab5ac7da0", sf_id: "a0D2w0000018jHPEAY", name: "Ridhima Shetty" },
  { lovable_id: "4b5aef92-6207-416a-badc-5af24ea21534", sf_id: "a0D2w0000025aFlEAI", name: "Megha Shetty" },
  { lovable_id: "3f2ae043-6ffa-47f4-b623-38b763b754fc", sf_id: "a0D2w00000265v7EAA", name: "Casilla Peter" },
];

// Map Salesforce Document_Type__c → app-side document_type value used in filters.
const DOC_TYPE_MAP: Record<string, string> = {
  "Consent": "Consent Form",
  "Lab reports": "Lab Report",
  "Prescription": "Prescription",
  "Skin Clinic Doctor Notes": "Previous Doctor Report",
};

// Cap per (patient, document_type). Set high so a single run imports all
// available records for the mapped patients.
const PER_TYPE_LIMIT = 500;

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
    ? (EXT_CONTENT_TYPE[(ext || "").toLowerCase()] || "application/octet-stream")
    : raw;
  return { bytes, contentType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: any[] = [];
  const errors: any[] = [];
  const sfTypes = Object.keys(DOC_TYPE_MAP).map((t) => `'${t}'`).join(",");
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";
  const only = url.searchParams.get("only") || "";
  const targets = only ? MAPPING.filter((m) => m.name.toLowerCase().includes(only.toLowerCase()) || m.lovable_id === only) : MAPPING;

  try {
    if (reset) {
      for (const p of targets) {
        await admin.from("procedure_attachments").delete().eq("patient_id", p.lovable_id).ilike("notes", "%sf_np_id=%");
      }
    }

    for (const p of targets) {
      const patientLog: any = { patient: p.name, imported: 0, skipped: 0, items: [] };

      // 1. Pull latest N of each non-Pictures type. Salesforce SOQL doesn't
      // support per-group LIMIT, so we fetch a larger window and trim below.
      const npQ = await sfQuery(
        `SELECT Id, Name, Document_Type__c, Notes_if_any__c, CreatedDate FROM Notes_Pictures__c WHERE Patient_ID__c = '${p.sf_id}' AND Document_Type__c IN (${sfTypes}) ORDER BY CreatedDate DESC LIMIT 200`,
      );
      const allRecords = (npQ.records || []) as any[];

      // Trim to PER_TYPE_LIMIT per document type
      const byType = new Map<string, any[]>();
      for (const r of allRecords) {
        const arr = byType.get(r.Document_Type__c) || [];
        if (arr.length < PER_TYPE_LIMIT) {
          arr.push(r);
          byType.set(r.Document_Type__c, arr);
        }
      }
      const npRecords = Array.from(byType.values()).flat();

      if (npRecords.length === 0) {
        patientLog.note = "No non-Pictures records";
        results.push(patientLog);
        continue;
      }

      const npIds = npRecords.map((r) => `'${r.Id}'`).join(",");

      // 2. Fetch ContentDocumentLinks
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
          patientLog.items.push({ np_id: np.Id, type: np.Document_Type__c, status: "no-attachment" });
          continue;
        }

        for (const link of links) {
          const versionId = link.ContentDocument?.LatestPublishedVersionId;
          const title = link.ContentDocument?.Title || np.Name || "attachment";
          const ext = (link.ContentDocument?.FileExtension || link.ContentDocument?.FileType || "bin").toLowerCase();
          if (!versionId) {
            patientLog.items.push({ np_id: np.Id, type: np.Document_Type__c, status: "no-version" });
            continue;
          }

          const tag = `sf_np_id=${np.Id} sf_cv_id=${versionId}`;
          const { data: existing } = await admin
            .from("procedure_attachments")
            .select("id")
            .eq("patient_id", p.lovable_id)
            .ilike("notes", `%sf_cv_id=${versionId}%`)
            .maybeSingle();
          if (existing?.id) {
            patientLog.skipped++;
            patientLog.items.push({ np_id: np.Id, cv_id: versionId, type: np.Document_Type__c, status: "already-imported" });
            continue;
          }

          try {
            const { bytes, contentType } = await sfDownload(versionId, ext);
            const path = `${p.lovable_id}/sf-att-${np.Id}-${versionId}.${ext}`;
            const { error: upErr } = await admin.storage
              .from("patient-photos")
              .upload(path, bytes, { contentType, upsert: true });
            if (upErr) throw upErr;

            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/patient-photos/${path}`;
            const appDocType = DOC_TYPE_MAP[np.Document_Type__c] || "Other";
            // Preserve exact Salesforce title. Only append the extension when
            // the title doesn't already carry one.
            const hasExt = /\.[A-Za-z0-9]{2,5}$/.test(title);
            const fileName = hasExt ? title : `${title}.${ext}`;
            const notesText = [np.Notes_if_any__c || null, tag].filter(Boolean).join("\n");

            const { error: insErr } = await admin.from("procedure_attachments").insert({
              patient_id: p.lovable_id,
              file_name: fileName,
              file_url: publicUrl,
              document_type: appDocType,
              notes: notesText,
              created_at: np.CreatedDate,
            } as any);
            if (insErr) throw insErr;

            patientLog.imported++;
            patientLog.items.push({ np_id: np.Id, cv_id: versionId, type: appDocType, status: "imported", url: publicUrl, date: np.CreatedDate, name: fileName });
          } catch (e) {
            const msg = (e as Error).message;
            patientLog.items.push({ np_id: np.Id, type: np.Document_Type__c, status: "error", error: msg });
            errors.push({ patient: p.name, np_id: np.Id, error: msg });
          }
        }
      }

      results.push(patientLog);
    }

    return new Response(
      JSON.stringify({ ok: true, results, error_count: errors.length, errors }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sf-import-attachments failed:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, results, errors }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});