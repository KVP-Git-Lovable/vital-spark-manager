import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitize(s: any): string {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ");
}

function shortNumFromUuid(uuid: string, digits = 4): string {
  // Deterministic small number from uuid
  const hex = (uuid || "").replace(/-/g, "").slice(0, 8) || "0";
  const n = parseInt(hex, 16) % Math.pow(10, digits);
  return String(n).padStart(digits, "0");
}

function ageFromDob(dob?: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildPrescriptionPdf(supabase: any, procedureId: string): Promise<{ bytes: Uint8Array; filename: string; patient: any }> {
  const { data: proc, error: procErr } = await supabase
    .from("procedures")
    .select("*, patients(*), staff!procedures_staff_id_fkey(*), appointments(*, staff!appointments_staff_id_fkey(*))")
    .eq("id", procedureId)
    .single();
  if (procErr || !proc) throw new Error(procErr?.message || "Procedure not found");

  const [{ data: rxs }, { data: clinic }] = await Promise.all([
    supabase.from("prescriptions").select("*").eq("procedure_id", procedureId),
    supabase.from("clinic_settings").select("*").limit(1).maybeSingle(),
  ]);

  const patient = proc.patients || {};
  const staff = proc.staff || proc.appointments?.staff || {};

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const sage = rgb(0.784, 0.847, 0.784);
  const dark = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.45, 0.45, 0.45);
  const blueHead = rgb(0.114, 0.620, 0.459); // teal #1D9E75
  const blueLine = rgb(0.114, 0.620, 0.459); // teal #1D9E75

  const M = 40; // left/right margin
  const lw = 110, lh = 110;
  const lx = width - M - lw;
  const ly = height - 20 - lh;
  const headerDividerY = ly - 12;

  // Paint the whole page sage first, then overlay only the header in white.
  // This guarantees the body starts exactly at the header divider with no white gaps.
  page.drawRectangle({ x: 0, y: 0, width, height, color: sage });
  page.drawRectangle({ x: 0, y: headerDividerY, width, height: height - headerDividerY, color: rgb(1, 1, 1) });

  const clinicName = clinic?.name || "THE SKIN CLINIC";
  const clinicAddr = clinic?.address || "VYAS RAO LANE, KADRI KAMBALA ROAD, MANGALORE- 575003";
  const footerPhone = "Clinic Phone: +91 6360 75 3030, 9620 12 3030 | Mob: +91 9845 39 3030";
  const footerEmailWeb = "E-mail: theskinclinic30@gmail.com | Website: www.theskinclinic.org.in";

  // === Header (top-left) ===
  page.drawText(sanitize(clinicName.toUpperCase()), { x: M, y: height - 40, size: 16, font: bold, color: dark });
  const addrLines = sanitize(clinicAddr).split(/\\n|,\\s*/).map(s => s.trim()).filter(Boolean);
  const addrLine = addrLines.join(", ");
  page.drawText(addrLine, { x: M, y: height - 58, size: 10, font: bold, color: dark });

  // === Logo (top-right inside white header) ===
  let logoEmbedded = false;
  if (clinic?.logo_url) {
    try {
      const r = await fetch(clinic.logo_url);
      if (r.ok) {
        const ab = new Uint8Array(await r.arrayBuffer());
        const ct = r.headers.get("content-type") || "";
        const img = ct.includes("png") ? await pdfDoc.embedPng(ab) : await pdfDoc.embedJpg(ab);
        const dims = img.scaleToFit(lw, lh);
        page.drawImage(img, { x: lx + (lw - dims.width) / 2, y: ly + (lh - dims.height) / 2, width: dims.width, height: dims.height });
        logoEmbedded = true;
      }
    } catch (_) { /* ignore */ }
  }
  if (!logoEmbedded) {
    const cn = "The Skin Clinic";
    const cnw = bold.widthOfTextAtSize(cn, 13);
    page.drawText(cn, { x: lx + (lw - cnw) / 2, y: ly + lh / 2 - 6, size: 13, font: bold, color: rgb(0.30, 0.50, 0.42) });
  }

  // Header rule under clinic name/address
  const ruleY = height - 78;
  page.drawLine({ start: { x: M, y: ruleY }, end: { x: lx - 10, y: ruleY }, thickness: 0.6, color: dark });

  // === Doctor block (left, under rule) ===
  const nameParts = [staff.first_name, staff.last_name].filter(Boolean).join(" ").trim();
  const doctorName = nameParts ? `Dr. ${nameParts}` : "Dr. —";
  const docQual = staff.specialization || "";
  const docRole = staff.role || "Dermatologist";
  const docPhone = staff.phone || "";

  let docY = ruleY - 16;
  page.drawText(sanitize(`${doctorName}${docQual ? "  " + docQual : ""}`), { x: M, y: docY, size: 11, font: bold, color: dark });
  docY -= 14;
  page.drawText(sanitize(docRole), { x: M, y: docY, size: 10, font, color: dark });
  docY -= 12;
  if (docPhone) page.drawText(sanitize(docPhone), { x: M, y: docY, size: 10, font, color: dark });

  // === Prescription No / Date (right of doctor block, left of logo panel) ===
  const prescriptionNo = `D-${shortNumFromUuid(proc.id, 4)}`;
  const apptNo = `A-${shortNumFromUuid(proc.appointment_id || proc.id, 4)}`;
  const dateStr = new Date(proc.procedure_date).toLocaleDateString("en-GB");
  const metaX = lx - 200;
  page.drawText(sanitize(`Prescription No:   ${prescriptionNo}`), { x: metaX, y: ruleY - 16, size: 11, font, color: dark });
  page.drawText(sanitize(`Date:   ${dateStr}`), { x: metaX, y: ruleY - 30, size: 11, font, color: dark });

  // Bottom divider: sage green body begins immediately below this line.
  page.drawLine({ start: { x: 0, y: headerDividerY }, end: { x: width, y: headerDividerY }, thickness: 0.8, color: blueLine });

  // === Title ===
  let y = headerDividerY - 28; // below white header band, on sage background
  const title = "Prescription Document";
  const tw = font.widthOfTextAtSize(title, 20);
  page.drawText(title, { x: (width - tw) / 2, y, size: 20, font, color: dark });
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: blueLine });

  // === Patient info grid (2 columns x 3 rows) ===
  y -= 32;
  const colL = M;
  const colR = width / 2 + 10;
  const labelW = 110;
  const patientName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "—";
  const drawKV = (x: number, yy: number, k: string, v: string) => {
    page.drawText(sanitize(k), { x, y: yy, size: 11, font, color: dark });
    page.drawText(sanitize(v), { x: x + labelW, y: yy, size: 11, font, color: dark });
  };
  drawKV(colL, y, "Patient name:", patientName);
  drawKV(colR, y, "Appointment No:", apptNo);
  y -= 20;
  drawKV(colL, y, "Phone No:", patient.phone || "");
  drawKV(colR, y, "Email id:", patient.email || "");
  y -= 20;
  drawKV(colL, y, "Age:", ageFromDob(patient.date_of_birth) || "");
  drawKV(colR, y, "Sex:", patient.gender || "");

  // === Body - Full width sections ===
  y -= 40;
  const bodyTop = y;
  const colWidth = width - (2 * M);

  // Build prescription text
  let prescriptionText = "";
  if (rxs && rxs.length > 0) {
    prescriptionText = rxs.map((r: any, i: number) => {
      const parts = [r.medicine_name];
      if (r.dosage) parts.push(r.dosage);
      if (r.frequency) parts.push(r.frequency);
      if (r.duration) parts.push(`for ${r.duration}`);
      let line = `${i + 1}. ${parts.filter(Boolean).join(" — ")}`;
      if (r.instructions) line += `. ${r.instructions}`;
      return line;
    }).join("\n");
  } else {
    prescriptionText = "—";
  }

  const drawSection = (startY: number, heading: string, body: string): number => {
    let yy = startY;
    page.drawText(heading, { x: M, y: yy, size: 12, font: bold, color: blueHead });
    yy -= 16;
    const lines = body.split("\n").flatMap(l => wrap(l || " ", font, 10, colWidth - 20));
    for (const ln of lines) {
      page.drawText(sanitize(ln), { x: M + 10, y: yy, size: 10, font, color: dark });
      yy -= 13;
    }
    return yy - 8;
  };

  // Full-width sections
  let cy = bodyTop;

  if (prescriptionText !== "—") {
    cy = drawSection(cy, "Prescription", prescriptionText);
  }

  cy = drawSection(cy, "Symptoms", proc.symptoms || proc.consultation_notes || "—");
  cy = drawSection(cy, "Diagnosis", proc.diagnosis || "—");
  cy = drawSection(cy, "Procedure Details", proc.procedure_notes || "—");

  if (proc.recommendations) {
    cy = drawSection(cy, "Recommendations", proc.recommendations);
  }

  // === Footer divider ===
  const footerDividerY = 90;
  page.drawLine({ start: { x: M, y: footerDividerY }, end: { x: width - M, y: footerDividerY }, thickness: 0.5, color: grey });

  // === Footer ===
  const footerY = 65;
  const footerWidth = width - (2 * M);
  const footerLabelW = 140;

  const drawFooterKV = (x: number, yy: number, k: string, v: string) => {
    page.drawText(sanitize(k), { x, y: yy, size: 9, font: bold, color: dark });
    page.drawText(sanitize(v), { x: x + footerLabelW, y: yy, size: 9, font, color: dark });
  };

  drawFooterKV(M, footerY + 12, "Clinic Phone:", footerPhone.replace("Clinic Phone: ", ""));
  drawFooterKV(M, footerY - 2, "E-mail:", footerEmailWeb.replace("E-mail: ", ""));

  const bytes = await pdfDoc.save();
  const safeName = (patientName || "patient").replace(/[^A-Za-z0-9_-]+/g, "_");
  const filename = `Prescription-${safeName}-${prescriptionNo}.pdf`;
  return { bytes, filename, patient };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { procedureId, mode } = await req.json();
    if (!procedureId) throw new Error("procedureId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { bytes, filename, patient } = await buildPrescriptionPdf(supabase, procedureId);

    if (mode === "upload") {
      const path = `prescriptions/${procedureId}/${filename}`;
      const { error: upErr } = await supabase.storage
        .from("procedure-attachments")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("procedure-attachments").getPublicUrl(path);
      // Audit row
      await supabase.from("procedure_attachments").insert({
        procedure_id: procedureId,
        patient_id: patient?.id || null,
        file_url: pub.publicUrl,
        file_name: filename,
        notes: "Auto-generated prescription PDF",
      });
      return new Response(JSON.stringify({ ok: true, url: pub.publicUrl, filename, phone: patient?.phone || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: return base64 for direct download
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    return new Response(JSON.stringify({ ok: true, base64, filename }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-prescription-pdf error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});