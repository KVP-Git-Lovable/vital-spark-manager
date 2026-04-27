import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fmtINR(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Invoice not found", details: invErr }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const teal = rgb(0.05, 0.58, 0.53);
    const dark = rgb(0.1, 0.1, 0.1);
    const grey = rgb(0.4, 0.4, 0.4);

    let y = height - 50;

    // Header
    page.drawText("The Skin Clinic", { x: 40, y, size: 22, font: fontBold, color: teal });
    page.drawText("INVOICE", { x: width - 140, y, size: 22, font: fontBold, color: teal });
    y -= 18;
    page.drawText("Clinic Manager", { x: 40, y, size: 10, font, color: grey });
    page.drawText(String(inv.invoice_number || ""), { x: width - 140, y, size: 10, font, color: grey });
    y -= 12;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 2, color: teal });
    y -= 30;

    // Bill to / details
    page.drawText("BILL TO", { x: 40, y, size: 9, font: fontBold, color: grey });
    page.drawText("DETAILS", { x: width - 200, y, size: 9, font: fontBold, color: grey });
    y -= 14;
    page.drawText(String(inv.patient_name || "Walk-in Patient"), { x: 40, y, size: 12, font: fontBold, color: dark });
    const created = new Date(inv.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
    page.drawText(`Date: ${created}`, { x: width - 200, y, size: 10, font, color: dark });
    y -= 14;
    page.drawText(`Payment: ${inv.payment_mode || "Cash"}`, { x: width - 200, y, size: 10, font, color: dark });
    y -= 14;
    page.drawText(`Type: ${inv.payment_type || "One-time"}`, { x: width - 200, y, size: 10, font, color: dark });
    y -= 14;
    page.drawText(`Status: ${inv.status || ""}`, { x: width - 200, y, size: 10, font: fontBold, color: teal });
    y -= 30;

    // Services table header
    page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 22, color: rgb(0.94, 0.99, 0.98) });
    page.drawText("#", { x: 50, y: y + 4, size: 10, font: fontBold, color: teal });
    page.drawText("SERVICE", { x: 80, y: y + 4, size: 10, font: fontBold, color: teal });
    page.drawText("AMOUNT", { x: width - 110, y: y + 4, size: 10, font: fontBold, color: teal });
    y -= 22;

    const services: string[] = Array.isArray(inv.services) ? inv.services : [];
    services.forEach((s, i) => {
      page.drawText(String(i + 1), { x: 50, y, size: 10, font, color: dark });
      page.drawText(String(s).slice(0, 60), { x: 80, y, size: 10, font, color: dark });
      page.drawText("-", { x: width - 110, y, size: 10, font, color: dark });
      y -= 18;
    });

    y -= 20;
    page.drawLine({ start: { x: width - 250, y }, end: { x: width - 40, y }, thickness: 0.5, color: grey });
    y -= 16;

    const total = Number(inv.total_amount || 0);
    const paid = Number(inv.paid_amount || 0);
    const balance = Math.max(0, total - paid);

    page.drawText("Total Amount", { x: width - 250, y, size: 10, font, color: dark });
    page.drawText(fmtINR(total), { x: width - 130, y, size: 10, font, color: dark });
    y -= 16;
    page.drawText("Paid Amount", { x: width - 250, y, size: 10, font, color: dark });
    page.drawText(fmtINR(paid), { x: width - 130, y, size: 10, font, color: dark });
    y -= 16;
    page.drawLine({ start: { x: width - 250, y: y + 6 }, end: { x: width - 40, y: y + 6 }, thickness: 1, color: teal });
    page.drawText("Balance Due", { x: width - 250, y, size: 12, font: fontBold, color: teal });
    page.drawText(fmtINR(balance), { x: width - 130, y, size: 12, font: fontBold, color: teal });

    if (inv.notes) {
      y -= 40;
      page.drawText("Notes:", { x: 40, y, size: 10, font: fontBold, color: dark });
      y -= 14;
      page.drawText(String(inv.notes).slice(0, 200), { x: 40, y, size: 9, font, color: grey });
    }

    // Footer
    page.drawText("Thank you for choosing The Skin Clinic", {
      x: 40, y: 40, size: 9, font, color: grey,
    });
    page.drawText("This is a computer-generated invoice.", {
      x: 40, y: 28, size: 8, font, color: grey,
    });

    const pdfBytes = await pdfDoc.save();

    const safeNumber = String(inv.invoice_number || inv.id).replace(/[^A-Za-z0-9_-]/g, "_");
    const path = `${safeNumber}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("invoices")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      console.error("Upload failed:", upErr);
      return new Response(JSON.stringify({ error: "Upload failed", details: upErr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = supabase.storage.from("invoices").getPublicUrl(path);
    const url = pub.publicUrl;

    // Cache URL on invoice
    await supabase.from("invoices").update({ pdf_url: url }).eq("id", invoiceId);

    return new Response(JSON.stringify({ ok: true, url, path }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-invoice-pdf error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});