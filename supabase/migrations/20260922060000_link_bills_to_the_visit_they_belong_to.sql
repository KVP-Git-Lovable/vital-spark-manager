-- Put the bill back on the visit it was raised at.
--
-- The clinic reported 21 September reading as a day of appointments with almost
-- no Bill Amounts. Nothing was missing: Reports gave the day as Rs 1,66,323
-- against Salesforce's Rs 1,66,322, and the date-window sync's own
-- reconciliation found no Salesforce bill absent here. The money is all present
-- and correct in every total.
--
-- What is wrong is the link. The Appointments list reads its Bill Amount column
-- strictly by invoices.appointment_id, so an invoice carrying no link renders as
-- a dash even though it exists. That column is written only at import, from
-- Billing__c.Appointment__c - and Salesforce leaves that blank on some bills,
-- after which nothing ever fills it in.
--
-- So: where Salesforce named no appointment, adopt the patient's own appointment
-- on the day the bill was raised - but ONLY where there is exactly one candidate
-- on each side. With two visits in a day there is no way to tell which was
-- billed, and a wrong link is worse than a dash, because the visit rule
-- (20260922000000_count_a_visit_by_evidence.sql) counts a past appointment
-- carrying a paid invoice as an attended visit.
--
-- Days are compared in Asia/Kolkata. The columns are timestamptz and IST runs
-- 5.5 hours ahead of UTC, so an evening visit compared on UTC days would fall on
-- the day before and miss its own bill.
--
-- No amount is read or written. total_amount, paid_amount, tax and line_items
-- are untouched, so no figure on any report or invoice moves - only which row
-- the Appointments list can find the bill from.
--
-- billAppointment.ts applies the same rule to bills arriving from now on.

BEGIN;

-- Reversible: every invoice this touches, as it was.
CREATE TABLE IF NOT EXISTS public.invoice_appointment_backup_20260922 (
  id uuid PRIMARY KEY,
  appointment_id uuid,
  captured_at timestamptz NOT NULL DEFAULT now()
);

-- Candidates: an imported bill with no link, and the patient's appointments on
-- the same clinic day.
CREATE TEMP TABLE pending_links ON COMMIT DROP AS
SELECT i.id AS invoice_id,
       a.id AS appointment_id
  FROM public.invoices i
  JOIN public.appointments a
    ON a.patient_id = i.patient_id
   AND (a.start_time AT TIME ZONE 'Asia/Kolkata')::date
     = (i.created_at AT TIME ZONE 'Asia/Kolkata')::date
 WHERE i.appointment_id IS NULL
   AND i.sf_id IS NOT NULL
   AND i.patient_id IS NOT NULL;

-- Unambiguous on both sides: one appointment for the invoice, and one such
-- invoice for the appointment. Anything else is left exactly as it is.
CREATE TEMP TABLE confirmed_links ON COMMIT DROP AS
SELECT invoice_id, appointment_id
  FROM pending_links
 WHERE invoice_id IN (
         SELECT invoice_id FROM pending_links GROUP BY invoice_id HAVING count(*) = 1)
   AND appointment_id IN (
         SELECT appointment_id FROM pending_links GROUP BY appointment_id HAVING count(*) = 1);

INSERT INTO public.invoice_appointment_backup_20260922 (id, appointment_id)
SELECT i.id, i.appointment_id
  FROM public.invoices i
  JOIN confirmed_links c ON c.invoice_id = i.id
    ON CONFLICT (id) DO NOTHING;

UPDATE public.invoices i
   SET appointment_id = c.appointment_id
  FROM confirmed_links c
 WHERE i.id = c.invoice_id;

-- The visit rule credits a past appointment carrying a paid invoice, so linking
-- a bill can legitimately raise a patient's visit count. Recompute it rather
-- than leave a clinical figure drifting: writing total_visits makes the guard
-- trigger (20260922010000_guard_the_visit_rollups.sql) derive the true value.
UPDATE public.patients p
   SET total_visits = -1
 WHERE p.id IN (
   SELECT i.patient_id
     FROM public.invoices i
     JOIN confirmed_links c ON c.invoice_id = i.id);

COMMIT;
