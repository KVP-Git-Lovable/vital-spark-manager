-- Salesforce always refers to this doctor as "Punya Suvarna", but her
-- staff record here is filed under a different surname ("Dr. Punya
-- Manglore") - so the sync's doctor-name matching (which requires the
-- surname to match too) silently failed for every one of her records.
-- Confirmed with the clinic that these are the same person.
--
-- This backfills the ~12,400 already-imported appointments/invoices that
-- were left without a doctor because of this, then re-applies the
-- appointment -> procedure staff_id backfill so procedures pick it up too.
--
-- Safe to re-run: every WHERE clause only touches rows that are still
-- unset, so a second run is a no-op.
--
-- Preview (read-only, safe to run anytime) - confirm the row counts below
-- look right before running the UPDATEs:
--
-- SELECT count(*) AS appointments_to_fix FROM public.appointments
-- WHERE staff_id IS NULL AND reason_for_consultation ~* '\(dr[^)]*punya\b';
--
-- SELECT count(*) AS invoices_to_fix FROM public.invoices
-- WHERE doctor_id IS NULL AND notes ~* '^doctor:\s*dr\.?\s+punya\b';

BEGIN;

-- reason_for_consultation wraps the raw Salesforce value (which often
-- already starts with its own "Dr"/"DR.") inside a literal "(Dr. ...)" -
-- e.g. "(Dr. Dr PUNYA SUVARNA)" - so match loosely within the parens
-- rather than anchoring right after "(Dr. ".
UPDATE public.appointments
SET staff_id = '7017b1e5-434d-422d-92ec-1ae4fd941426'
WHERE staff_id IS NULL
  AND reason_for_consultation ~* '\(dr[^)]*punya\b';

UPDATE public.invoices
SET doctor_id = '7017b1e5-434d-422d-92ec-1ae4fd941426'
WHERE doctor_id IS NULL
  AND notes ~* '^doctor:\s*dr\.?\s+punya\b';

-- Re-run: some procedures' linked appointments were just fixed above.
UPDATE public.procedures p
SET staff_id = a.staff_id
FROM public.appointments a
WHERE p.appointment_id = a.id
  AND p.staff_id IS NULL
  AND a.staff_id IS NOT NULL;

COMMIT;
