## Goal
Create a **public storage bucket for invoice PDFs** so each generated invoice has a permanent, shareable URL that can be passed as a variable into a Twilio WhatsApp template (e.g. `{{7}}` invoice link, or a Media template using the URL as the header media).

## Current state
- Invoices live in `public.invoices`.
- The PDF in `Billing.tsx` is generated **only in the browser** via `window.print()` — there is no PDF file anywhere; nothing to link to.
- WhatsApp invoice notifications already go out via `send-invoice-whatsapp` with text variables but no link/attachment.

To send a real link, we need: (1) a public bucket, (2) a server-side PDF generator that uploads to the bucket, (3) the public URL appended to the WhatsApp call.

---

## Step 1 — Create public storage bucket `invoices`
Migration:
```sql
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do update set public = true;

-- Public read of all invoice PDFs (so Twilio/WhatsApp can fetch the link)
create policy "Public can read invoice pdfs"
on storage.objects for select
to public
using (bucket_id = 'invoices');

-- Authenticated users / service role can upload
create policy "Authenticated can upload invoice pdfs"
on storage.objects for insert
to authenticated
with check (bucket_id = 'invoices');

create policy "Service role can manage invoice pdfs"
on storage.objects for all
to service_role
using (bucket_id = 'invoices')
with check (bucket_id = 'invoices');
```
Files will be stored as `invoices/{invoice_number}.pdf` and exposed at:
`https://brdrkhgfbbrgdkzdfbpr.supabase.co/storage/v1/object/public/invoices/{invoice_number}.pdf`

> Note: a public bucket means **anyone with the URL can read the PDF**. Invoice numbers are sequential-ish, so URLs are guessable. If you want privacy, say so and I'll switch to a **private bucket with signed URLs (7-day expiry)** instead — recommended for medical billing. Default below is **public** as you asked.

## Step 2 — New edge function `generate-invoice-pdf`
- Accepts the same invoice payload the UI uses today (or just `invoice_id` and re-queries).
- Renders the existing HTML template (lifted out of `Billing.tsx` into `supabase/functions/_shared/invoice-template.ts` so client + server share it).
- Converts HTML → PDF using a Deno-compatible renderer (e.g. `@sparticuz/chromium` is too heavy for edge — instead use the lightweight `https://deno.land/x/pdfkit` or, more reliably, call a hosted HTML-to-PDF service). Recommended approach: use **`pdf-lib`** to compose a clean PDF directly from invoice fields (no headless browser needed, fast, deno-friendly).
- Uploads to `invoices/{invoice_number}.pdf` (upsert: true) using the service role key.
- Returns `{ url, path }`.

Optional column on `public.invoices`: `pdf_url text` to cache the URL (cheap and avoids re-generating). Migration adds this nullable column.

## Step 3 — Update `send-invoice-whatsapp`
- Before sending, call `generate-invoice-pdf` (or use `invoices.pdf_url` if already set) to obtain `pdfUrl`.
- Pass the URL as **`{{7}}` ContentVariable** in the existing template, OR — preferred — switch to a **WhatsApp Media template** where the public PDF URL becomes the header media (`type: document`).
- I'll need from you: the **new template SID** that includes a document header (or a 7th text variable for the link). If you don't have one yet, I'll temporarily append the link to the message body and you can swap in the template SID later via the existing `TWILIO_INVOICE_TEMPLATE_SID` secret.

## Step 4 — Wire it into `Billing.tsx`
- After `createInvoice` succeeds, call `generate-invoice-pdf` (fire-and-forget; show toast on success) so the PDF exists at the public URL before/just as the WhatsApp message is sent.
- Add a small "Copy invoice link" / "Open PDF" action next to the existing Download button in the invoice list and detail sheet, using `invoices.pdf_url`.

## Step 5 — Backfill (optional)
A one-time button in Billing (admin only) to regenerate PDFs for old invoices that don't yet have a `pdf_url`. Skipped unless you want it.

---

## Files to change
1. **Migration**: create `invoices` bucket + storage policies, add `invoices.pdf_url` column.
2. **New**: `supabase/functions/_shared/invoice-template.ts` (shared HTML/PDF builder).
3. **New**: `supabase/functions/generate-invoice-pdf/index.ts` (renders + uploads, returns public URL).
4. **Update**: `supabase/functions/send-invoice-whatsapp/index.ts` to fetch/generate the URL and include it in the Twilio call.
5. **Update**: `supabase/config.toml` to register the new function with `verify_jwt = false`.
6. **Update**: `src/pages/Billing.tsx` to invoke `generate-invoice-pdf` post-create and surface the link in the UI.

---

## Decisions I need from you before implementing
1. **Privacy**: keep bucket **public** (any link-holder can view) or switch to **private with signed URLs** (more secure, link expires)? Default = public per your request.
2. **Twilio template**: do you have a template SID with a **document header** (preferred for sending a PDF), or should I add the link as a 7th text variable on your existing template (you'd need to update the template body to include `{{7}}`)?

Approve to proceed (default: public bucket + add link as text in fallback body until you provide an updated template SID).