## Goal
Fix `supabase/functions/generate-prescription-pdf/index.ts` to match the uploaded template: white header band, sage-green body, doctor name/qualifications populated, butterfly logo top-right.

## Changes

1. **Background split**
   - Remove the full-page sage fill.
   - Draw a **white header band** from `y = height - 170` to `y = height` across full page width.
   - Draw a **sage green band** (`rgb(0.784, 0.847, 0.784)` ≈ `#C8D8C8`) from `y = 0` up to `y = height - 170` covering the rest of the page (including footer area).

2. **Logo top-right (in white header)**
   - Replace the 130×130 white panel with a transparent logo placement: fetch `clinic_settings.logo_url`, embed (png/jpg), and draw scaled-to-fit ~90×90 at top-right of the header band (`x = width - M - 90`, vertically centered in header).
   - Fallback: small "The Skin Clinic" text if no logo.

3. **Doctor name fix**
   - Current bug: `staff.first_name` / `staff.last_name` come back empty because `staff` table uses `full_name` (verify via schema). Update select to alias and read whichever fields exist:
     - Pull `staff.full_name` first; fallback to `${first_name} ${last_name}`.
     - Pull `staff.qualifications` (string or array — join if array).
     - Pull `staff.specialization` for the role line, fallback to `staff.role` or `"Dermatologist"`.
     - Pull `staff.phone` / `staff.contact_number`.
   - Render `Dr. {name} {qualifications}` in bold; role and phone underneath, all in dark text inside the white header.

4. **Header layout (white band)**
   - Top-left: `THE SKIN CLINIC` (16pt bold) + address (10pt bold).
   - Thin horizontal rule across header width.
   - Below rule (still inside white band): doctor block (left) + `Prescription No` / `Date` (right of doctor, left of logo).
   - Logo sits top-right inside the white band, vertically spanning header height.

5. **Body (sage green)**
   - `Prescription Document` centered title sits **on the sage area**, just below the white header, with blue rule.
   - Patient 2×3 grid, then 2-column body (Prescription | Symptoms/Diagnosis/Procedure Details) — unchanged layout, drawn on sage.
   - Footer text (phone, email, website) centered at bottom on sage.

6. **Verification step**
   - Confirm `staff` table column names via `supabase--read_query` before finalizing the field mapping (avoid another empty-name bug).

## Files
- Edit: `supabase/functions/generate-prescription-pdf/index.ts`

## Out of scope
- DB schema changes, client UI, Twilio wiring.
