-- Half a day off.
--
-- Leave was whole dates only: the form worked the days out by subtracting one
-- date from the other, so somebody wanting a morning off had to book the whole
-- day or not book it. The clinic asked how to apply for half a day, and the
-- answer was that you could not.
--
-- Nothing else is needed for the arithmetic: leave_applications.days is
-- already numeric with no check constraint, and approval decrements
-- staff_leave_balances.used (also numeric) by Number(app.days), so 0.5 flows
-- through the balance untouched. What was missing is WHICH half - a rota
-- needs to know whether the person is away in the morning or the afternoon,
-- and "0.5" on its own does not say.
--
-- Backward-compatible on purpose: nullable, no default, nothing renamed or
-- dropped. The build the clinic is running right now inserts leave without
-- this column and keeps working exactly as it does today; its rows simply
-- carry null, which reads as a whole day.
alter table public.leave_applications
  add column if not exists half_session text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leave_applications'::regclass
      and conname = 'leave_applications_half_session_check'
  ) then
    alter table public.leave_applications
      add constraint leave_applications_half_session_check
      check (half_session is null or half_session in ('first', 'second'));
  end if;
end $$;

comment on column public.leave_applications.half_session is
  'Which half of the day is taken: first, second, or null for a whole day. Only meaningful when start_date = end_date.';
