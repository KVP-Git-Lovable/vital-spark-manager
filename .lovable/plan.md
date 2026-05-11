# Appointments — Status Overhaul, Visit Status field, WhatsApp rules

## 1. Status options change

New status set everywhere:
- Reserved (default for new appointments)
- Confirmed
- Cancelled
- Follow Up

Removed: Proposed, Completed, No Show.

Migration handling for existing data:
- Map `Proposed` → `Reserved`
- Map `Completed` → `Confirmed` (preserves "happened" semantics; safest non-destructive mapping)
- Map `No Show` / `No-show` → `Cancelled`

A single SQL UPDATE will remap historical rows in `appointments.status`.

## 2. New "Visit Status" field

- Add nullable `visit_status TEXT` column to `public.appointments`.
- UI label: "Visit Status (Investigation)" — free-text input, optional.
- Placeholder: "Enter visit/investigation details..."
- Shown and editable in:
  - New Appointment dialog (`src/pages/Appointments.tsx`) — placed directly below Status.
  - Appointment Detail sidebar (`src/components/appointments/AppointmentDetailSheet.tsx`) — same placement, editable in edit mode, read-only display otherwise.
- Persisted on insert/update; included in queries that already select `*`.

## 3. Status filters & color tokens

Update `statusOptions`, `STATUS_CARD_CLASSES`, and `STATUS_BADGE_CLASSES` in both `Appointments.tsx` and `AppointmentDetailSheet.tsx`:

```text
Reserved   → info  (blue)
Confirmed  → success (green)
Follow Up  → warning/accent
Cancelled  → destructive
```

Calendar/list filters that currently exclude `["Cancelled","No-show"]` updated to `["Cancelled"]`.

Remove the auto-set-to-Completed logic when a procedure is completed (no longer a valid status). Status stays whatever the user chose; the procedure’s own status remains the source of truth for procedure completion.

Default status for new appointments: `Reserved`.

## 4. WhatsApp notification rules

In `AppointmentDetailSheet.tsx`:
- Only invoke `send-appointment-update-whatsapp` when the new status is `Confirmed` **or** `Cancelled` AND it differs from the previous status.
- Pass `kind: "cancelled"` for Cancelled (already wired to template `HX5abaead3d3ff7822e498705bd132d708`) and `kind: "update"` for Confirmed (template `HXfd1a5810ec489dc7b407651c805afbdd`).
- No notification for `Reserved` or `Follow Up`.

The edge function `send-appointment-update-whatsapp` already routes to the correct template based on `kind`, so no edge function changes are needed. The new-appointment WhatsApp invite (`send-appointment-whatsapp`) on creation is unrelated and remains unchanged.

## Files touched

- `supabase/migrations/<new>.sql` — add `visit_status` column + remap legacy statuses.
- `src/pages/Appointments.tsx` — status options/colors, default, filter list, Visit Status input in New Appointment form, save logic.
- `src/components/appointments/AppointmentDetailSheet.tsx` — status options/colors, Visit Status input, remove auto-Completed, tighten `notifyStatuses` to `["Confirmed", "Cancelled"]`.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

## Out of scope

- Edge function template changes.
- Reports / dashboards that aggregate by status (will continue to work; old labels simply won’t appear once data is remapped).
- Patient portal status displays (not mentioned in request).
