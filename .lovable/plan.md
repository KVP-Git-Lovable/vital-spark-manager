# Invoice PDF — Match The Skin Clinic Template

## Goal
Replace the current generic invoice PDF with a faithful reproduction of the attached clinic template, sourcing every field dynamically. The same template applies to one-time invoices, recurring installment invoices, and pharmacy bills, since all three already write to the `invoices` table.

## New PDF Layout (single edge function: `generate-invoice-pdf`)

```text
┌───────────────────────────────────────────────────────────────┐
│ [Clinic Logo]                                                 │
│                                                               │
│ Patient Name: <first last>            Patient ID: P-xxxx      │
│ Age/Sex: <age>/<gender>               Billing ID: <inv #>     │
│ Mobile Number: <phone>                Dr/Ref.By: Dr. <name>   │
│ Date: dd/mm/yyyy                      GST No: <clinic GST>    │
│                                                               │
│ Billing Line Items:                                           │
│ ┌────┬───────────────┬────────┬─────┬────┬────┬────┬───┬────┬────┐
│ │Sl. │ Particulars   │Charges │HSN  │SGST│CGST│GST │Qty│Tax │Amt │
│ ├────┼───────────────┼────────┼─────┼────┼────┼────┼───┼────┼────┤
│ │ 1  │ Consultation  │INR ... │9993 │ x  │ x  │ x  │ 1 │... │... │
│ ├────┴───────────────┴────────┴─────┴────┴────┴────┴───┼────┼────┤
│ │                                       Total Billed   │    │INR │
│ │                                       Total Paid     │    │INR │
│ ├──────────────────┬───────────────────────────────────┴────┴────┤
│ │ Amount in words  │ <number-to-words> Rupees Only                │
│ │ Mode of payment  │ Cash / UPI / Card / Split summary            │
│ └──────────────────┴──────────────────────────────────────────────┘
│                                                                   │
│                                       Authorized Signatory       │
│                                                                   │
│                       ----------------                            │
│        <Clinic name>, <address>, <city>, <pincode>                │
│        Website: <derived from clinic email domain or static>      │
│                                                                   │
│ For appointments and emergency care, contact us @ <clinic phone>  │
└───────────────────────────────────────────────────────────────────┘
```

## Dynamic Data Sources

| Field | Source |
|---|---|
| Logo | `clinic_settings.logo_url` (fetched by service role + embedded into PDF) |
| Clinic name / address / city / pincode / phone / GST | `clinic_settings.*` |
| Patient name, gender, DOB (→age), phone | `patients` joined via `invoices.patient_id` |
| Patient ID | short code from `patients.id` (existing P-xxxx convention if present, else last 4 of UUID) |
| Billing ID | `invoices.invoice_number` |
| Date | `invoices.created_at` (dd/mm/yyyy, IST) |
| Dr/Ref.By | doctor on linked `appointments` row (if `appointment_id`) → staff name |
| Line items | parse `invoices.services[]` (existing convention `Name` or `Name xN`); look up `services` and `pharma_products` for unit price, `hsn_code`, `gst_percent` |
| SGST/CGST | split clinic-vs-patient state: same state → CGST=SGST=gst/2; otherwise IGST shown in GST column |
| Tax amount per line | charges × qty × gst% |
| Total Billed | `invoices.total_amount` |
| Total Paid | `invoices.paid_amount` |
| Amount in words | computed from Total Billed (Indian numbering) |
| Mode of payment | `invoices.payment_mode` + summary of `payment_splits` if present |

## Scope of Changes

1. **`supabase/functions/generate-invoice-pdf/index.ts`** — full rewrite of the PDF rendering using `pdf-lib`:
   - Fetch `clinic_settings` (single row), patient row, optional appointment+staff for doctor.
   - Embed logo image (PNG/JPG) downloaded from `logo_url`.
   - Render header grid, line-items table with the 10 columns above, totals rows, footer.
   - Add Indian number-to-words helper (lakhs/crores).
   - Keep current upload-to-`invoices` storage bucket + cache `pdf_url` behavior unchanged.
   - Keep CORS + service-role usage as today.

2. **No client changes required for coverage**:
   - One-time invoices already call `generate-invoice-pdf` (Billing.tsx).
   - Recurring installments are `invoices` rows — same function works; we'll add a "Generate PDF" affordance from the recurring detail row using the same call. (Already wired through existing PDF buttons in the invoice list.)
   - Pharmacy bills (`payment_type = 'Pharmacy'` / pharma sales) write to `invoices` with `services` like `Product x2`; the same function renders them, picking HSN + GST from `pharma_products`.

3. **WhatsApp-sendable**: existing `send-invoice-whatsapp` template already sends the `pdf_url` link. No change needed; once `generate-invoice-pdf` returns the new URL, WhatsApp messages link to the new template automatically.

## Out of Scope
- No schema changes.
- No UI/visual changes in the app itself.
- No new buckets, no new secrets.

## Technical Notes
- pdf-lib supports embedding JPEG/PNG; if `logo_url` is SVG or unavailable, fall back to clinic name as text header.
- "Patient ID" display: use existing convention if a `patient_code` column exists; otherwise derive a stable short ID from UUID (`P-` + last 4 hex). No DB change.
- Website line: render `clinic_settings.email`'s domain or a configurable static line (`www.theskinclinic.org.in`-style). We'll pull from `clinic_settings.email` domain and prefix `www.` for now; if blank, omit.
- Robust fallbacks for missing GST / HSN per line (show 0.00 like the sample).
