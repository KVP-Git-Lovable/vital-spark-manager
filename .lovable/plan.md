## Problem

The "Creating…" button stays visible for several seconds after clicking **Create Invoice** because the create-invoice mutation's `onSuccess` handler does the following sequentially **before** closing the dialog:

1. Invokes `generate-invoice-pdf` edge function — fetches clinic + patient + services + products, builds the PDF with `pdf-lib`, uploads it to Storage. Typically 2–4s.
2. Invokes `send-invoice-whatsapp` edge function — calls Twilio API. Typically 1–2s.
3. Only then calls `resetForm()` / `setOpen(false)`.

Because TanStack Query keeps `mutation.isPending = true` until `onSuccess` resolves, the button label stays on "Creating…" for the full 3–6s round-trip even though the invoice itself is already saved.

## Goal

Close the dialog and clear the busy state **immediately** after the invoice row is written. Run PDF generation + WhatsApp delivery in the background and surface their result via toasts. No change to the resulting PDF or WhatsApp content.

## Plan

### 1. Make PDF + WhatsApp truly fire-and-forget on the client (`src/pages/Billing.tsx`)

In the `createInvoice` mutation's `onSuccess`:

- Move the PDF generation + WhatsApp invoke block into a separate async helper (e.g. `dispatchInvoiceWhatsApp(result)`).
- Call it **without `await`** (`void dispatchInvoiceWhatsApp(result)`).
- Run `resetForm()` and `setOpen(false)` synchronously right after queueing the background task, so the dialog closes the instant the DB insert completes.
- Inside the background helper, keep the existing toasts (`"WhatsApp invoice sent to patient"` / error log) so the user still gets feedback when delivery completes.
- Apply the same pattern to the recurring branch (`send-recurring-invoice-whatsapp`) and to `notifyInstallmentPaid`.

This single change removes the perceived wait without touching any backend logic.

### 2. Parallelise PDF generation and WhatsApp send

Today the WhatsApp call waits for the PDF URL. The current Twilio template builds the PDF link from `{{inf}}` (just the invoice number) — the PDF URL itself is **not** passed as a template variable. So we can fire both in parallel:

- Kick off `generate-invoice-pdf` and `send-invoice-whatsapp` with `Promise.allSettled([...])` inside the background helper.
- Drop `invoiceUrl` from the WhatsApp payload (it's already unused by the template; the `inf` variable resolves the PDF link on Twilio's side).
- Net effect: WhatsApp send is no longer gated on PDF rendering.

### 3. Background the PDF work inside the edge function

In `supabase/functions/generate-invoice-pdf/index.ts`:

- After loading the invoice row, respond `202 Accepted` immediately with `{ ok: true, queued: true }`.
- Wrap the PDF build + Storage upload + `invoices.pdf_url` update in `EdgeRuntime.waitUntil(...)` so it continues after the response is sent.
- The client already ignores the response body in the fire-and-forget path, so no client change needed beyond step 1.

This shortens the round-trip the browser experiences for the PDF call from ~3s to <300ms, and keeps the actual PDF generation reliable.

### 4. Verification

- Create a one-time invoice → dialog closes within ~1s of clicking Create; toasts for "Invoice created" appear immediately, "WhatsApp invoice sent" appears a couple of seconds later.
- Confirm in Storage that the PDF still appears and `invoices.pdf_url` is populated.
- Confirm WhatsApp message is received with the correct PDF link via the template.
- Repeat for: recurring plan creation (single WhatsApp) and installment marked Paid (`notifyInstallmentPaid`).

### Files touched

- `src/pages/Billing.tsx` — restructure `onSuccess` and `notifyInstallmentPaid` to fire-and-forget; parallelise PDF + WhatsApp calls.
- `supabase/functions/generate-invoice-pdf/index.ts` — early `202` response + `EdgeRuntime.waitUntil` for PDF build/upload.

No DB schema changes. No change to PDF layout or WhatsApp template.
