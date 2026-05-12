import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtINR(n: number) {
  return `INR ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: any) {
  const v = Number(n || 0);
  return v.toFixed(2);
}

// Indian numbering number-to-words (integer rupees + paise)
function numberToIndianWords(num: number): string {
  if (!isFinite(num)) return "";
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  const words = inWords(rupees);
  let res = `${words} Rupees`;
  if (paise > 0) res += ` and ${inWords(paise)} Paise`;
  return `${res} Only`;
}
function inWords(n: number): string {
  if (n === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string => x < 20 ? a[x] : `${b[Math.floor(x/10)]}${x%10 ? " " + a[x%10] : ""}`;
  const three = (x: number): string => {
    const h = Math.floor(x/100), r = x%100;
    return `${h ? a[h] + " Hundred" + (r ? " " : "") : ""}${r ? two(r) : ""}`;
  };
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thou = Math.floor(n / 1000); n %= 1000;
  const hund = n;
  if (crore) parts.push(two(crore) + " Crore");
  if (lakh) parts.push(two(lakh) + " Lakh");
  if (thou) parts.push(two(thou) + " Thousand");
  if (hund) parts.push(three(hund));
  return parts.join(" ").trim();
}

function ageFromDob(dob?: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function shortPatientId(id?: string | null): string {
  if (!id) return "";
  const hex = id.replace(/-/g, "");
  return `P-${hex.slice(-5).toUpperCase()}`;
}

function fmtDateIST(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // dd/mm/yyyy in Asia/Kolkata
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" });
  return f.format(d);
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, color: any, lineHeight: number): number {
  const words = String(text).split(/\s+/);
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      page.drawText(line, { x, y: cy, size, font, color });
      cy -= lineHeight;
      line = w;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cy, size, font, color });
    cy -= lineHeight;
  }
  return cy;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inv, error: invErr } = await supabase
      .from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Invoice not found", details: invErr }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: clinic }, { data: patient }] = await Promise.all([
      supabase.from("clinic_settings").select("*").limit(1).maybeSingle(),
      inv.patient_id
        ? supabase.from("patients").select("*").eq("id", inv.patient_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    let doctorName = "";
    if (inv.appointment_id) {
      const { data: appt } = await supabase
        .from("appointments").select("staff_id").eq("id", inv.appointment_id).maybeSingle();
      if (appt?.staff_id) {
        const { data: st } = await supabase
          .from("staff").select("first_name, last_name, specialization").eq("id", appt.staff_id).maybeSingle();
        if (st) {
          const nm = `${st.first_name || ""} ${st.last_name || ""}`.trim();
          const spec = st.specialization ? ` ${st.specialization}` : "";
          doctorName = nm ? `Dr. ${nm}${spec}` : "";
        }
      }
    }

    // Parse line items: "Name" or "Name xN"
    const rawServices: string[] = Array.isArray(inv.services) ? inv.services : [];
    const parsed = rawServices.map((s) => {
      const str = String(s).trim();
      const m = str.match(/^(.*?)\s+x(\d+(?:\.\d+)?)$/i);
      if (m) return { raw: str, name: m[1].trim(), qty: Number(m[2]) || 1 };
      return { raw: str, name: str, qty: 1 };
    });

    const names = Array.from(new Set(parsed.map((p) => p.name)));
    const svcMap = new Map<string, { price: number; hsn: string; gst: number }>();
    const prodMap = new Map<string, { price: number; hsn: string; gst: number }>();
    if (names.length > 0) {
      const [{ data: svcRows }, { data: prodRows }] = await Promise.all([
        supabase.from("services").select("name, price, hsn_code, gst_percent").in("name", names),
        supabase.from("pharma_products").select("name, selling_price, hsn_code, gst_percent").in("name", names),
      ]);
      (svcRows || []).forEach((r: any) => svcMap.set(r.name, {
        price: Number(r.price) || 0, hsn: r.hsn_code || "9993", gst: Number(r.gst_percent) || 0,
      }));
      (prodRows || []).forEach((r: any) => prodMap.set(r.name, {
        price: Number(r.selling_price) || 0, hsn: r.hsn_code || "", gst: Number(r.gst_percent) || 0,
      }));
    }

    const sameState = (clinic?.state || "").trim().toLowerCase() === (patient?.state || "").trim().toLowerCase() && (clinic?.state || "");
    const lineItems = parsed.map((p) => {
      const svc = svcMap.get(p.name);
      const prod = prodMap.get(p.name);
      const ref = svc || prod || { price: 0, hsn: "", gst: 0 };
      const charges = ref.price;
      const gross = charges * p.qty;
      const gstRate = ref.gst || 0;
      const taxAmount = gross * gstRate / (100 + gstRate); // assume price inclusive (matches existing behavior)
      const sgst = sameState ? gstRate / 2 : 0;
      const cgst = sameState ? gstRate / 2 : 0;
      const igst = sameState ? 0 : gstRate;
      return {
        name: p.name, qty: p.qty, charges, hsn: ref.hsn || "",
        sgst, cgst, igst, taxAmount, amount: gross,
      };
    });

    // ---- PDF ----
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 portrait
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const dark = rgb(0.05, 0.05, 0.05);
    const grey = rgb(0.45, 0.45, 0.45);
    const line = rgb(0, 0, 0);

    let y = height - 40;

    // Logo
    try {
      const logoUrl = clinic?.logo_url;
      if (logoUrl) {
        const res = await fetch(logoUrl);
        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          let img;
          if (ct.includes("png") || logoUrl.toLowerCase().endsWith(".png")) {
            img = await pdfDoc.embedPng(buf);
          } else {
            img = await pdfDoc.embedJpg(buf);
          }
          const targetH = 70;
          const scale = targetH / img.height;
          const w = img.width * scale;
          page.drawImage(img, { x: 40, y: y - targetH, width: w, height: targetH });
        }
      }
    } catch (e) {
      console.warn("logo embed failed", e);
    }
    // Always draw clinic name as fallback below logo region
    y -= 90;

    // Header info — two columns
    const leftX = 40;
    const rightX = 320;
    const labelSize = 10;
    const lineH = 14;

    const patientFullName = `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim() || inv.patient_name || "Walk-in Patient";
    const age = ageFromDob(patient?.date_of_birth);
    const sex = patient?.gender || "";
    const phone = patient?.phone || "";
    const dateStr = fmtDateIST(inv.created_at);
    const patientShort = shortPatientId(patient?.id || inv.patient_id);
    const billingId = inv.invoice_number || "";
    const gstNo = clinic?.gst_number || "";

    const drawRow = (label: string, value: string, lx: number, ly: number) => {
      page.drawText(`${label}: `, { x: lx, y: ly, size: labelSize, font, color: dark });
      const lw = font.widthOfTextAtSize(`${label}: `, labelSize);
      page.drawText(String(value || ""), { x: lx + lw, y: ly, size: labelSize, font, color: dark });
    };

    drawRow("Patient Name", patientFullName, leftX, y);
    drawRow("Patient ID", patientShort, rightX, y);
    y -= lineH;
    drawRow("Age/Sex", `${age}/${sex}`, leftX, y);
    drawRow("Billing ID", billingId, rightX, y);
    y -= lineH;
    drawRow("Mobile Number", phone, leftX, y);
    drawRow("Dr/Ref.By", doctorName, rightX, y);
    y -= lineH;
    drawRow("Date", dateStr, leftX, y);
    drawRow("GST No", gstNo, rightX, y);
    y -= lineH * 2;

    page.drawText("Billing Line Items:", { x: leftX, y, size: 10, font, color: dark });
    y -= 14;

    // Table
    const tableX = 40;
    const tableW = width - 80; // 515
    // Column widths summing to 515
    const cols = [
      { key: "sl", title: "Sl.No", w: 32 },
      { key: "name", title: "Particulars", w: 120 },
      { key: "charges", title: "Charges (Rs)", w: 75 },
      { key: "hsn", title: "HSN", w: 38 },
      { key: "sgst", title: "SGST %", w: 38 },
      { key: "cgst", title: "CGST %", w: 38 },
      { key: "gst", title: "GST %", w: 35 },
      { key: "qty", title: "Qty", w: 28 },
      { key: "tax", title: "Tax (Rs)", w: 50 },
      { key: "amt", title: "Amount (Rs)", w: 61 },
    ];
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    if (totalW !== tableW) {
      // Adjust last column to fit exactly
      cols[cols.length - 1].w += (tableW - totalW);
    }

    const headerH = 26;
    const rowH = 22;

    // Draw header row
    const drawCellBox = (x: number, yy: number, w: number, h: number) => {
      page.drawRectangle({ x, y: yy - h, width: w, height: h, borderColor: line, borderWidth: 0.7 });
    };
    let cx = tableX;
    for (const c of cols) {
      drawCellBox(cx, y, c.w, headerH);
      // header text - centered, may wrap on 2 lines
      const tw = bold.widthOfTextAtSize(c.title, 8);
      if (tw > c.w - 4) {
        // split
        const parts = c.title.split(" ");
        let l1 = parts.slice(0, Math.ceil(parts.length / 2)).join(" ");
        let l2 = parts.slice(Math.ceil(parts.length / 2)).join(" ");
        const w1 = bold.widthOfTextAtSize(l1, 8);
        const w2 = bold.widthOfTextAtSize(l2, 8);
        page.drawText(l1, { x: cx + (c.w - w1) / 2, y: y - 10, size: 8, font: bold, color: dark });
        page.drawText(l2, { x: cx + (c.w - w2) / 2, y: y - 20, size: 8, font: bold, color: dark });
      } else {
        page.drawText(c.title, { x: cx + (c.w - tw) / 2, y: y - 16, size: 8, font: bold, color: dark });
      }
      cx += c.w;
    }
    y -= headerH;

    // Item rows
    lineItems.forEach((it, i) => {
      cx = tableX;
      const cells = [
        String(i + 1),
        it.name,
        fmtINR(it.charges),
        it.hsn || "",
        pct(it.sgst),
        pct(it.cgst),
        pct(it.igst || (it.sgst + it.cgst)),
        String(it.qty),
        Number(it.taxAmount).toFixed(2),
        fmtINR(it.amount),
      ];
      for (let k = 0; k < cols.length; k++) {
        const c = cols[k];
        drawCellBox(cx, y, c.w, rowH);
        const txt = String(cells[k] ?? "");
        // truncate name if too long
        let display = txt;
        const sz = 8;
        if (font.widthOfTextAtSize(display, sz) > c.w - 4) {
          while (display.length > 1 && font.widthOfTextAtSize(display + "…", sz) > c.w - 4) display = display.slice(0, -1);
          display = display + "…";
        }
        const tw = font.widthOfTextAtSize(display, sz);
        const tx = k === 1 ? cx + 3 : cx + (c.w - tw) / 2;
        page.drawText(display, { x: tx, y: y - 14, size: sz, font, color: dark });
        cx += c.w;
      }
      y -= rowH;
    });

    // Totals rows: span cols 0..7 empty, label in col 8, value in col 9
    const drawTotalsRow = (label: string, value: string) => {
      cx = tableX;
      // empty span
      const spanW = cols.slice(0, 8).reduce((s, c) => s + c.w, 0);
      drawCellBox(cx, y, spanW, rowH);
      cx += spanW;
      // label cell
      drawCellBox(cx, y, cols[8].w, rowH);
      const lw = bold.widthOfTextAtSize(label, 9);
      page.drawText(label, { x: cx + (cols[8].w - lw) / 2, y: y - 14, size: 9, font: bold, color: dark });
      cx += cols[8].w;
      // value cell
      drawCellBox(cx, y, cols[9].w, rowH);
      const vw = font.widthOfTextAtSize(value, 8);
      page.drawText(value, { x: cx + (cols[9].w - vw) / 2, y: y - 14, size: 8, font, color: dark });
      y -= rowH;
    };
    drawTotalsRow("Total Billed", fmtINR(Number(inv.total_amount || 0)));
    drawTotalsRow("Total Paid", fmtINR(Number(inv.paid_amount || 0)));

    // Amount in words / Mode of payment rows
    const labelColW = 110;
    const valueColW = tableW - labelColW;
    const drawKVRow = (label: string, value: string, h = rowH) => {
      drawCellBox(tableX, y, labelColW, h);
      page.drawText(label, { x: tableX + 4, y: y - 14, size: 9, font: bold, color: dark });
      drawCellBox(tableX + labelColW, y, valueColW, h);
      page.drawText(value, { x: tableX + labelColW + 4, y: y - 14, size: 9, font, color: dark });
      y -= h;
    };

    const amountWords = numberToIndianWords(Number(inv.total_amount || 0));
    drawKVRow("Amount in words", amountWords);

    let modeText = inv.payment_mode || "Cash";
    if (Array.isArray(inv.payment_splits) && inv.payment_splits.length > 0) {
      modeText = inv.payment_splits.map((s: any) => `${s.mode}: ${fmtINR(Number(s.amount) || 0)}`).join("  |  ");
    }
    drawKVRow("Mode of payment", modeText);

    // Authorized signatory
    y -= 50;
    const sigText = "Authorized Signatory";
    const sw = bold.widthOfTextAtSize(sigText, 10);
    page.drawText(sigText, { x: width - 40 - sw, y, size: 10, font: bold, color: dark });

    // Footer
    const footerY = 80;
    page.drawText("----------------", {
      x: width / 2 - font.widthOfTextAtSize("----------------", 10) / 2,
      y: footerY + 30, size: 10, font, color: grey,
    });
    const addrParts = [clinic?.name, clinic?.address, clinic?.city, clinic?.pincode].filter(Boolean);
    const addrLine = addrParts.join(", ");
    if (addrLine) {
      const aw = font.widthOfTextAtSize(addrLine, 9);
      page.drawText(addrLine, { x: (width - aw) / 2, y: footerY + 16, size: 9, font, color: dark });
    }
    if (clinic?.email) {
      const domain = String(clinic.email).split("@")[1];
      if (domain) {
        const site = `Website: www.${domain}`;
        const sw2 = font.widthOfTextAtSize(site, 9);
        page.drawText(site, { x: (width - sw2) / 2, y: footerY + 4, size: 9, font, color: dark });
      }
    }
    if (clinic?.phone) {
      const ct = `For appointments and emergency care, contact us @ ${clinic.phone}`;
      const ctw = font.widthOfTextAtSize(ct, 9);
      page.drawText(ct, { x: (width - ctw) / 2, y: footerY - 12, size: 9, font, color: dark });
    }

    const pdfBytes = await pdfDoc.save();

    const safeNumber = String(inv.invoice_number || inv.id).replace(/[^A-Za-z0-9_-]/g, "_");
    const path = `${safeNumber}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("invoices")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("Upload failed:", upErr);
      return new Response(JSON.stringify({ error: "Upload failed", details: upErr }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = supabase.storage.from("invoices").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("invoices").update({ pdf_url: url }).eq("id", invoiceId);

    return new Response(JSON.stringify({ ok: true, url, path }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-invoice-pdf error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
