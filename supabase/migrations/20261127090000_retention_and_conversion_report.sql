-- Who consulted once and never came back, and how many patients ever have a
-- procedure.
--
-- Both questions span the whole history - 58,000 appointments and 39,000
-- procedures - so they are answered in the database and not in the browser.
-- The dashboard was recently found to have been counting the first 1,000 rows
-- of a client-side fetch and saying nothing about it; a report built the same
-- way would understate the clinic's own numbers just as quietly.
--
-- ── What counts ──
--
-- A CONSULTATION is an appointment whose service reads like one. The service
-- column is free text and the clinic writes "Consultation", "New Consult",
-- "Old Consult" and the same in lower case, so it is matched, not compared.
--
-- CANCELLED and NO SHOW never count, on either side: somebody who cancelled
-- did not consult, and a cancelled booking afterwards is not coming back.
--
-- A FIRST-TIME PATIENT is one whose earliest attended appointment of any kind
-- falls inside the window. An established patient who happened to come once
-- this year is not a lost new patient, and counting them as one would flatter
-- or damn the number depending on the window.
--
-- SECURITY DEFINER because the counts cross every patient row, which no
-- single staff member's RLS view is meant to span - so the function is gated
-- on is_active_staff() itself. Without that gate a definer function is a hole
-- straight through the policies.
create or replace function public.clinic_retention_conversion(
  p_from date,
  p_to date
)
returns table (
  patient_id uuid,
  patient_name text,
  phone text,
  consult_date date,
  doctor text,
  service text,
  had_procedure boolean,
  returned boolean,
  days_since integer,
  totals jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_totals jsonb;
  v_from timestamptz := (p_from::timestamp at time zone 'Asia/Kolkata');
  v_to   timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Kolkata');
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff may read clinic figures';
  end if;

  with attended as (
    select a.id, a.patient_id, a.start_time, a.service, a.doctor_name
      from public.appointments a
     where a.patient_id is not null
       and coalesce(a.status, '') not in ('Cancelled', 'No Show')
  ),
  -- Each patient's earliest attended visit, whenever it was.
  firsts as (
    select distinct on (f.patient_id) f.patient_id, f.id, f.start_time, f.service, f.doctor_name
      from attended f
     order by f.patient_id, f.start_time asc
  ),
  starters as (
    select fi.*
      from firsts fi
     -- IST midnight, not UTC midnight. A bare date::timestamptz is 05:30 in
     -- the clinic, so the window would start after the morning's first
     -- appointments and quietly drop them.
     where fi.start_time >= v_from
       and fi.start_time < v_to
       and fi.service ilike '%consult%'
  )
  select jsonb_build_object(
      'new_consult_patients', (select count(*) from starters),
      'never_returned', (
        select count(*) from starters s
         where not exists (select 1 from attended a
                            where a.patient_id = s.patient_id and a.start_time > s.start_time)),
      'never_returned_no_procedure', (
        select count(*) from starters s
         where not exists (select 1 from attended a
                            where a.patient_id = s.patient_id and a.start_time > s.start_time)
           and not exists (select 1 from public.procedures p where p.appointment_id = s.id)),
      'patients_on_file', (select count(*) from public.patients),
      'patients_attended', (select count(distinct a.patient_id) from attended a),
      'patients_with_procedure', (
        select count(distinct p.patient_id) from public.procedures p where p.patient_id is not null),
      'appointments', (select count(*) from attended),
      'appointments_with_procedure', (
        select count(*) from attended a
         where exists (select 1 from public.procedures p where p.appointment_id = a.id)),
      'procedures', (select count(*) from public.procedures),
      -- The honesty line. Two in five procedure rows carry no appointment,
      -- so the appointment-level rate above is a floor and the report says so.
      'procedures_unlinked', (select count(*) from public.procedures p where p.appointment_id is null),
      -- The second honesty line, and the sharper one. A consultation is
      -- recognised by the service written on the appointment, and that field
      -- has been left blank on a growing share of bookings - 79% of October
      -- 2026, 97% of November. Where it is blank nothing can be recognised,
      -- so a recent month is undercounted no matter how it is asked. The
      -- report prints this rather than showing a fall in new patients that
      -- is really a fall in record-keeping.
      'window_appointments', (
        select count(*) from attended a where a.start_time >= v_from and a.start_time < v_to),
      'window_appointments_no_service', (
        select count(*) from attended a
         where a.start_time >= v_from and a.start_time < v_to
           and coalesce(btrim(a.service), '') = '')
    )
    into v_totals;

  return query
  with attended as (
    select a.id, a.patient_id, a.start_time, a.service, a.doctor_name
      from public.appointments a
     where a.patient_id is not null
       and coalesce(a.status, '') not in ('Cancelled', 'No Show')
  ),
  firsts as (
    select distinct on (f.patient_id) f.patient_id, f.id, f.start_time, f.service, f.doctor_name
      from attended f
     order by f.patient_id, f.start_time asc
  ),
  starters as (
    select fi.*
      from firsts fi
     -- IST midnight, not UTC midnight. A bare date::timestamptz is 05:30 in
     -- the clinic, so the window would start after the morning's first
     -- appointments and quietly drop them.
     where fi.start_time >= v_from
       and fi.start_time < v_to
       and fi.service ilike '%consult%'
  )
  select
    s.patient_id,
    btrim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, '')) as patient_name,
    pt.phone,
    (s.start_time at time zone 'Asia/Kolkata')::date as consult_date,
    nullif(btrim(coalesce(s.doctor_name, '')), '') as doctor,
    s.service,
    exists (select 1 from public.procedures p where p.appointment_id = s.id) as had_procedure,
    exists (select 1 from attended a
             where a.patient_id = s.patient_id and a.start_time > s.start_time) as returned,
    (current_date - (s.start_time at time zone 'Asia/Kolkata')::date)::integer as days_since,
    v_totals
  from starters s
  left join public.patients pt on pt.id = s.patient_id
  order by s.start_time desc;
end;
$$;

comment on function public.clinic_retention_conversion(date, date) is
  'First-time patients whose first visit in the window was a consultation, with whether they ever returned, plus clinic-wide conversion totals. Staff only.';

revoke all on function public.clinic_retention_conversion(date, date) from public, anon;
grant execute on function public.clinic_retention_conversion(date, date) to authenticated;
