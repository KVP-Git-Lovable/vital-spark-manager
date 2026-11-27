-- The Skin Tracker's improvement %, kept somewhere it can be read.
--
-- The AI has always returned an overallImprovement out of 100, but the only
-- place it landed was ai_repository.content - an opaque JSON blob with no
-- column, no index and no way to list or report on the figure. The clinic
-- asked for it to run by itself and update a field. This is the field.
--
-- Two measures per patient: 'overall' is the first photo against the latest,
-- 'since_last' is the one before the latest against the latest.
--
-- ── Why "comparable" is a column and not an assumption ──
--
-- Nothing in the photo table says what part of a person a photo shows.
-- photo_type is 'before' on all 91,530 rows, only 808 carry a perceptual
-- hash, 94% have no appointment, and a patient averages fifteen photos - a
-- face, a scalp, a back, an arm. So "first" and "latest" are frequently
-- different body parts, and an improvement percentage computed across those
-- would be a made-up number sitting in a medical record.
--
-- The model is therefore asked to judge the pair before scoring it, and a
-- pair it will not vouch for is stored with comparable = false, a reason, and
-- improvement left NULL. NULL here means "no answer", which is why the column
-- is nullable and has no default: a 0 would read as "no improvement".
--
-- Nothing below renames, drops or tightens anything that already exists, so
-- the CURRENTLY PUBLISHED build keeps working untouched - it simply never
-- reads these two tables.

create table if not exists public.skin_progress (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,

  -- 'overall'    : first photo  -> latest photo
  -- 'since_last' : previous photo -> latest photo
  measure     text not null check (measure in ('overall', 'since_last')),

  -- Which two photos the figure is about. Kept so a stale number is
  -- recognisable: if the patient has been photographed since, after_photo_id
  -- is no longer their latest and the runner picks them up again. ON DELETE
  -- SET NULL rather than CASCADE, because losing the row would lose the
  -- clinician's view of a judgement that was made; a null id reads as stale
  -- and is simply recomputed.
  before_photo_id uuid references public.patient_photos(id) on delete set null,
  after_photo_id  uuid references public.patient_photos(id) on delete set null,
  before_taken_at timestamptz,
  after_taken_at  timestamptz,

  -- 0-100, or NULL when the AI would not vouch for the pair. Nullable on
  -- purpose: "we do not know" has to be distinguishable from "no change".
  improvement numeric check (improvement is null or (improvement >= 0 and improvement <= 100)),

  comparable  boolean not null default false,
  not_comparable_reason text,

  summary     text,
  metrics     jsonb not null default '[]'::jsonb,

  model       text,
  computed_at timestamptz not null default now(),

  -- One row per patient per measure, so a nightly run updates in place
  -- instead of growing a history nobody asked for.
  unique (patient_id, measure)
);

comment on table public.skin_progress is
  'Skin Tracker improvement % per patient, per measure (overall / since_last). Written only by the skin-progress-run function; improvement is NULL when the AI would not vouch for the photo pair.';

comment on column public.skin_progress.improvement is
  'AI improvement 0-100, or NULL when comparable is false. NULL is "no answer", not "no change".';

-- The patient record reads its own two rows.
create index if not exists skin_progress_patient_idx
  on public.skin_progress (patient_id);

alter table public.skin_progress enable row level security;

-- Clinic data is staff-only at the database, and a new table gets the same
-- restrictive gate as every other one.
drop policy if exists signed_in_must_be_staff on public.skin_progress;
create policy signed_in_must_be_staff on public.skin_progress
  as restrictive for all to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

-- ...and its own policy asks the same question rather than USING (true), so
-- access never rests on that one rule alone.
drop policy if exists "Authenticated staff can read skin_progress" on public.skin_progress;
create policy "Authenticated staff can read skin_progress" on public.skin_progress
  for select to authenticated
  using ((select public.is_active_staff()));

-- Deliberately NO insert, update or delete policy for app users. These rows
-- are a record of what an AI said about two specific photos; the only writer
-- is the runner, on the service key. A clinician editing the figure by hand
-- would make it mean nothing, and nothing in the app has a reason to.

