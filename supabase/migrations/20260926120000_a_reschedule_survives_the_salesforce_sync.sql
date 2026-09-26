-- A morning of reschedules came back.
--
-- Dr Punya's Monday (28 Sep) patients were moved to other dates, and the list
-- kept showing them on Monday. At 16:17:13 IST on 26 Sep one write touched 107
-- appointments across four doctors, spanning appointment dates from Oct 2025 to
-- Oct 2026, and Punya's twenty Monday slots came back holding Salesforce's
-- original times.
--
-- The cause is sf-import-clinical's date-window refresh. syncPatient receives
-- refreshExisting = (mode === "recent"), and that branch overwrites start_time
-- and end_time straight from Billing/Appointment Start_Time__c for every
-- Salesforce-origin appointment in the window. mode=recent is what the
-- "Today / Last 7 days / Next 7 days / Next 30 days" buttons send. The
-- five-minute catch-up is not involved: it fires sf-import-clinical?limit=20
-- with no mode, so refreshExisting is false and it only inserts.
-- 20260922000000_count_a_visit_by_evidence.sql already warned about this for
-- status; it applies to the date just the same.
--
-- The importer runs as the service role, so auth.uid() is NULL for its writes -
-- confirmed against live data: all 186 Salesforce-inserted appointments since
-- 20 Sep have created_by NULL, while app_edited_at is set on exactly the rows
-- that carry an updated_by. That is the only reliable way to tell the importer
-- from a person, so it is what this guard turns on.
--
-- Replacing the function body rather than adding a trigger is deliberate:
-- CREATE TRIGGER needs ACCESS EXCLUSIVE on appointments and has timed out
-- against the sync before. CREATE OR REPLACE FUNCTION takes no table lock.
--
-- Only start_time and end_time are protected. Status is written by check-in,
-- completion, cancellation and the paid-invoice trigger, and freezing those
-- would break the day's workflow to fix a problem nobody reported.

create or replace function public.stamp_appointment_app_edit()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    -- A person, working in the app. From now on this appointment is the
    -- clinic's own version of the truth.
    NEW.app_edited_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- No signed-in user, so this is the Salesforce importer. It may still fill in
  -- an appointment nobody has touched, but once a person has moved one,
  -- Salesforce's old time must not come back over it.
  IF OLD.app_edited_at IS NOT NULL THEN
    NEW.start_time := OLD.start_time;
    NEW.end_time   := OLD.end_time;
  END IF;

  RETURN NEW;
END;
$function$;
