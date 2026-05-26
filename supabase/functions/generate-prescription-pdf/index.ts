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
    .select("*, patients(*), staff(*)")
    .eq("id", procedureId)
    .single();
  if (procErr || !proc) throw new Error(procErr?.message || "Procedure not found");

  const [{ data: rxs }, { data: clinic }] = await Promise.all([
    supabase.from("prescriptions").select("*").eq("procedure_id", procedureId),
    supabase.from("clinic_settings").select("*").limit(1).maybeSingle(),
  ]);

  const patient = proc.patients || {};
  const staff = proc.staff || {};

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const mint = rgb(0.78, 0.88, 0.78);
  const teal = rgb(0.18, 0.46, 0.55);
  const dark = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.45, 0.45, 0.45);
  const blueLine = rgb(0.35, 0.55, 0.75);

  // === Header band ===
  const bandH = 130;
  page.drawRectangle({ x: 0, y: height - bandH, width, height: bandH, color: mint });

  const clinicName = clinic?.name || "THE SKIN CLINIC";
  const clinicPhone = clinic?.phone || "+91 6360-75-3030, 9620-12-3030";
  const clinicEmail = clinic?.email || "theskinclinic30@gmail.com";
  const clinicWebsite = clinic?.email ? `www.${String(clinic.email).split("@")[1]}` : "www.theskinclinic.org.in";
  const clinicAddr = [clinic?.address, clinic?.city, clinic?.pincode].filter(Boolean).join(", ") || "VYAS RAO LANE, KADRI KAMBALA ROAD, MANGALORE- 575003";

  page.drawText(sanitize(clinicName.toUpperCase()), { x: 30, y: height - 30, size: 18, font: bold, color: dark });
  page.drawText(sanitize(`PHONE: ${clinicPhone}  |  WEBSITE: ${clinicWebsite}`), { x: 30, y: height - 50, size: 9, font, color: dark });
  page.drawText(sanitize(clinicAddr.toUpperCase()), { x: 30, y: height - 65, size: 9, font: bold, color: dark });

  // Logo (try fetch clinic.logo_url)
  let logoEmbedded = false;
  if (clinic?.logo_url) {
    try {
      const r = await fetch(clinic.logo_url);
      if (r.ok) {
        const ab = new Uint8Array(await r.arrayBuffer());
        const ct = r.headers.get("content-type") || "";
        const img = ct.includes("png") ? await pdfDoc.embedPng(ab) : await pdfDoc.embedJpg(ab);
        const lw = 90, lh = 90;
        page.drawRectangle({ x: width - 30 - lw - 4, y: height - 30 - lh - 4, width: lw + 8, height: lh + 8, color: rgb(1, 1, 1) });
        page.drawImage(img, { x: width - 30 - lw, y: height - 30 - lh, width: lw, height: lh });
        logoEmbedded = true;
      }
    } catch (_) { /* ignore */ }
  }
  if (!logoEmbedded) {
    // Placeholder white box
    page.drawRectangle({ x: width - 130, y: height - 120, width: 100, height: 100, color: rgb(1, 1, 1), borderColor: grey, borderWidth: 0.5 });
    const cn = "The Skin Clinic";
    const cnw = bold.widthOfTextAtSize(cn, 11);
    page.drawText(cn, { x: width - 130 + (100 - cnw) / 2, y: height - 75, size: 11, font: bold, color: teal });
  }

  // Doctor block (below header band)
  const doctorName = `Dr. ${staff.first_name || ""} ${staff.last_name || ""}`.trim();
  const docTitle = staff.qualifications || staff.specialization || "M.B.B.S. MD";
  const docRole = staff.role || "Dermatologist";
  const docPhone = staff.phone || clinicPhone.split(",")[0].replace(/\D/g, "").slice(-10);

  let yTop = height - bandH - 20;
  page.drawText(sanitize(`${doctorName || "Dr. —"}  ${docTitle}`), { x: 30, y: yTop, size: 11, font: bold, color: dark });
  page.drawText(sanitize(docRole), { x: 30, y: yTop - 15, size: 10, font, color: dark });
  page.drawText(sanitize(docPhone), { x: 30, y: yTop - 30, size: 10, font, color: dark });

  // Prescription No / Date (right)
  const prescriptionNo = `D-${shortNumFromUuid(proc.id, 4)}`;
  const apptNo = `A-${shortNumFromUuid(proc.appointment_id || proc.id, 4)}`;
  const dateStr = new Date(proc.procedure_date).toLocaleDateString("en-GB");
  page.drawText(sanitize(`Prescription No: ${prescriptionNo}`), { x: width - 250, y: yTop, size: 11, font, color: dark });
  page.drawText(sanitize(`Date: ${dateStr}`), { x: width - 250, y: yTop - 15, size: 11, font, color: dark });

  // Title
  let y = yTop - 60;
  const title = "Prescription Document";
  const tw = font.widthOfTextAtSize(title, 18);
  page.drawText(title, { x: (width - tw) / 2, y, size: 18, font, color: dark });
  y -= 12;
  page.drawLine({ start: { x: 30, y }, end: { x: width - 30, y }, thickness: 1, color: blueLine });

  // Patient info grid
  y -= 30;
  const colL = 30, colR = width / 2 + 10;
  const patientName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "—";
  const drawKV = (x: number, yy: number, k: string, v: string) => {
    page.drawText(sanitize(k), { x, y: yy, size: 11, font: bold, color: dark });
    const kw = bold.widthOfTextAtSize(sanitize(k), 11);
    page.drawText(sanitize(v), { x: x + kw + 5, y: yy, size: 11, font, color: dark });
  };
  drawKV(colL, y, "Patient Name:", patientName);
  drawKV(colR, y, "Appointment No:", apptNo);
  y -= 18;
  drawKV(colL, y, "Phone No:", patient.phone || "—");
  drawKV(colR, y, "Email Id:", patient.email || "—");
  y -= 18;
  drawKV(colL, y, "Age:", ageFromDob(patient.date_of_birth) || "—");
  drawKV(colR, y, "Sex:", patient.gender || "—");

  // Prescription body
  y -= 40;
  page.drawText("Prescription:", { x: colL, y, size: 12, font: bold, color: teal });
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
    prescriptionText = proc.recommendations || proc.procedure_notes || "—";
  }
  const presLabelW = bold.widthOfTextAtSize("Prescription:", 12);
  const presLines = prescriptionText.split("\n").flatMap(l => wrap(l, font, 11, width - 60 - presLabelW - 10));
  let py = y;
  let firstLineOffset = presLabelW + 10;
  for (let i = 0; i < presLines.length; i++) {
    const xx = i === 0 ? colL + firstLineOffset : colL;
    page.drawText(sanitize(presLines[i]), { x: xx, y: py, size: 11, font, color: dark });
    py -= 16;
  }
  y = py - 10;

  // Symptoms (left) and Diagnosis (right)
  y -= 10;
  page.drawText("Symptoms:", { x: colL, y, size: 12, font: bold, color: teal });
  page.drawText("Diagnosis:", { x: colR, y, size: 12, font: bold, color: teal });
  y -= 18;
  const sympLines = wrap(proc.symptoms || proc.consultation_notes || "—", font, 11, (width / 2) - 50);
  const diagLines = wrap(proc.diagnosis || "—", font, 11, (width / 2) - 50);
  const rows = Math.max(sympLines.length, diagLines.length);
  for (let i = 0; i < rows; i++) {
    if (sympLines[i]) page.drawText(sanitize(sympLines[i]), { x: colL, y, size: 11, font, color: dark });
    if (diagLines[i]) page.drawText(sanitize(diagLines[i]), { x: colR, y, size: 11, font, color: dark });
    y -= 15;
  }

  // Two horizontal rules near bottom (signature area)
  const sigY = 150;
  page.drawLine({ start: { x: 30, y: sigY + 30 }, end: { x: width - 30, y: sigY + 30 }, thickness: 0.6, color: dark });
  page.drawLine({ start: { x: 30, y: sigY }, end: { x: width - 30, y: sigY }, thickness: 0.6, color: dark });

  // Footer
  const footerY = 60;
  const footer1 = `Clinic Phone: ${clinicPhone}`;
  const f1w = font.widthOfTextAtSize(sanitize(footer1), 10);
  page.drawText(sanitize(footer1), { x: (width - f1w) / 2, y: footerY + 14, size: 10, font, color: dark });
  const footer2 = `E-mail: ${clinicEmail}  |  Website: ${clinicWebsite}`;
  const f2w = font.widthOfTextAtSize(sanitize(footer2), 10);
  page.drawText(sanitize(footer2), { x: (width - f2w) / 2, y: footerY, size: 10, font, color: dark });

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