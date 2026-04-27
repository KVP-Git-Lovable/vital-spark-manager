## Issue 1: Invoice not appearing in Billing list

**Root cause:** The `invoices` query in `src/pages/Billing.tsx` (line 241) joins:
```ts
.select("*, appointments(id, service, start_time, staff_id, doctors:staff_id(name))")
```

The `staff` table has no `name` column — only `first_name` and `last_name`. Postgres returns `42703 column staff_2.name does not exist`, so the **entire invoice list fails** and renders "No invoices found", even though your invoice (`INV-151546`, ₹5,763.60) is correctly saved in the DB.

**Fix:** Change the select to use `first_name, last_name` (matching the pattern used elsewhere like Appointments):
```ts
.select("*, appointments(id, service, start_time, staff_id, doctors:staff_id(first_name, last_name))")
```
And update any place in Billing.tsx that reads `inv.appointments?.doctors?.name` to derive it from `first_name + last_name`.

---

## Issue 2: Where invoices are saved

Invoices are saved in the **`public.invoices`** table in Lovable Cloud (your backend database). Each row stores: `invoice_number`, `patient_id`, `patient_name`, `services`, `total_amount`, `paid_amount`, `tax_amount`, `cgst_amount`, `sgst_amount`, `igst_amount`, `status`, `payment_type`, `payment_mode`, `notes`, `created_at`. There is no separate file/PDF storage — the PDF in `Billing.tsx` is generated on-demand for printing.

---

## Issue 3: Send invoice details to patient on WhatsApp

Reuse the existing Twilio plumbing pattern from `send-appointment-whatsapp`.

### A. New Twilio template (you need to create this in Twilio Console)
You'll need a WhatsApp template SID with variables for:
- `{{1}}` Patient name
- `{{2}}` Invoice number
- `{{3}}` Total amount (₹)
- `{{4}}` Amount paid
- `{{5}}` Balance due
- `{{6}}` Status (Paid / Partial / Pending)

**Question for you:** Please provide the new Twilio Content Template SID for invoice notifications (e.g. `HX...`). If you don't have one yet, I can stub the SID via a `TWILIO_INVOICE_TEMPLATE_SID` secret you fill in later, and the function will simply skip sending until the secret is set.

### B. New edge function: `send-invoice-whatsapp`
- Accepts `{ patientId, invoiceNumber, totalAmount, paidAmount, status }`.
- Looks up patient phone from `patients` table.
- Normalizes phone to E.164 (default +91, same helper as appointment function).
- Calls Twilio `Messages.json` with `ContentSid` + `ContentVariables` JSON.
- Returns `{ ok: true, sid }` or logs failure (never throws to caller).
- `verify_jwt = false` in `supabase/config.toml`.

### C. Wire into Billing.tsx `createInvoice` mutation
In the `onSuccess` handler (line 569) of `createInvoice`:
- For **One-time**: send 1 WhatsApp with the invoice details.
- For **Staged**: send 1 summary message for the first stage (avoid spamming).
- For **Recurring**: send 1 summary covering installment plan (count × amount).
- Skip silently if `patientId` is empty or patient has no phone.
- Show toast `"WhatsApp invoice sent"` on success; never block the success flow if WhatsApp fails.

### D. No DB migration required
All needed data (`patient_id`, `patient_name`, `total_amount`, `paid_amount`, `status`, `invoice_number`) already exists on `invoices` and `patients`.

---

## Summary of files to change
1. `src/pages/Billing.tsx` — fix join (`name` → `first_name, last_name`), update display, invoke new edge function in `onSuccess`.
2. `supabase/functions/send-invoice-whatsapp/index.ts` — new function (Twilio API call).
3. `supabase/config.toml` — register new function with `verify_jwt = false`.
4. Add secret: `TWILIO_INVOICE_TEMPLATE_SID` (you provide the SID from Twilio Console).

Please share the **invoice template SID** (or confirm you'd like me to add a placeholder secret you'll fill later), then approve to implement.