// Salesforce -> Lovable Cloud import of Appointments (Appointment__c),
// Invoices (Billing__c), and Procedures (Diagnosis__c) for every patient
// that has a Salesforce Id (patients.sf_id) and hasn't been processed by
// this sync yet (patients.sf_clinical_synced_at IS NULL). Each call handles
// one bounded batch and marks each patient it successfully processes, so
// the UI's "Sync from Salesforce" button can just keep calling this until
// it reports 0 patients processed - no offset/cursor bookkeeping needed,
// and newly-linked patients are picked up automatically regardless of
// where they fall in the patient list.
//
// Query params:
//   limit - patients per call, default 25 (keep small; each patient does
//           3 Salesforce queries plus inserts)
//   only  - name substring or patient UUID, for spot-checking a single
//           patient regardless of its synced_at marker
//   reset - "true" to delete this run's target patients' previously
//           Salesforce-imported rows (sf_id IS NOT NULL only - never
//           touches rows created directly in the app) and clear their
//           synced_at marker before re-importing. Off by default.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SALESFORCE_API_KEY = Deno.env.get("SALESFORCE_API_KEY")!;

const GATEWAY = "https://connector-gateway.lovable.dev/salesforce";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

interface Target { lovable_id: string; sf_id: string; name: string }

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
    for (const r of rows) {
      if (!r.key) continue;
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

async function fetchTargets(only: string, limit: number): Promise<Target[]> {
  if (only) {
    const { data, error } = await admin
      .from("patients")
      .select("id, sf_id, first_name, last_name")
      .not("sf_id", "is", null);
    if (error) throw error;
    return (data || [])
      .filter((p) => p.id === only || `${p.first_name} ${p.last_name}`.toLowerCase().includes(only.toLowerCase()))
      .map((p) => ({ lovable_id: p.id, sf_id: p.sf_id as string, name: `${p.first_name} ${p.last_name}`.trim() }));
  }
  const { data, error } = await admin
    .from("patients")
    .select("id, sf_id, first_name, last_name")
    .not("sf_id", "is", null)
    .is("sf_clinical_synced_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((p) => ({ lovable_id: p.id, sf_id: p.sf_id as string, name: `${p.first_name} ${p.last_name}`.trim() }));
}

async function existingSfIds(table: string, patientId: string): Promise<Set<string>> {
  const { data } = await admin.from(table).select("sf_id").eq("patient_id", patientId).not("sf_id", "is", null);
  return new Set((data || []).map((r: any) => r.sf_id as string));
}

async function syncPatient(p: Target, doctorFor: (n: string | null) => string | null, reset: boolean, log: any) {
  if (reset) {
    await admin.from("procedures").delete().eq("patient_id", p.lovable_id).not("sf_id", "is", null);
    await admin.from("invoices").delete().eq("patient_id", p.lovable_id).not("sf_id", "is", null);
    await admin.from("appointments").delete().eq("patient_id", p.lovable_id).not("sf_id", "is", null);
  }

  const [existingApptRows, existingInvoices, existingProcs] = await Promise.all([
    admin.from("appointments").select("id, sf_id").eq("patient_id", p.lovable_id).not("sf_id", "is", null)
      .then(({ data }) => data || []),
    existingSfIds("invoices", p.lovable_id),
    existingSfIds("procedures", p.lovable_id),
  ]);
  const existingAppts = new Set(existingApptRows.map((r: any) => r.sf_id as string));

  const appts = await sfQuery(
    `SELECT Id, Start_Time__c, End_Time__c, Appointment_Status__c, Appointment_type__c, Visit_Type__c, Doctor_Name__c, Investigation__c, Description__c, CreatedDate FROM Appointment__c WHERE Patient__c = '${p.sf_id}'`,
  );
  const billings = await sfQuery(
    `SELECT Id, Name, Appointment__c, Billing_Date__c, Discount__c, GST__c, Quantity__c, Total_Amount__c, Total_Price__c, Total_Tax_Applicable__c, Total_Service_Fee__c, Payment_Mode__c, Procedure_Type__c, Procedure_Type_2__c, Procedure_Type_3__c, Doctor_Name__c, CreatedDate FROM Billing__c WHERE Patient__c = '${p.sf_id}'`,
  );
  const diagnoses = await sfQuery(
    `SELECT Id, Appointment__c, Diagnosis__c, Diagnoses__c, Symptoms__c, Symptoms_all__c, Prescription__c, Advice__c, Dietary_Advice__c, Procedure_Type__c, Treatment__c, Service_Type__c, Type_Of_Appointment__c, Visit_type__c, Special_Instructions__c, Payment_Instruction__c, Required_Lab_Test_s__c, History__c, Review__c, Follow_Up_Date__c, Consultation_Fee__c, CreatedDate FROM Diagnosis__c WHERE Patient__c = '${p.sf_id}'`,
  );

  const apptIdMap = new Map<string, string>();
  existingApptRows.forEach((r: any) => apptIdMap.set(r.sf_id, r.id));

  const newAppts = appts.filter((a) => !existingAppts.has(a.Id));
  log.skipped += appts.length - newAppts.length;
  const apptRows = newAppts.map((a) => {
    const start = a.Start_Time__c || a.CreatedDate;
    const end = a.End_Time__c || (start ? new Date(new Date(start).getTime() + 5 * 60000).toISOString() : new Date().toISOString());
    const statusMap: Record<string, string> = {
      Confirmed: "Completed", Completed: "Completed", "No Show": "No-show",
      Cancelled: "Cancelled", Scheduled: "Scheduled", Rescheduled: "Scheduled",
    };
    const service = a.Investigation__c || a.Description__c || "Consultation";
    return {
      patient_id: p.lovable_id,
      patient_name: p.name,
      service: String(service).slice(0, 500),
      start_time: start,
      end_time: end,
      status: statusMap[a.Appointment_Status__c] || "Completed",
      appointment_type: a.Visit_Type__c || a.Appointment_type__c || "Walk-in",
      reason_for_consultation: `${a.Investigation__c || ""}${a.Doctor_Name__c ? ` (Dr. ${a.Doctor_Name__c})` : ""}`.trim() || null,
      source: "salesforce",
      staff_id: doctorFor(a.Doctor_Name__c),
      sf_id: a.Id,
      created_at: a.CreatedDate,
      updated_at: a.CreatedDate,
    };
  });

  for (const batch of chunk(apptRows, 100)) {
    const { data, error } = await admin.from("appointments").insert(batch).select("id, sf_id");
    if (error) throw new Error(`appointments insert: ${error.message}`);
    (data || []).forEach((row: any) => apptIdMap.set(row.sf_id, row.id));
    log.appointments += batch.length;
  }

  const newBillings = billings.filter((b) => !existingInvoices.has(b.Id));
  log.skipped += billings.length - newBillings.length;
  const invRows = newBillings.map((b) => {
    const services = [b.Procedure_Type__c, b.Procedure_Type_2__c, b.Procedure_Type_3__c].filter(Boolean);
    const total = Number(b.Total_Amount__c || b.Total_Price__c || 0);
    return {
      invoice_number: b.Name,
      patient_id: p.lovable_id,
      patient_name: p.name,
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
      notes: b.Doctor_Name__c ? `Doctor: ${b.Doctor_Name__c}` : null,
      sf_id: b.Id,
      created_at: b.CreatedDate,
      updated_at: b.CreatedDate,
    };
  });
  for (const batch of chunk(invRows, 100)) {
    const { error } = await admin.from("invoices").insert(batch);
    if (error) throw new Error(`invoices insert: ${error.message}`);
    log.invoices += batch.length;
  }

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

  const newDiagnoses = diagnoses.filter((d) => !existingProcs.has(d.Id));
  log.skipped += diagnoses.length - newDiagnoses.length;
  const procRows = newDiagnoses.map((d) => {
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
      review_notes: reviewBits.length ? reviewBits.join(" | ") : null,
      sf_id: d.Id,
      created_at: d.CreatedDate,
      updated_at: d.CreatedDate,
    };
  });
  for (const batch of chunk(procRows, 100)) {
    const { error } = await admin.from("procedures").insert(batch);
    if (error) throw new Error(`procedures insert: ${error.message}`);
    log.procedures += batch.length;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const only = url.searchParams.get("only") || "";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "25")));
  const reset = url.searchParams.get("reset") === "true";

  const results: any[] = [];
  try {
    const targets = await fetchTargets(only, limit);
    const doctorFor = await buildDoctorMap();

    if (reset && only) {
      await admin.from("patients").update({ sf_clinical_synced_at: null }).in("id", targets.map((t) => t.lovable_id));
    }

    for (const p of targets) {
      const log: any = { patient: p.name, appointments: 0, invoices: 0, procedures: 0, skipped: 0, errors: [] as any[] };
      try {
        await syncPatient(p, doctorFor, reset, log);
        if (!only) {
          await admin.from("patients").update({ sf_clinical_synced_at: new Date().toISOString() }).eq("id", p.lovable_id);
        }
      } catch (e) {
        log.errors.push((e as Error).message);
      }
      results.push(log);
    }

    return new Response(
      JSON.stringify({ ok: true, processed: targets.length, results }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sf-import-clinical failed:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
