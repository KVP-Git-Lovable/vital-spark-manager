-- Clear visit types out of procedures.service_name.
--
-- The Salesforce import used to fall back to Diagnosis__c.Type_Of_Appointment__c
-- when no treatment had been recorded yet, so the Procedures list showed
-- "Walk-In" (a visit type) in its Service column. sf-import-clinical no longer
-- does that; this fixes the rows already imported.
--
-- NOTHING IS LOST. The same value is stored verbatim in review_notes as
-- "Type: <value>" (and/or "Visit Type: <value>"), which this does not touch - so
-- the original is still readable on every row afterwards, and this is reversible.
--
-- A row is only changed when its service_name is PROVABLY the visit type that
-- came from Salesforce: it must appear in that row's own review_notes as
-- "Type: <exactly this value>". A real service name can never satisfy that, so
-- anything genuinely recorded - imported or typed into the app - is left alone.

BEGIN;

-- What would change, for the record. Run the SELECT below on its own first if
-- you want to see the blast radius before committing.
CREATE TEMP TABLE proc_svc_fix ON COMMIT DROP AS
SELECT p.id, p.service_name AS old_service_name
  FROM public.procedures p
 WHERE p.sf_id IS NOT NULL
   AND p.service_name IS NOT NULL
   AND btrim(p.service_name) <> ''
   AND p.review_notes IS NOT NULL
   -- The value is recorded as a visit type on this very row.
   AND position('Type: ' || btrim(p.service_name) IN p.review_notes) > 0
   -- ...and is not itself a service the clinic offers.
   AND NOT EXISTS (
     SELECT 1 FROM public.services s
      WHERE lower(btrim(s.name)) = lower(btrim(p.service_name))
   );

UPDATE public.procedures p
   SET service_name = 'Consultation'
  FROM proc_svc_fix f
 WHERE p.id = f.id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Preview, read-only. Run this BEFORE the migration to see what it would touch.
--
-- SELECT p.service_name AS current_value, count(*) AS rows
--   FROM public.procedures p
--  WHERE p.sf_id IS NOT NULL
--    AND p.service_name IS NOT NULL
--    AND btrim(p.service_name) <> ''
--    AND p.review_notes IS NOT NULL
--    AND position('Type: ' || btrim(p.service_name) IN p.review_notes) > 0
--    AND NOT EXISTS (
--      SELECT 1 FROM public.services s
--       WHERE lower(btrim(s.name)) = lower(btrim(p.service_name))
--    )
--  GROUP BY 1
--  ORDER BY 2 DESC;
