import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "list_doctors",
      description: "List all available doctors/practitioners at the clinic. Call this when the patient asks to book an appointment and you need to show them which doctors are available.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_doctor_availability",
      description: "Check if a specific doctor is available at a given date and time. Use this after the patient has chosen a doctor and proposed a date/time.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string", description: "UUID of the doctor" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format (24h)" },
        },
        required: ["doctor_id", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book an appointment for the patient after confirming doctor availability and getting patient confirmation. Only call this after the patient has explicitly confirmed they want to book.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string", description: "UUID of the doctor" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format (24h)" },
          service: { type: "string", description: "The service/reason for the appointment" },
        },
        required: ["doctor_id", "date", "time", "service"],
      },
    },
  },
];

async function executeTool(sb: any, toolName: string, args: any, patientId: string, patientName: string) {
  switch (toolName) {
    case "list_doctors": {
      const { data } = await sb.from("staff").select("id, first_name, last_name, specialization, role").in("role", ["Doctor", "Dermatologist", "Practitioner"]);
      if (!data || data.length === 0) {
        // Fallback: get all staff
        const { data: allStaff } = await sb.from("staff").select("id, first_name, last_name, specialization, role");
        return JSON.stringify({ doctors: allStaff || [] });
      }
      return JSON.stringify({ doctors: data });
    }

    case "check_doctor_availability": {
      const { doctor_id, date, time } = args;
      const startTime = `${date}T${time}:00`;
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 min slot

      // Check clinic working hours
      const dayOfWeek = startDate.getDay();
      const { data: wh } = await sb.from("working_hours").select("*").eq("day_of_week", dayOfWeek).single();
      if (wh && !wh.is_open) {
        return JSON.stringify({ available: false, reason: "The clinic is closed on this day." });
      }
      if (wh) {
        const requestedTime = time;
        if (requestedTime < wh.open_time || requestedTime >= wh.close_time) {
          return JSON.stringify({ available: false, reason: `Clinic hours are ${wh.open_time} to ${wh.close_time} on this day.` });
        }
        if (wh.break_start && wh.break_end && requestedTime >= wh.break_start && requestedTime < wh.break_end) {
          return JSON.stringify({ available: false, reason: `This time falls during the lunch break (${wh.break_start} - ${wh.break_end}).` });
        }
      }

      // Check for conflicting appointments
      const { data: conflicts } = await sb
        .from("appointments")
        .select("id, start_time, end_time, service, status")
        .eq("staff_id", doctor_id)
        .gte("start_time", `${date}T00:00:00`)
        .lte("start_time", `${date}T23:59:59`)
        .neq("status", "Cancelled");

      const hasConflict = (conflicts || []).some((appt: any) => {
        const aStart = new Date(appt.start_time).getTime();
        const aEnd = new Date(appt.end_time).getTime();
        return startDate.getTime() < aEnd && endDate.getTime() > aStart;
      });

      if (hasConflict) {
        // Suggest nearby available slots
        const bookedTimes = (conflicts || []).map((a: any) => {
          const s = new Date(a.start_time);
          return `${s.getHours().toString().padStart(2, "0")}:${s.getMinutes().toString().padStart(2, "0")}`;
        });
        return JSON.stringify({ available: false, reason: "Doctor already has an appointment at this time.", booked_slots_on_this_day: bookedTimes });
      }

      // Check doctor leave
      const { data: doctorInfo } = await sb.from("staff").select("first_name, last_name").eq("id", doctor_id).single();
      return JSON.stringify({ available: true, doctor_name: doctorInfo ? `Dr. ${doctorInfo.first_name} ${doctorInfo.last_name}` : "Doctor", date, time });
    }

    case "book_appointment": {
      const { doctor_id, date, time, service } = args;
      const startTime = `${date}T${time}:00`;
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + 30 * 60000);

      const { data: appt, error } = await sb.from("appointments").insert({
        patient_id: patientId,
        patient_name: patientName,
        staff_id: doctor_id,
        service,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "Scheduled",
        source: "portal",
      }).select("id, start_time, end_time, service, status").single();

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      const { data: doctorInfo } = await sb.from("staff").select("first_name, last_name").eq("id", doctor_id).single();
      return JSON.stringify({
        success: true,
        appointment: {
          id: appt.id,
          doctor: doctorInfo ? `Dr. ${doctorInfo.first_name} ${doctorInfo.last_name}` : "Doctor",
          date: new Date(appt.start_time).toLocaleDateString("en-IN"),
          time: new Date(appt.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          service: appt.service,
          status: appt.status,
        },
      });
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

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
      Promise.resolve().then(() => sb.rpc("get_patient_prescriptions", { p_patient_id: patientId })).catch(() => ({ data: null })),
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

    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const systemPrompt = `You are DermaCare AI, a friendly and professional health assistant for a dermatology clinic's patient portal. You are chatting with ${patientName}. Today is ${today}.

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

APPOINTMENT BOOKING GUIDELINES:
You can book appointments for the patient using the provided tools. Follow this flow:
1. When the patient wants to book, first ask what their concern/issue is (or use the one they mentioned).
2. Call list_doctors to show available doctors. Present them with names and specializations.
3. Once they pick a doctor, ask for their preferred date and time.
4. Call check_doctor_availability to verify the slot. If unavailable, suggest alternatives.
5. Once a slot is confirmed available, summarize the appointment details (doctor, date, time, service) and ask for explicit confirmation.
6. Only after they confirm, call book_appointment to create it.
7. Confirm the booking with all details.

GENERAL GUIDELINES:
1. Be warm, empathetic, and professional. Use the patient's first name.
2. When asked about appointments, show their upcoming ones and offer to help book new ones.
3. When asked about procedures/history, summarize their recent procedures with key details.
4. When asked about bills/invoices, show their outstanding balance and recent invoices.
5. When asked about medications, list their current prescriptions.
6. For product recommendations, consider their skin type, concerns, and current treatments.
7. Never diagnose conditions - always recommend consulting with the doctor.
8. Keep responses concise and helpful. Use bullet points for lists.
9. If you can't find specific data, let them know and suggest next steps.`;

    // Build the full message array for the AI
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Tool-calling loop: keep calling until we get a final text response
    const MAX_TOOL_ROUNDS = 5;
    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
      round++;
      const isLastRound = round === MAX_TOOL_ROUNDS;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools: isLastRound ? undefined : tools,
          stream: false,
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

      const result = await response.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "No response from AI" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assistantMessage = choice.message;

      // If the model wants to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        aiMessages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: any = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch { /* empty args */ }

          console.log(`Tool call: ${fnName}`, fnArgs);
          const toolResult = await executeTool(sb, fnName, fnArgs, patientId, patientName);
          console.log(`Tool result: ${toolResult}`);

          aiMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
        // Continue the loop to get the next AI response
        continue;
      }

      // Final text response - stream it back as SSE for the client
      const content = assistantMessage.content || "";
      // Create SSE response manually
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send the content as a single SSE chunk (simulating streaming format the client expects)
          const words = content.split(" ");
          let i = 0;
          const chunkSize = 3; // Send ~3 words at a time for smooth rendering
          
          function sendChunk() {
            if (i >= words.length) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            const chunk = words.slice(i, i + chunkSize).join(" ") + (i + chunkSize < words.length ? " " : "");
            const sseData = JSON.stringify({
              choices: [{ delta: { content: chunk } }],
            });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            i += chunkSize;
            // Use setTimeout for a slight delay to simulate streaming
            setTimeout(sendChunk, 10);
          }
          sendChunk();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Should not reach here, but safety fallback
    return new Response(JSON.stringify({ error: "Too many tool rounds" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("portal-bot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
