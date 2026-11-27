-- The skin progress queue was hiding a half-finished patient, for good.
--
-- As first written it asked only whether the 'overall' row pointed at the
-- patient's current latest photo. A patient has TWO measures - 'overall' and
-- 'since_last' - so a run that wrote the first and stopped before the second
-- looked complete to the queue, dropped out of it, and never had 'since_last'
-- computed at all.
--
-- That was already possible (an invocation can be cut off at any moment), and
-- the companion change makes it routine: the runner now stops starting new
-- work after 90 seconds, because the real queue needs 49 gateway calls for its
-- first 25 patients - minutes of work, well past both the platform's
-- invocation limit and sf_fire_function's 150-second timeout. Stopping early
-- is only safe if what was not finished comes back.
--
-- So the test is now a count rather than an existence check: how many measures
-- SHOULD this patient have, against how many are recorded about their current
-- latest photo. Two when they have three or more photos; one when they have
-- exactly two, because then 'overall' and 'since_last' are the same pair and
-- asking twice would pay twice for one answer (423 patients are in that case).
--
-- Still self-draining, still service_role only, still not SECURITY DEFINER,
-- and still the clinic's day rather than UTC's. Nothing about the signature
-- changes, so the CURRENTLY PUBLISHED build is untouched - it never calls this.
create or replace function public.skin_progress_queue(
  p_limit integer default 25,
  p_only_today boolean default false
)
returns table (patient_id uuid, photo_count bigint, latest_photo_id uuid, latest_taken_at timestamptz)
language sql
stable
set search_path to 'public'
as $$
  with per_patient as (
    select
      ph.patient_id,
      count(*) as photo_count,
      max(ph.taken_at) as latest_taken_at,
      -- The id of the newest photo, by the same ordering the runner uses.
      (array_agg(ph.id order by ph.taken_at desc, ph.id desc))[1] as latest_photo_id
    from public.patient_photos ph
    where ph.patient_id is not null
    group by ph.patient_id
    having count(*) >= 2
  )
  select pp.patient_id, pp.photo_count, pp.latest_photo_id, pp.latest_taken_at
    from per_patient pp
   where (
     -- Measures recorded about the CURRENT latest photo...
     select count(*)
       from public.skin_progress sp
      where sp.patient_id = pp.patient_id
        and sp.after_photo_id = pp.latest_photo_id
        and sp.measure in ('overall', 'since_last')
   ) < (
     -- ...against how many this patient should have.
     case when pp.photo_count >= 3 then 2 else 1 end
   )
     and (
       not p_only_today
       -- The clinic's day, not UTC's: a bare date comparison would start the
       -- day at 05:30 in Mangalore and miss the morning's photos.
       or (pp.latest_taken_at at time zone 'Asia/Kolkata')::date
            = (now() at time zone 'Asia/Kolkata')::date
     )
   order by pp.latest_taken_at desc, pp.patient_id
   limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

comment on function public.skin_progress_queue(integer, boolean) is
  'Patients with two or more photos who are missing a skin_progress measure for their current latest photo. Service role only.';

revoke all on function public.skin_progress_queue(integer, boolean) from public, anon, authenticated;
grant execute on function public.skin_progress_queue(integer, boolean) to service_role;
