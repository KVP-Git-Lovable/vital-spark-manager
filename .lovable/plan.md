## Goal
In the Procedures section, generate a prescription PDF that matches the uploaded Salesforce template (mint header band, clinic logo on right, doctor info on left, patient info two-column, Prescription / Symptoms / Diagnosis blocks, footer line). Expose two actions:

- **Download Prescription** — generates and downloads the PDF
- **Send via WhatsApp** — generates the PDF, uploads it, prepares the Twilio send (Twilio wiring stubbed for later)

## Where the buttons go
Add both buttons inside `ProcedureDetailSheet.tsx` (the only place procedure data is open, contains prescriptions). Place them in the existing action row near "Save"/"Delete", with `Download` icon and `MessageCircle` (WhatsApp) icon. Also add a small "Download Prescription" action on the Procedures list row menu (Procedures.tsx) for quick access.

## Auto-filled fields
Pulled from existing tables (`procedures` joined with `patients` and `staff`, plus `prescriptions` rows):

- Patient Name → `patients.first_name + last_name`
- Phone, Email, Sex, Age (from DOB) → `patients`
- Doctor Name + qualifications → `staff.first_name/last_name`, plus `staff.qualifications`/`role` if present, else just "Dr. {name}"
- Date → `procedure_date` formatted `DD/MM/YYYY`
- Prescription No → `D-` + zero-padded short hash of procedure id (deterministic, e.g. `D-0012`)
- Appointment No → if `procedures.appointment_id` exists use `A-` + short of that id; otherwise generate one from procedure id (`A-` + 4-digit short). No DB schema change required.
- Prescription body → joined list of `prescriptions` rows (`medicine_name — dosage, frequency, duration. instructions`). If empty, fall back to `procedure_notes` / `consultation_notes`.
- Symptoms → `procedures.consultation_notes` (current "Symptoms" field in form) — also check existing column naming when implementing
- Diagnosis → `procedures.diagnosis`

## New edge function: `generate-prescription-pdf`
- Input: `{ procedureId: string }`
- Loads procedure + patient + staff + prescriptions server-side via service role
- Builds PDF with `pdf-lib` (same library used by `generate-invoice-pdf`)
- Layout:
  - Top mint-green band (`rgb(0.78, 0.88, 0.78)` approx) ~150px tall
  - Left side: "THE SKIN CLINIC" bold, phone line, address line
  - Right side: clinic logo (loaded from `branding` if available, otherwise omitted)
  - Below band on left: Dr. name + qualifications + role + phone
  - Below band on right: "Prescription No: D-xxxx", "Date: dd/mm/yyyy"
  - Centered title "Prescription Document" + horizontal rule
  - Two-column patient block: Patient Name / Appointment No, Phone No / Email Id, Age / Sex
  - "Prescription:" block (teal heading)
  - "Symptoms:" left + "Diagnosis:" right (teal headings)
  - Footer band with clinic phones, email, website (sourced from clinic settings if available, else hardcoded fallback matching template)
- Returns base64 PDF + filename `Prescription-{patientName}-{date}.pdf`

## New edge function: `send-prescription-whatsapp` (Twilio stub)
- Input: `{ procedureId: string }`
- Calls `generate-prescription-pdf` internally, uploads result to `procedure-attachments` bucket at `prescriptions/{procedureId}/{filename}`, gets public URL
- Inserts a row into `procedure_attachments` for audit
- Returns `{ ok: true, public_url, phone, message: "WhatsApp send pending Twilio template config" }` — actual Twilio send code added later; mirrors structure of `send-invoice-whatsapp`
- Toast on client: "Prescription uploaded. WhatsApp delivery will be enabled once Twilio template is configured."

## Client wiring (ProcedureDetailSheet.tsx)
- New `handleDownloadPrescription`: calls `generate-prescription-pdf`, decodes base64, triggers browser download
- New `handleSendWhatsApp`: calls `send-prescription-whatsapp`, shows toast
- Both buttons disabled while saving / when there's no patient or doctor selected
- Loading states with spinner icon

## Out of scope
- Real Twilio media message sending (placeholder edge function returns success but does not actually send; ready to be wired with Twilio template SID later)
- New DB columns for stored appointment/prescription numbers — deterministic IDs derived from UUIDs are sufficient until the user asks for real sequences
- Editing the template visually in the app (the PDF is generated server-side only)

## Files
- New: `supabase/functions/generate-prescription-pdf/index.ts`
- New: `supabase/functions/send-prescription-whatsapp/index.ts`
- Edit: `src/components/procedures/ProcedureDetailSheet.tsx` (two buttons + handlers)
- Edit: `src/pages/Procedures.tsx` (optional row-level Download button)
