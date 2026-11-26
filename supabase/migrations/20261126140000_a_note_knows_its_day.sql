-- A clinic note now knows which day it is about.
--
-- The notebook was one flat list, newest first. The clinic writes rota notes
-- into it - "18th Dec (Friday) - Vindhya ma'am 10:30am - 1:30pm only" - so the
-- day a note is ABOUT lived only in the prose. The only date the database held
-- was the moment somebody typed it, and seventeen notes covering three months
-- were all typed across two afternoons. The list was the only possible view,
-- and it grew until nobody could find the day they wanted.
--
-- Two nullable columns, so a note can also span days: "26th - 28th Dec -
-- Ashwini ma'am on leave" has to show on the 27th as well, or somebody
-- checking that day sees an empty page while a doctor is away.
--
-- Backward-compatible, as AGENTS.md requires: nullable, no default, nothing
-- renamed or dropped. The build the clinic is running right now inserts notes
-- without these columns and keeps working exactly as it does today - its notes
-- simply arrive undated, and the panel lists them separately rather than
-- losing them.
alter table public.clinic_notes
  add column if not exists note_date date,
  add column if not exists note_end_date date;

comment on column public.clinic_notes.note_date is
  'The day the note is about, which is not the day it was written. Null means undated.';
comment on column public.clinic_notes.note_end_date is
  'Last day of a note that spans days. Null means it is only about note_date.';

create index if not exists clinic_notes_by_day_idx
  on public.clinic_notes (note_date, note_end_date) where deleted_at is null;

-- ── Backfill ──
--
-- Every existing note begins with the date it is about. These values were read
-- out of that prose and then CHECKED AGAINST THE WEEKDAY the writer put in
-- brackets - "30th Nov (Monday)" is only accepted because 30 Nov 2026 really
-- is a Monday. All 21 notes that name a date agreed with their own weekday;
-- the two that do not get a date here are "test" and "djsdksjksjdksjd", both
-- already deleted, and they stay undated rather than being filed under a guess.
--
-- Written out one row at a time rather than parsed in SQL: this is the
-- clinic's own operational record, and a reviewer can check any line of it
-- against the note it came from.
--
-- `where note_date is null` makes this safe to run twice and stops it
-- overwriting a date somebody has since set by hand.
update public.clinic_notes as n
   set note_date = v.start_date,
       note_end_date = case when v.end_date = v.start_date then null else v.end_date end
  from (values
    ('ef2973e8-df25-471e-9b8b-c42b3bc94253'::uuid, date '2026-12-18', date '2026-12-18'),
    ('12c89bef-86a0-46c7-b004-8a07078c7103'::uuid, date '2026-11-30', date '2026-11-30'),
    ('2cd64bc4-74bd-4332-a7f4-dd6e0a751e49'::uuid, date '2026-12-31', date '2027-01-01'),
    ('a10dabee-fe9a-4ccf-8f5a-efc670e15525'::uuid, date '2026-12-30', date '2026-12-30'),
    ('dc1ec91a-0544-47fe-b142-82c5f03857c1'::uuid, date '2026-12-26', date '2026-12-28'),
    ('ef10d2f8-b61c-40f1-8ef1-9a36f31a8e20'::uuid, date '2026-12-23', date '2026-12-23'),
    ('67db4034-0ea2-4ad7-b6aa-996b8570cfe7'::uuid, date '2026-12-16', date '2026-12-16'),
    ('53d53f63-2e48-4ddd-a042-67b0228a561c'::uuid, date '2026-12-09', date '2026-12-09'),
    ('00d6a074-d878-4b86-b618-b69598b30566'::uuid, date '2026-12-08', date '2026-12-08'),
    ('1e2f5da4-0178-4720-810b-94c494363683'::uuid, date '2026-12-07', date '2026-12-07'),
    ('047c97a6-6a00-401c-be05-b0420ed2288c'::uuid, date '2026-12-05', date '2026-12-05'),
    ('8a21c065-44a6-454c-ae14-b6d3fcebb143'::uuid, date '2026-12-04', date '2026-12-04'),
    ('c5df36e7-14b3-4fe5-ad09-040c2a273936'::uuid, date '2026-12-03', date '2026-12-03'),
    ('9c013606-cdbe-4533-8fd6-3ecc0ff5cc93'::uuid, date '2026-12-02', date '2026-12-02'),
    ('b18b639b-90d8-47cb-9aad-d675a806d201'::uuid, date '2026-12-01', date '2026-12-01'),
    ('8a1978ec-162b-47d8-ad5b-e3d26357f200'::uuid, date '2026-11-28', date '2026-11-28'),
    ('baf9036c-ba7d-4bcb-a007-d75344b7d929'::uuid, date '2026-11-27', date '2026-11-27'),
    ('395f2b27-c6b6-444e-8200-153703ce282f'::uuid, date '2026-11-26', date '2026-11-26'),
    ('895f2f1e-b8d3-4864-b518-9008e5fdc858'::uuid, date '2026-11-27', date '2026-11-27'),
    ('5edc03e2-bc47-4e48-943f-d594fefed865'::uuid, date '2026-11-25', date '2026-11-25'),
    ('396e0563-fa2f-4c32-9f51-361f0add55b5'::uuid, date '2026-11-26', date '2026-11-26')
  ) as v(id, start_date, end_date)
 where n.id = v.id
   and n.note_date is null;
