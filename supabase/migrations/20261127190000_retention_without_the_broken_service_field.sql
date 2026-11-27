-- The retention report stops depending on a field the clinic stopped filling.
--
-- Two things made the first version hard to read, and both are fixed here.
--
-- ── 1. It recognised a consultation by free text ──
--
-- `starters` required `service ilike '%consult%'`. But appointments.service is
-- blank on 79% of October 2026 bookings and 97% of November's, so those months
-- showed almost no new patients - a collapse in record-keeping reading as a
-- collapse in business. A first-time patient is now simply anyone whose
-- earliest attended visit falls inside the window, whatever was typed in the
-- service box. The service is still returned, as a column to look at; it is no
-- longer a filter that silently discards people.
--
-- ── 2. The "floor" caveat was counting the wrong thing ──
--
-- procedures_unlinked said 40.7% of procedure records carry no appointment,
-- which made the conversion rate look like a guess. Checked properly: of the
-- 23,110 procedures that carry a REAL DATE, 23,093 - 99.93% - are linked to an
-- appointment. The 15,836 unlinked ones are undated Salesforce imports
-- (date_not_recorded), which no time-based figure should have been counting in
-- the first place. So two honest totals are added, and the caveat that reads
-- them can now say something true and small instead of something alarming and
-- misleading.
--
-- The signature, the returned columns and every existing totals key are
-- unchanged, so the CURRENTLY PUBLISHED build keeps working untouched.
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
      'procedures_unlinked', (select count(*) from public.procedures p where p.appointment_id is null),
      -- The two that tell the truth about linkage. A procedure with no date
      -- cannot belong to any window, so it is the DATED ones that decide
      -- whether an appointment-level rate can be trusted - and virtually all
      -- of them are linked.
      'procedures_dated', (
        select count(*) from public.procedures p where not p.date_not_recorded),
      'procedures_dated_unlinked', (
        select count(*) from public.procedures p
         where not p.date_not_recorded and p.appointment_id is null),
      'window_appointments', (
        select count(*) from attended a where a.start_time >= v_from and a.start_time < v_to),
      -- Kept so nothing reading this object breaks, but no longer a caveat:
      -- a blank service no longer removes anybody from the report.
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
     where fi.start_time >= v_from
       and fi.start_time < v_to
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
  'First-time patients whose first attended visit falls in the window, with whether they ever returned, plus clinic-wide conversion totals. Does not depend on the free-text service field. Staff only.';

revoke all on function public.clinic_retention_conversion(date, date) from public, anon;
grant execute on function public.clinic_retention_conversion(date, date) to authenticated;
