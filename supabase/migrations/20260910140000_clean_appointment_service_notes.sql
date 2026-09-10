-- Clean clinical notes out of appointments.service.
--
-- The Salesforce import mapped Investigation__c (free clinical text) straight into
-- appointments.service, so the Service column on the appointments list reads things
-- like "3rx Face HR (LTB for fine hair was done) last session 1/6/2026 (Informed the
-- Patient That Dr Vindhya Pai will not be available)".
--
-- sf-import-clinical now resolves that text against the services master before
-- storing it. This backfills the rows imported before that change, using the same
-- rule: the longest service name appearing in the text as a whole word, else
-- "Consultation".
--
-- Only Salesforce-sourced rows whose service is not already a real service name are
-- touched. Anything booked in the app is left completely alone.

-- One transaction throughout: the temp table below is ON COMMIT DROP, and step 1
-- must not be able to commit without step 2 (that would leave the note duplicated
-- into reason_for_consultation while service still holds it).
BEGIN;

-- Normalises the way the importer's normalize() does: lowercase, strip anything that
-- is not a letter/digit/space, collapse runs of spaces. Padding with single spaces on
-- both sides lets a plain position check act as a word-boundary test, so a short
-- service name like "HR" cannot match inside "hydra".
CREATE OR REPLACE FUNCTION pg_temp.norm(_s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT ' ' || btrim(regexp_replace(regexp_replace(lower(coalesce(_s, '')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) || ' ';
$$;

-- The rows in scope, and what each would become. Kept as a temp table so the two
-- updates below agree on the target set even though the first one changes a column
-- the second reads.
CREATE TEMP TABLE svc_fix ON COMMIT DROP AS
SELECT
  a.id,
  a.service                        AS old_service,
  a.reason_for_consultation        AS old_reason,
  COALESCE(m.name, 'Consultation') AS new_service
FROM public.appointments a
LEFT JOIN LATERAL (
  SELECT s.name
    FROM public.services s
   WHERE length(pg_temp.norm(s.name)) > 3                       -- ' xx ' - two chars minimum
     AND position(pg_temp.norm(s.name) IN pg_temp.norm(a.service)) > 0
   ORDER BY length(pg_temp.norm(s.name)) DESC
   LIMIT 1
) m ON true
WHERE a.source = 'salesforce'
  AND a.service IS NOT NULL
  AND btrim(a.service) <> ''
  -- "dirty" = the value is not itself a service name. This is what makes the
  -- migration idempotent: once fixed, a row no longer qualifies.
  AND NOT EXISTS (
    SELECT 1 FROM public.services s2
     WHERE pg_temp.norm(s2.name) = pg_temp.norm(a.service)
  );

-- 1. Preserve the text before overwriting it. Most rows already carry it (the import
--    also wrote Investigation__c to reason_for_consultation), so this only catches
--    the ones sourced from Description__c, where service is its only home.
UPDATE public.appointments a
   SET reason_for_consultation = f.old_service
  FROM svc_fix f
 WHERE a.id = f.id
   AND (a.reason_for_consultation IS NULL OR btrim(a.reason_for_consultation) = '');

-- 2. Then replace the service.
UPDATE public.appointments a
   SET service = f.new_service
  FROM svc_fix f
 WHERE a.id = f.id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Preview, for running BEFORE the migration to see the blast radius. Read-only.
--
-- BEGIN;
-- CREATE OR REPLACE FUNCTION pg_temp.norm(_s text)
-- RETURNS text LANGUAGE sql IMMUTABLE AS $$
--   SELECT ' ' || btrim(regexp_replace(regexp_replace(lower(coalesce(_s, '')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) || ' ';
-- $$;
-- SELECT COALESCE(m.name, 'Consultation') AS new_service, count(*) AS rows,
--        min(a.service) AS example_old_value
--   FROM public.appointments a
--   LEFT JOIN LATERAL (
--     SELECT s.name FROM public.services s
--      WHERE length(pg_temp.norm(s.name)) > 3
--        AND position(pg_temp.norm(s.name) IN pg_temp.norm(a.service)) > 0
--      ORDER BY length(pg_temp.norm(s.name)) DESC LIMIT 1
--   ) m ON true
--  WHERE a.source = 'salesforce' AND a.service IS NOT NULL AND btrim(a.service) <> ''
--    AND NOT EXISTS (SELECT 1 FROM public.services s2 WHERE pg_temp.norm(s2.name) = pg_temp.norm(a.service))
--  GROUP BY 1 ORDER BY 2 DESC;
-- ROLLBACK;
