import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, patientId, patientName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch patient context
    const [patientRes, appointmentsRes, proceduresRes, invoicesRes, prescriptionsRes] = await Promise.all([
      sb.from("patients").select("*").eq("id", patientId).single(),
      sb.from("appointments").select("*, staff(first_name, last_name)").eq("patient_id", patientId).order("start_time", { ascending: false }).limit(20),
      sb.from("procedures").select("*, staff(first_name, last_name)").eq("patient_id", patientId).order("procedure_date", { ascending: false }).limit(20),
      sb.from("invoices").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20),
      sb.rpc("get_patient_prescriptions", { p_patient_id: patientId }).catch(() => ({ data: null })),
    ]);

    // Get prescriptions via procedures
    let prescriptions: any[] = [];
    if (proceduresRes.data) {
      const procIds = proceduresRes.data.map((p: any) => p.id);
      if (procIds.length > 0) {
        const { data } = await sb.from("prescriptions").select("*").in("procedure_id", procIds);
        prescriptions = data || [];
      }
    }

    // Get services & products for recommendations
    const [servicesRes, productsRes] = await Promise.all([
      sb.from("services").select("name, category, price").limit(50),
      sb.from("pharma_products").select("name, category, selling_price, generic_name").limit(50),
    ]);

    const patient = patientRes.data;
    const appointments = appointmentsRes.data || [];
    const procedures = proceduresRes.data || [];
    const invoices = invoicesRes.data || [];

    const upcomingAppts = appointments.filter((a: any) => new Date(a.start_time) >= new Date());
    const pastAppts = appointments.filter((a: any) => new Date(a.start_time) < new Date());
    const totalDue = invoices
      .filter((i: any) => i.status !== "Paid")
      .reduce((s: number, i: any) => s + (Number(i.total_amount) - Number(i.paid_amount)), 0);

    const systemPrompt = `You are DermaCare AI, a friendly and professional health assistant for a dermatology clinic's patient portal. You are chatting with ${patientName}.

PATIENT PROFILE:
- Name: ${patient?.first_name} ${patient?.last_name}
- Gender: ${patient?.gender || "Not specified"}
- DOB: ${patient?.date_of_birth || "Not provided"}
- Phone: ${patient?.phone || "Not provided"}
- Skin Type: ${patient?.skin_type || "Not assessed"}
- Skin Concerns: ${patient?.skin_concerns || "None noted"}
- Allergies: ${patient?.allergies || "None"}
- Current Medications: ${patient?.current_medications || "None"}
- Medical History: ${patient?.medical_history || "None"}

APPOINTMENTS:
- Upcoming: ${upcomingAppts.length} appointments
${upcomingAppts.slice(0, 5).map((a: any) => `  - ${a.service} on ${new Date(a.start_time).toLocaleDateString("en-IN")} at ${new Date(a.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} (${a.status})${a.staff ? ` with Dr. ${a.staff.first_name} ${a.staff.last_name}` : ""}`).join("\n")}
- Past: ${pastAppts.length} appointments

PROCEDURE HISTORY (recent):
${procedures.slice(0, 10).map((p: any) => `- ${p.service_name} on ${new Date(p.procedure_date).toLocaleDateString("en-IN")} | Diagnosis: ${p.diagnosis || "N/A"} | Notes: ${p.consultation_notes || "N/A"}${p.staff ? ` | Dr. ${p.staff.first_name} ${p.staff.last_name}` : ""}`).join("\n") || "No procedures recorded"}

PRESCRIPTIONS:
${prescriptions.slice(0, 15).map((rx: any) => `- ${rx.medicine_name} | Dosage: ${rx.dosage || "N/A"} | Frequency: ${rx.frequency || "N/A"} | Duration: ${rx.duration || "N/A"}`).join("\n") || "No prescriptions"}

BILLING:
- Outstanding balance: ₹${totalDue}
- Total invoices: ${invoices.length}
${invoices.slice(0, 5).map((i: any) => `- ${i.invoice_number}: ₹${i.total_amount} (${i.status}) - ${new Date(i.created_at).toLocaleDateString("en-IN")}`).join("\n")}

AVAILABLE SERVICES:
${(servicesRes.data || []).slice(0, 20).map((s: any) => `- ${s.name} (${s.category}) - ₹${s.price}`).join("\n")}

AVAILABLE PRODUCTS:
${(productsRes.data || []).slice(0, 20).map((p: any) => `- ${p.name} (${p.category}) - ₹${p.selling_price}${p.generic_name ? ` [${p.generic_name}]` : ""}`).join("\n")}

GUIDELINES:
1. Be warm, empathetic, and professional. Use the patient's first name.
2. When asked about appointments, show their upcoming ones and offer to help book new ones by telling them to use the Appointments tab.
3. When asked about procedures/history, summarize their recent procedures with key details.
4. When asked about bills/invoices, show their outstanding balance and recent invoices.
5. When asked about medications, list their current prescriptions.
6. For product recommendations, consider their skin type, concerns, and current treatments.
7. For concerns, listen empathetically and suggest they book an appointment for medical advice.
8. Never diagnose conditions - always recommend consulting with the doctor.
9. Keep responses concise and helpful. Use bullet points for lists.
10. If you can't find specific data, let them know and suggest next steps.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("portal-bot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
