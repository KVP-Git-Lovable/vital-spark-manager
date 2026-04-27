## Problem
Currently `src/pages/Appointments.tsx` inserts new appointments into the `appointments` table without verifying whether the selected staff (doctor) already has an overlapping appointment. The screenshot shows two patients booked with the same doctor (Anjali Desai) at 9:00 AM on Tue 28 — the system allowed it.

This needs to be fixed at **two layers**: client-side (immediate UX feedback) and database-side (authoritative guard so it can't be bypassed via API/import/edits).

## Plan

### 1. Database guard (authoritative)
Add a Postgres validation trigger on `public.appointments` that raises an exception if an insert/update would result in the same `staff_id` having a time-range overlap with another appointment on the same day. Logic:
- Skip when `staff_id IS NULL` (allows unassigned bookings).
- Skip when the existing appointment is in a "blocking-exempt" status, e.g. `Cancelled` or `No-show` (configurable — default exempt list: `Cancelled`, `No-show`).
- Overlap check: `new.start_time < other.end_time AND new.end_time > other.start_time` for the same `staff_id`, excluding the row's own `id` on update.
- On conflict, raise a clear error message like: *"Dr. <name> already has an appointment from HH:MM to HH:MM. Please pick a different slot."* (We'll include the conflicting time window; the client will surface the message via the existing `onError` toast.)

A unique constraint can't express range overlaps, so a `BEFORE INSERT OR UPDATE` trigger function is the right tool. (Per project rules: trigger, not CHECK constraint.)

### 2. Client-side pre-check (better UX)
In `src/pages/Appointments.tsx` `createAppointment.mutationFn`:
- Before inserting (both single and recurring branches), if `staffId` is set, query existing appointments for that staff that overlap any of the proposed start/end windows, excluding `Cancelled` / `No-show` statuses.
- If conflicts found, throw a friendly error listing the conflicting date/time(s) so the user sees the toast immediately without a round-trip insert.
- For **recurring** bookings: validate every generated occurrence; if any conflicts, abort the whole batch and list which dates conflict.
- Apply the same pre-check inside `rescheduleAppointment` (drag-to-reschedule) and the inline edit mutation when `start_time`, `end_time`, or `staff_id` is being changed, so the database error surfaces nicely.

### 3. Optional UX enhancement (small)
In the New Appointment dialog, when `staffId` + `startDate` + `startTime` + `endTime` are all set, show a subtle inline warning under the time picker if a conflict is detected (using the same query). This gives feedback before the user clicks Save. Cheap to add since the query already exists.

## Files affected
- **New migration**: create `validate_appointment_no_overlap()` function + `BEFORE INSERT OR UPDATE` trigger on `public.appointments`.
- **Updated**: `src/pages/Appointments.tsx` — add overlap pre-check helper and use it in `createAppointment`, `rescheduleAppointment`, and `inlineUpdateMutation`; optional inline warning in the dialog.

## Notes / questions
- **Status exemptions**: I'll treat `Cancelled` and `No-show` as non-blocking by default. Tell me if you also want `Proposed` (tentative) bookings to be non-blocking — currently they will block, which I think is correct.
- **Buffer time**: Strict overlap only (touching slots, e.g. 9:00–9:30 then 9:30–10:00, are allowed). Let me know if you want a configurable buffer.
- This change does not affect existing rows; it only guards future inserts/updates.