import * as XLSX from "xlsx";

export const PROCEDURE_FIELDS = [
  "patient_phone",
  "service_name",
  "procedure_date",
  "staff_name",
  "status",
  "symptoms",
  "diagnosis",
  "consultation_notes",
  "procedure_notes",
  "recommendations",
  "follow_up_date",
  "cost",
  "notes",
] as const;

export type ProcedureField = (typeof PROCEDURE_FIELDS)[number];

export const REQUIRED_PROCEDURE_FIELDS: ProcedureField[] = [
  "patient_phone",
  "service_name",
  "procedure_date",
];

export const normalizePhone = (v: any): string =>
  String(v ?? "").replace(/[\s\-()]/g, "").trim();

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m1 = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m1) {
    const dd = +m1[1], mm = +m1[2];
    let yy = +m1[3];
    if (yy < 100) yy += 2000;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    const d = new Date(Date.UTC(+m2[1], +m2[2] - 1, +m2[3]));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const headers = json.length ? Object.keys(json[0]) : [];
  return { headers, rows: json };
}

export interface MappedProcedureRow {
  index: number;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  patient_id?: string | null;
  staff_id?: string | null;
  skip?: boolean;
}

export function buildMappedProcedureRows(
  rows: Record<string, any>[],
  mapping: Record<string, ProcedureField | "">,
  phoneToPatientId: Map<string, string>,
  nameToStaffId: Map<string, string>
): MappedProcedureRow[] {
  const result: MappedProcedureRow[] = [];

  rows.forEach((raw, i) => {
    const data: Record<string, any> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const val = raw[header];
      if (val === undefined || val === null || val === "") continue;

      switch (field) {
        case "patient_phone":
          data[field] = normalizePhone(val);
          break;
        case "procedure_date":
        case "follow_up_date": {
          const d = parseDate(val);
          if (d) data[field] = d;
          else if (field === "procedure_date") errors.push("Invalid procedure_date");
          else warnings.push("Invalid follow_up_date (ignored)");
          break;
        }
        case "cost": {
          const n = Number(String(val).replace(/[^0-9.-]/g, ""));
          if (!isNaN(n)) data[field] = n;
          break;
        }
        default:
          data[field] = String(val).trim();
      }
    }

    if (!data.patient_phone) errors.push("patient phone missing");
    if (!data.service_name) errors.push("service name missing");
    if (!data.procedure_date) errors.push("procedure date missing");

    let patient_id: string | null = null;
    if (data.patient_phone) {
      patient_id = phoneToPatientId.get(data.patient_phone) ?? null;
      if (!patient_id) errors.push("Patient not found");
    }

    let staff_id: string | null = null;
    if (data.staff_name) {
      const key = String(data.staff_name).toLowerCase().trim();
      staff_id = nameToStaffId.get(key) ?? null;
      if (!staff_id) warnings.push(`Staff "${data.staff_name}" not matched`);
    }

    result.push({ index: i, data, errors, warnings, patient_id, staff_id, skip: false });
  });

  return result;
}

export function toProcedureInsertPayload(row: MappedProcedureRow): Record<string, any> {
  const d = row.data;
  const payload: Record<string, any> = {
    patient_id: row.patient_id,
    service_name: d.service_name,
    procedure_date: d.procedure_date,
    staff_id: row.staff_id,
    status: d.status || "Completed",
    symptoms: d.symptoms ?? null,
    diagnosis: d.diagnosis ?? null,
    consultation_notes: d.consultation_notes ?? null,
    procedure_notes: d.procedure_notes ?? null,
    recommendations: d.recommendations ?? null,
  };
  // Append optional notes/follow-up/cost into procedure_notes if present
  const extras: string[] = [];
  if (d.notes) extras.push(`Notes: ${d.notes}`);
  if (d.follow_up_date) extras.push(`Follow-up: ${d.follow_up_date}`);
  if (d.cost != null) extras.push(`Cost: ${d.cost}`);
  if (extras.length) {
    payload.procedure_notes = [payload.procedure_notes, extras.join(" | ")].filter(Boolean).join("\n");
  }
  return payload;
}