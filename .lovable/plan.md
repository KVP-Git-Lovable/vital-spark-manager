## Goal
Fix invoice service charges, ensure consistent Patient ID, add HSN per service line, and add doctor selection with auto-added consultation fee. All visible in the invoice PDF.

## 1. Service charges show "—" on PDF

**Cause**: Invoice rows store services as plain strings (`"Service Name xN"`). The PDF function looks up price from `services` master, but the `services` table has no `price` lookup match when the saved name has been edited, or when an ad-hoc service was used. Also the legacy `generateInvoicePDF` browser print fallback prints `—`.

**Fix**:
- In `supabase/functions/generate-invoice-pdf/index.ts`: when a service line cannot be matched in `services` master (no `price`), fall back to deriving per-unit charge from the invoice's stored line price. To enable this, also start persisting per-line price/hsn into a new `invoice_line_items` JSONB column on `invoices` so PDF generation no longer guesses.
- Migration: add `invoices.line_items jsonb` (array of `{ name, qty, price, hsn, gst, doctor_fee?: bool }`). Keep existing `services text[]` for backward compatibility.
- `Billing.tsx` writes `line_items` on insert/update.
- PDF reads `line_items` first; falls back to old logic if absent.

## 2. Patient ID consistency

User confirmed: keep `P-XXXXX` (last-5 of UUID).
- Display the same `P-XXXXX` in **Patient Detail** header (next to name) and in the **Patients** list, so the value on the PDF matches what staff see in the profile. No schema change.
- Helper added in `src/lib/utils.ts`: `shortPatientId(uuid)` mirroring the edge function's logic.

## 3. HSN Code per service line

- Migration: `ALTER TABLE services ADD COLUMN hsn_code text, ADD COLUMN gst_percent numeric DEFAULT 0;` (PDF function already references these but they don't exist).
- `src/pages/Services.tsx`: add HSN Code input (optional) and GST% input in the service form & list.
- `Billing.tsx` Create Invoice → each service row gets an optional `HSN` text input (auto-populated from Service Master when a service is picked, editable).
- HSN flows into `invoice_line_items` and prints in the existing HSN column.

## 4. Doctor dropdown + Consultation Fee

- Migration: `ALTER TABLE staff ADD COLUMN consultation_fee numeric DEFAULT 0;`
- `src/pages/StaffManagement.tsx` + `src/pages/StaffDetail.tsx`: add **Consultation Fee (₹)** field in the staff form (Doctor role only — but field shown for all, default 0).
- `Billing.tsx` Create Invoice form: add **Doctor** dropdown after Patient (filtered to `staff` where `role = 'Doctor'` and `is_active`). On selection:
  - Auto-insert/update a line item: `"Consultation - Dr. <Name>"` with charge = `consultation_fee`, qty 1, marked `doctor_fee: true`. Re-selecting a different doctor replaces it.
  - Persist `doctor_id` on the invoice (new nullable column `invoices.doctor_id uuid references staff(id)`).
- PDF: `Dr/Ref.By` field reads `invoices.doctor_id → staff` first, falls back to current appointment-based lookup.

## 5. PDF reflects everything

- `generate-invoice-pdf/index.ts` updated to:
  - Prefer `inv.line_items` for Particulars / Charges / HSN / GST / Qty / Tax / Amount.
  - Resolve doctor name from `inv.doctor_id` when set.
  - Keep existing layout (header, table, totals, amount-in-words, mode of payment, footer) — **no visual redesign**.
- Legacy in-browser `generateInvoicePDF()` fallback in `Billing.tsx` updated to print real charges instead of `—` (uses `line_items`).

## Technical summary

Files:
- `supabase/migrations/<new>.sql` — `invoices.line_items jsonb`, `invoices.doctor_id uuid`, `services.hsn_code text`, `services.gst_percent numeric`, `staff.consultation_fee numeric`.
- `supabase/functions/generate-invoice-pdf/index.ts` — read `line_items` and `doctor_id`; fallback chain preserved.
- `src/pages/Billing.tsx` — Doctor dropdown, HSN input per service line, persist `line_items` + `doctor_id`, auto-add consultation fee row.
- `src/pages/Services.tsx` — HSN + GST% inputs.
- `src/pages/StaffManagement.tsx` (+ `StaffDetail.tsx` if it has its own form) — Consultation Fee input.
- `src/pages/PatientDetail.tsx`, `src/pages/Patients.tsx` — show `P-XXXXX` next to patient name.
- `src/lib/utils.ts` — `shortPatientId` helper.

No visual redesign of the PDF; only data plumbing and three new form fields.