// Salesforce -> Lovable Cloud import of non-Pictures documents (Consent,
// Lab reports, Prescription, Skin Clinic Doctor Notes) for every patient
// with a Salesforce Id. Generalized from the earlier 5-patient pilot:
// paginate through the patient list in safe batches (?limit=&offset=),
// and skip any ContentVersion already imported (tracked via the sf_id
// column on procedure_attachments) instead of relying on a free-text
// notes tag.
//
// Query params:
//   limit   - patients per call, default 15
//   offset  - pagination cursor when walking the full patient list
//   only    - name substring or patient UUID, for spot-checking one patient
//   reset   - "true" to delete this run's target patients' previously
//             Salesforce-imported attachments (sf_id IS NOT NULL only -
//             never touches files uploaded directly in the app) before
//             re-importing. Off by default.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;

const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

interface Target { lovable_id: string; sf_id: string; name: string }

const DOC_TYPE_MAP: Record<string, string> = {
  "Consent": "Consent Form",
  "Lab reports": "Lab Report",
  "Prescription": "Prescription",
  "Skin Clinic Doctor Notes": "Previous Doctor Report",
};

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

async function fetchTargets(only: string, limit: number, offset: number): Promise<{ targets: Target[]; hasMore: boolean }> {
  if (only) {
    const { data, error } = await admin
      .from("patients").select("id, sf_id, first_name, last_name").not("sf_id", "is", null);
    if (error) throw error;
    const targets = (data || [])
      .filter((p) => p.id === only || `${p.first_name} ${p.last_name}`.toLowerCase().includes(only.toLowerCase()))
      .map((p) => ({ lovable_id: p.id, sf_id: p.sf_id as string, name: `${p.first_name} ${p.last_name}`.trim() }));
    return { targets, hasMore: false };
  }
  const { data, error } = await admin
    .from("patients").select("id, sf_id, first_name, last_name").not("sf_id", "is", null)
    .order("created_at", { ascending: true }).range(offset, offset + limit);
  if (error) throw error;
  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    targets: page.map((p) => ({ lovable_id: p.id, sf_id: p.sf_id as string, name: `${p.first_name} ${p.last_name}`.trim() })),
    hasMore,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: any[] = [];
  const errors: any[] = [];
  const sfTypes = Object.keys(DOC_TYPE_MAP).map((t) => `'${t}'`).join(",");
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";
  const only = url.searchParams.get("only") || "";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "15")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || "0"));

  try {
    const { targets, hasMore } = await fetchTargets(only, limit, offset);

    if (reset) {
      for (const p of targets) {
        await admin.from("procedure_attachments").delete().eq("patient_id", p.lovable_id).not("sf_id", "is", null);
      }
    }

    for (const p of targets) {
      const patientLog: any = { patient: p.name, imported: 0, skipped: 0, items: [] };

      const { data: existingRows } = await admin
        .from("procedure_attachments").select("sf_id").eq("patient_id", p.lovable_id).not("sf_id", "is", null);
      const existing = new Set((existingRows || []).map((r: any) => r.sf_id as string));

      const npQ = await sfQuery(
        `SELECT Id, Name, Document_Type__c, Notes_if_any__c, CreatedDate FROM Notes_Pictures__c WHERE Patient_ID__c = '${p.sf_id}' AND Document_Type__c IN (${sfTypes}) ORDER BY CreatedDate DESC LIMIT 200`,
      );
      const allRecords = (npQ.records || []) as any[];

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

          if (existing.has(versionId)) {
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
            const baseName = (np.Name && String(np.Name).trim()) || title;
            const hasExt = /\.[A-Za-z0-9]{2,5}$/.test(baseName);
            const fileName = hasExt ? baseName : `${baseName}.${ext}`;

            const { error: insErr } = await admin.from("procedure_attachments").insert({
              patient_id: p.lovable_id,
              file_name: fileName,
              file_url: publicUrl,
              document_type: appDocType,
              notes: np.Notes_if_any__c || null,
              sf_id: versionId,
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
      JSON.stringify({ ok: true, next_offset: only ? null : offset + limit, has_more: only ? false : hasMore, results, error_count: errors.length, errors }, null, 2),
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
