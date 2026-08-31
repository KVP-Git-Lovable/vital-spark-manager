// Salesforce -> Lovable Cloud import of before/after photos
// (Notes_Pictures__c where Document_Type__c = 'Pictures') for every
// patient with a Salesforce Id. Generalized from the earlier 5-patient
// pilot: paginate through the patient list in safe batches
// (?limit=&offset=), and skip any ContentVersion already imported
// (tracked via the sf_id column on patient_photos) instead of relying on
// a free-text notes tag.
//
// Query params:
//   limit   - patients per call, default 15 (each patient can pull and
//             upload several image files)
//   offset  - pagination cursor when walking the full patient list
//   only    - name substring or patient UUID, for spot-checking one patient
//   reset   - "true" to delete this run's target patients' previously
//             Salesforce-imported photos (sf_id IS NOT NULL only - never
//             touches photos taken directly in the app) before
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

// Cap SF Notes_Pictures records fetched per patient per run.
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
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";
  const only = url.searchParams.get("only") || "";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "15")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || "0"));

  try {
    const { targets, hasMore } = await fetchTargets(only, limit, offset);

    if (reset) {
      for (const p of targets) {
        await admin.from("patient_photos").delete().eq("patient_id", p.lovable_id).not("sf_id", "is", null);
      }
    }

    for (const p of targets) {
      const patientLog: any = { patient: p.name, lovable_id: p.lovable_id, sf_id: p.sf_id, imported: 0, skipped: 0, items: [] };

      const { data: existingRows } = await admin
        .from("patient_photos").select("sf_id").eq("patient_id", p.lovable_id).not("sf_id", "is", null);
      const existing = new Set((existingRows || []).map((r: any) => r.sf_id as string));

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

        await Promise.all(links.map(async (link: any) => {
          const versionId = link.ContentDocument?.LatestPublishedVersionId;
          const ext = (link.ContentDocument?.FileExtension || link.ContentDocument?.FileType || "jpg").toLowerCase();
          if (!versionId) {
            patientLog.items.push({ np_id: np.Id, status: "no-version" });
            return;
          }

          if (existing.has(versionId)) {
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
            const notesText = [`Imported from Salesforce (${np.Name})`, np.Notes_if_any__c || null].filter(Boolean).join("\n");

            const { error: insErr } = await admin.from("patient_photos").insert({
              patient_id: p.lovable_id,
              photo_url: publicUrl,
              photo_type: "before",
              taken_at: np.CreatedDate,
              notes: notesText,
              sf_id: versionId,
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
      JSON.stringify({ ok: true, next_offset: only ? null : offset + limit, has_more: only ? false : hasMore, results, error_count: errors.length, errors }, null, 2),
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