-- ── The brake ──
--
-- The same billing latch knowledge_ai_state is. A 402 or 403 from the gateway
-- writes a row here and every later call stops reading it. Skin analysis
-- honours no such latch today, and a backfill of eleven thousand calls must
-- not be the thing that discovers that.
create table if not exists public.skin_ai_state (
  id          text primary key default 'skin',
  reason      text not null,
  status_code integer not null,
  updated_at  timestamptz not null default now()
);

comment on table public.skin_ai_state is
  'Billing/permission latch for skin progress AI. A row here stops every further gateway call until an admin clears it.';

alter table public.skin_ai_state enable row level security;

drop policy if exists signed_in_must_be_staff on public.skin_ai_state;
create policy signed_in_must_be_staff on public.skin_ai_state
  as restrictive for all to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

drop policy if exists "Authenticated staff can read skin_ai_state" on public.skin_ai_state;
create policy "Authenticated staff can read skin_ai_state" on public.skin_ai_state
  for select to authenticated
  using ((select public.is_active_staff()));

-- An admin needs to be able to clear the latch once the credits are topped
-- up; nobody needs to be able to set one by hand.
drop policy if exists "Admins can clear skin_ai_state" on public.skin_ai_state;
create policy "Admins can clear skin_ai_state" on public.skin_ai_state
  for delete to authenticated
  using ((select public.is_active_staff()) and (select public.is_admin_user()));

-- ── What still needs doing ──
--
-- Which patients the runner should look at next, answered in the database
-- because it is a group-by over 91,530 photo rows and should not be dragged
-- into Deno.
--
-- The queue DRAINS ITSELF: a patient drops out once their row records their
-- current latest photo, whatever the verdict was. So a per-run cap is not a
-- cliff - the next run simply continues - and a patient photographed again
-- comes back automatically, because after_photo_id is then no longer their
-- latest.
--
-- SECURITY DEFINER is deliberately NOT used: the runner holds the service
-- key, which bypasses RLS on its own, and execute is granted to service_role
-- alone. A definer function here would be a hole through the policies for no
-- benefit.
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
     -- Nothing recorded yet, or what is recorded is about an older photo.
     not exists (
       select 1 from public.skin_progress sp
        where sp.patient_id = pp.patient_id
          and sp.measure = 'overall'
          and sp.after_photo_id = pp.latest_photo_id
     )
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
  'Patients with two or more photos whose skin_progress is missing or older than their latest photo. Service role only.';

-- Nobody but the runner. Not anon, not a signed-in clinician, not the
-- anon-key bridge the nightly job authenticates with.
revoke all on function public.skin_progress_queue(integer, boolean) from public, anon, authenticated;
grant execute on function public.skin_progress_queue(integer, boolean) to service_role;

-- ── Nightly ──
--
-- The same bridge the three Salesforce jobs use: pg_cron fires
-- public.sf_fire_function, which calls the edge function over HTTP with the
-- publishable anon key. That key is already public - it ships inside the
-- app's JavaScript - which is precisely why skin-progress-run accepts no
-- parameters from its caller and caps itself.
--
-- 21:30 UTC is 03:00 IST, after the clinic has closed and clear of the
-- Salesforce jobs at 20:30 and 20:45 UTC (02:00 and 02:15 IST). cron runs on
-- UTC, so the hour here is not the hour in Mangalore. ?today=1 narrows it to
-- patients photographed that day - roughly twenty to thirty a night - rather
-- than the whole backlog.
--
-- CREATED INACTIVE ON PURPOSE. The edge function is deployed from Lovable,
-- not from here, so until somebody deploys it this job would fire nightly at
-- a URL that does not exist. The journeys scheduler in this codebase was
-- built schedule-ready and left switched off and forgotten; this one is
-- switched off with the single statement that turns it on written down:
--
--   select cron.alter_job(
--     job_id := (select jobid from cron.job where jobname = 'skin-progress-nightly'),
--     active := true);
--
-- cron.alter_job, not "update cron.job set active": this database refuses a
-- direct UPDATE on cron.job (permission denied for table job), so the plain
-- statement looks right, applies cleanly in a local Postgres, and fails here.
select cron.unschedule('skin-progress-nightly')
 where exists (select 1 from cron.job where jobname = 'skin-progress-nightly');

select cron.schedule('skin-progress-nightly', '30 21 * * *',
  $cron$ select public.sf_fire_function('skin-progress-run?today=1'); $cron$);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'skin-progress-nightly'),
  active := false);
