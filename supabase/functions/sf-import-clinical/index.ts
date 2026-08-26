// One-off Salesforce → Lovable Cloud import of Appointments (Appointment__c),
// Invoices (Billing__c), and Procedures (Diagnosis__c) for a hardcoded set
// of patients. All source datetimes are preserved. Existing rows for these
// patients are wiped and replaced with the Salesforce snapshot on each run
// (per user request). Traceability tags are stored in free-text columns.

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

async function sfQuery(soql: string): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = `${GATEWAY}/query?q=${encodeURIComponent(soql)}`;
  while (url) {
    const response: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SALESFORCE_API_KEY,
      },
    });
    if (!response.ok) throw new Error(`SF query failed [${response.status}]: ${await response.text()}`);
    const payload: { records?: any[]; done?: boolean; nextRecordsUrl?: string } = await response.json();
    out.push(...(payload.records || []));
    if (payload.done || !payload.nextRecordsUrl) break;
    url = `${GATEWAY}${payload.nextRecordsUrl.replace("/services/data/v62.0", "")}`;
  }
  return out;
}

function normalize(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Build doctor -> staff.id map by fuzzy name contains.
async function buildDoctorMap(): Promise<(sfName: string | null) => string | null> {
  const { data } = await admin.from("staff").select("id, first_name, last_name");
  const rows = (data || []).map((s) => ({
    id: s.id as string,
    key: normalize(`${s.first_name} ${s.last_name}`),
  }));
  return (sfName: string | null) => {
    if (!sfName) return null;
    const key = normalize(sfName);
    // Try substring match on any staff name key.
    for (const r of rows) {
      if (!r.key) continue;
      // Match if SF name contains each significant token of staff key.
      const tokens = r.key.split(" ").filter((t) => t.length > 2 && t !== "dr");
      if (tokens.length && tokens.every((t) => key.includes(t))) return r.id;
    }
    return null;
  };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const only = url.searchParams.get("only") || "";
  const skipReset = url.searchParams.get("reset") === "false";
  const targets = only
    ? MAPPING.filter((m) => m.name.toLowerCase().includes(only.toLowerCase()) || m.lovable_id === only)
    : MAPPING;

  const results: any[] = [];
  try {
    const doctorFor = await buildDoctorMap();

    for (const p of targets) {
      const log: any = { patient: p.name, appointments: 0, invoices: 0, procedures: 0, errors: [] as any[] };

      // 1. Reset existing rows for this patient (order: procedures, invoices, appointments)
      if (!skipReset) {
        await admin.from("procedures").delete().eq("patient_id", p.lovable_id);
        await admin.from("invoices").delete().eq("patient_id", p.lovable_id);
        await admin.from("appointments").delete().eq("patient_id", p.lovable_id);
      }

      // 2. Fetch Salesforce records
      const appts = await sfQuery(
        `SELECT Id, Start_Time__c, End_Time__c, Appointment_Status__c, Appointment_type__c, Visit_Type__c, Doctor_Name__c, Investigation__c, Description__c, CreatedDate FROM Appointment__c WHERE Patient__c = '${p.sf_id}'`,
      );
      const billings = await sfQuery(
        `SELECT Id, Name, Appointment__c, Billing_Date__c, Discount__c, GST__c, Quantity__c, Total_Amount__c, Total_Price__c, Total_Tax_Applicable__c, Total_Service_Fee__c, Payment_Mode__c, Procedure_Type__c, Procedure_Type_2__c, Procedure_Type_3__c, Doctor_Name__c, CreatedDate FROM Billing__c WHERE Patient__c = '${p.sf_id}'`,
      );
      const diagnoses = await sfQuery(
        `SELECT Id, Appointment__c, Diagnosis__c, Diagnoses__c, Symptoms__c, Symptoms_all__c, Prescription__c, Advice__c, Dietary_Advice__c, Procedure_Type__c, Treatment__c, Service_Type__c, Type_Of_Appointment__c, Visit_type__c, Special_Instructions__c, Payment_Instruction__c, Required_Lab_Test_s__c, History__c, Review__c, Follow_Up_Date__c, Consultation_Fee__c, CreatedDate FROM Diagnosis__c WHERE Patient__c = '${p.sf_id}'`,
      );

      // 3. Insert appointments and build sf_appt_id -> uuid map
      const apptIdMap = new Map<string, string>();
      const patientDisplay = p.name;
      const apptRows = appts.map((a) => {
        const start = a.Start_Time__c || a.CreatedDate;
        const end = a.End_Time__c || (start ? new Date(new Date(start).getTime() + 5 * 60000).toISOString() : new Date().toISOString());
        const statusMap: Record<string, string> = {
          Confirmed: "Completed", Completed: "Completed", "No Show": "No-show",
          Cancelled: "Cancelled", Scheduled: "Scheduled", Rescheduled: "Scheduled",
        };
        const service = a.Investigation__c || a.Description__c || "Consultation";
        return {
          patient_id: p.lovable_id,
          patient_name: patientDisplay,
          service: String(service).slice(0, 500),
          start_time: start,
          end_time: end,
          status: statusMap[a.Appointment_Status__c] || "Completed",
          appointment_type: a.Visit_Type__c || a.Appointment_type__c || "Walk-in",
          reason_for_consultation: `${a.Investigation__c || ""}\n[sf_appt_id=${a.Id}${a.Doctor_Name__c ? `; doctor=${a.Doctor_Name__c}` : ""}]`.trim(),
          source: "salesforce",
          staff_id: doctorFor(a.Doctor_Name__c),
          created_at: a.CreatedDate,
          updated_at: a.CreatedDate,
          _sf_id: a.Id,
        };
      });

      for (const batch of chunk(apptRows, 100)) {
        const rows = batch.map(({ _sf_id, ...rest }) => rest);
        const { data, error } = await admin.from("appointments").insert(rows).select("id, reason_for_consultation");
        if (error) { log.errors.push({ step: "appointments", error: error.message }); continue; }
        // Match back via sf_appt_id tag
        (data || []).forEach((row: any) => {
          const m = row.reason_for_consultation?.match(/sf_appt_id=([a-zA-Z0-9]+)/);
          if (m) apptIdMap.set(m[1], row.id);
        });
        log.appointments += rows.length;
      }

      // 4. Insert invoices
      const invRows = billings.map((b) => {
        const services = [b.Procedure_Type__c, b.Procedure_Type_2__c, b.Procedure_Type_3__c].filter(Boolean);
        const total = Number(b.Total_Amount__c || b.Total_Price__c || 0);
        return {
          invoice_number: b.Name,
          patient_id: p.lovable_id,
          patient_name: patientDisplay,
          services: services.length ? services : ["Service"],
          total_amount: total,
          paid_amount: total, // SF billings are historical/paid
          status: total > 0 ? "Paid" : "Pending",
          payment_type: "One-time",
          payment_mode: b.Payment_Mode__c || "Cash",
          tax_rate: Number(b.GST__c || 0),
          tax_amount: Number(b.Total_Tax_Applicable__c || 0),
          appointment_id: b.Appointment__c ? apptIdMap.get(b.Appointment__c) || null : null,
          doctor_id: doctorFor(b.Doctor_Name__c),
          notes: `[sf_bill_id=${b.Id}${b.Doctor_Name__c ? `; doctor=${b.Doctor_Name__c}` : ""}]`,
          created_at: b.CreatedDate,
          updated_at: b.CreatedDate,
        };
      });
      for (const batch of chunk(invRows, 100)) {
        const { error } = await admin.from("invoices").insert(batch);
        if (error) { log.errors.push({ step: "invoices", error: error.message }); continue; }
        log.invoices += batch.length;
      }

      // Build sf_appt_id -> appointment.service and sf_appt_id -> billing.Procedure_Type__c maps
      // for fallback service_name when Diagnosis has none.
      const apptServiceBySfId = new Map<string, string>();
      appts.forEach((a) => {
        const svc = a.Investigation__c || a.Description__c;
        if (svc) apptServiceBySfId.set(a.Id, String(svc));
      });
      const billingProcBySfApptId = new Map<string, string>();
      billings.forEach((b) => {
        if (b.Appointment__c) {
          const proc = [b.Procedure_Type__c, b.Procedure_Type_2__c, b.Procedure_Type_3__c].filter(Boolean).join(", ");
          if (proc) billingProcBySfApptId.set(b.Appointment__c, proc);
        }
      });

      // 5. Insert procedures — preserve every non-empty SF field
      const procRows = diagnoses.map((d) => {
        const treatment = d.Treatment__c ? String(d.Treatment__c).replace(/;/g, ", ") : null;
        const serviceName =
          treatment ||
          d.Procedure_Type__c ||
          d.Service_Type__c ||
          (d.Appointment__c && billingProcBySfApptId.get(d.Appointment__c)) ||
          (d.Appointment__c && apptServiceBySfId.get(d.Appointment__c)) ||
          d.Type_Of_Appointment__c ||
          "Consultation";
        const symptoms = [d.Symptoms__c, d.Symptoms_all__c && d.Symptoms_all__c !== d.Symptoms__c ? d.Symptoms_all__c : null]
          .filter(Boolean).join("\n") || null;
        const consultationParts = [
          d.Advice__c && `Advice: ${d.Advice__c}`,
          d.Dietary_Advice__c && `Dietary Advice: ${d.Dietary_Advice__c}`,
          d.History__c && `History: ${d.History__c}`,
          d.Required_Lab_Test_s__c && `Lab Tests: ${d.Required_Lab_Test_s__c}`,
          d.Payment_Instruction__c && `Payment Instruction: ${d.Payment_Instruction__c}`,
          d.Consultation_Fee__c ? `Consultation Fee: ₹${d.Consultation_Fee__c}` : null,
        ].filter(Boolean);
        const reviewBits = [
          `[sf_diag_id=${d.Id}]`,
          d.Review__c && `Review: ${d.Review__c}`,
          d.Visit_type__c && `Visit Type: ${d.Visit_type__c}`,
          d.Type_Of_Appointment__c && `Type: ${d.Type_Of_Appointment__c}`,
          d.Follow_Up_Date__c && `Follow-Up: ${d.Follow_Up_Date__c}`,
        ].filter(Boolean);
        return {
          patient_id: p.lovable_id,
          service_name: String(serviceName).slice(0, 500),
          procedure_date: d.CreatedDate,
          status: "Completed",
          appointment_id: d.Appointment__c ? apptIdMap.get(d.Appointment__c) || null : null,
          diagnosis: [d.Diagnosis__c, d.Diagnoses__c].filter(Boolean).join("\n") || null,
          symptoms,
          procedure_notes: d.Prescription__c || null,
          consultation_notes: consultationParts.length ? consultationParts.join("\n") : null,
          recommendations: d.Special_Instructions__c || null,
          review_notes: reviewBits.join(" | "),
          created_at: d.CreatedDate,
          updated_at: d.CreatedDate,
        };
      });
      for (const batch of chunk(procRows, 100)) {
        const { error } = await admin.from("procedures").insert(batch);
        if (error) { log.errors.push({ step: "procedures", error: error.message }); continue; }
        log.procedures += batch.length;
      }

      results.push(log);
    }

    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sf-import-clinical failed:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});