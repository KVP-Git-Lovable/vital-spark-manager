## Goal
Rewrite `supabase/functions/generate-prescription-pdf/index.ts` so the output mirrors the uploaded `PrescriptionPDFnew.pdf` template precisely.

## Reference layout (from uploaded PDF)
- **Full-page sage-green background** (`rgb(0.72, 0.84, 0.71)` approx) — not just a top band. The footer and entire content sit on this background.
- **Top-left header block**:
  - `THE SKIN CLINIC` — bold, ~16pt
  - `VYAS RAO LANE, KADRI KAMBALA ROAD, MANGALORE- 575003` — bold, ~10pt
  - Horizontal rule under header
- **Top-right**: white square panel containing the clinic logo (loaded from `clinic_settings.logo_url`; fallback to a placeholder "The Skin Clinic" text panel)
- **Doctor block (left, below header rule)**:
  - `Dr. {first} {last} {qualifications}` (e.g. `Dr. Vindhya Pai M.B.B.S. MD`)
  - `{role}` (e.g. `Dermatologist`)
  - `{phone}`
  - Each line prefixed with a small icon glyph (use unicode bullet/symbol since pdf-lib Helvetica only supports basic ascii — fallback to `•` or skip if not renderable). Will use simple text glyphs that render in Helvetica: `*`, `>`, `#` as low-key markers, OR omit icons and just indent — confirm choice below.
- **Top-right of same row**: `Prescription No: D-xxxx` and `Date: dd/mm/yyyy`
- **Centered title**: `Prescription Document` (~20pt, regular) with horizontal rule below
- **Patient info — 2 columns, 3 rows**:
  - Left: `Patient name`, `Phone No`, `Age`
  - Right: `Appointment No`, `Email id`, `Sex`
- **Body — 2 columns**:
  - Left col: `Prescription` (blue heading) + body text
  - Right col: `Symptoms` + body, `Diagnosis` + body, `Procedure Details` + body (each a blue heading)
  - Blue heading color ≈ `rgb(0.36, 0.55, 0.78)`
- **Footer (bottom of page, centered, on green bg)**:
  - `Clinic Phone: +91 6360 75 3030, 9620 12 3030 | Mob: +91 9845 39 3030`
  - `E-mail: theskinclinic30@gmail.com | Website: www.theskinclinic.org.in`

## Data mapping (no DB changes)
- Doctor name/qualifications/role/phone → `procedures.staff` join (already loaded)
- Patient name/phone/email/age/sex → `procedures.patients`
- Prescription body → joined `prescriptions` rows, fallback to `procedure_notes`/`recommendations`
- Symptoms → `procedures.symptoms` (fallback `consultation_notes`)
- Diagnosis → `procedures.diagnosis`
- **Procedure Details → `procedures.procedure_notes`** (new section in PDF; currently not rendered)
- Prescription No → `D-` + 4-digit deterministic hash of procedure id
- Appointment No → `A-` + 4-digit hash of `appointment_id || procedure.id`
- Date → `dd/mm/yyyy` from `procedure_date`
- Clinic name / phones / address / logo → `clinic_settings` (fallback to the hardcoded values from the template)

## Implementation steps
1. Replace `buildPrescriptionPdf` in `supabase/functions/generate-prescription-pdf/index.ts`:
   - Fill the entire page rect with sage green first.
   - Draw header (title + address + rule) and right-side white logo panel (~120×120 with logo image or fallback text).
   - Draw doctor block (left) and prescription/date block (right) under the rule.
   - Draw centered `Prescription Document` title and a horizontal rule.
   - Draw the patient 2×3 grid using a `drawKV(x, y, label, value)` helper with a fixed label column width so values align like in the template.
   - Draw the body 2-column section: compute left column width and right column width, render Prescription on the left; render Symptoms → Diagnosis → Procedure Details stacked on the right. Use the existing `wrap()` helper.
   - Draw the footer (two centered lines) ~30pt from the bottom.
2. Keep the existing `Deno.serve` entrypoint, `mode: "upload"` flow, audit insert, and base64 download response unchanged.
3. No changes to `send-prescription-whatsapp/index.ts` or any client code.

## Out of scope
- New DB columns; client UI changes; Twilio wiring; multi-page support (single A4 page only, matching the template).

## Files
- Edit: `supabase/functions/generate-prescription-pdf/index.ts`

## Open question
The uploaded template shows small icons (stethoscope / phone / logo thumbnail) next to the doctor lines. pdf-lib's standard Helvetica can't render those glyphs. Confirm: should I (a) omit the icons entirely (cleanest), or (b) use simple ASCII markers like `•`?
