## Customer Portal Configuration

Rename the Pharmacy → Settings tab to **"Customer Portal Configuration"** and expand it from a shop-only panel into a single control center for every patient portal section. Each toggle directly drives what the patient sees in `/portal/dashboard`.

### What gets added

Toggles, grouped by section in the Settings tab UI:

- **Appointments**: Enable Appointment Booking, Enable Cancellation/Reschedule
- **History**: Enable Treatment History, Enable Procedure History
- **Photos**: Enable Clinical Photos
- **Bills**: Enable Bills/Invoices, Enable Outstanding Balance
- **Shop**: Enable Shop (existing — kept)
- **Surveys**: Enable Surveys
- **AI Bot**: Enable AI Bot
- **Our Team**: Enable Our Team section
- **Clinic Hours**: Enable Clinic Hours display
- **Quick Actions**: Enable "Request Appointment", Enable "Order Medicine"

Existing pharmacy-related settings (out-of-stock behavior, expiring products, low-stock threshold) stay, but move under a clearly labeled **Shop / Pharmacy** sub-section so the panel reads cleanly.

A single **Save Settings** button at the bottom persists the whole form (current behavior preserved).

### Portal behavior

The portal (`src/pages/portal/Portal.tsx`) reads the same `portal_settings` row it already loads for `shop_enabled`, and conditionally:

- Hides bottom-nav tabs when their toggle is off (`appointments`, `photos`, `surveys`, `bot`, `pharmacy`).
- Hides the **Request Appointment** / **Order Medicine** quick action buttons on the home tab.
- Hides the **Book** button + appointment dialog if booking is disabled; hides cancel/reschedule controls on appointment cards if that toggle is off.
- Hides Treatment History / Procedure History blocks accordingly.
- Hides the Bills section and the Outstanding Balance card.
- Hides the Our Team and Clinic Hours blocks on the home tab.

If a tab the user is on becomes disabled, fall back to the home tab.

### Technical details

1. **Migration** on `public.portal_settings` — add boolean columns (default `true` so existing portals behave the same):
   `appointments_booking_enabled`, `appointments_reschedule_enabled`,
   `treatment_history_enabled`, `procedure_history_enabled`,
   `clinical_photos_enabled`,
   `bills_enabled`, `outstanding_balance_enabled`,
   `surveys_enabled`, `ai_bot_enabled`,
   `our_team_enabled`, `clinic_hours_enabled`,
   `quick_action_request_appointment_enabled`, `quick_action_order_medicine_enabled`.
   No RLS changes — existing public/auth read+update policies cover them.

2. **`src/pages/Pharma.tsx`**:
   - Rename `TabsTrigger value="settings"` label to "Customer Portal Configuration" (icon kept).
   - Extend `settingsForm` state and the `useEffect` hydrator with the new fields.
   - Re-lay out the Settings `TabsContent` into grouped cards (Appointments, History, Photos, Bills, Shop, Surveys, AI Bot, Our Team, Clinic Hours, Quick Actions, plus existing Shop/Pharmacy behavior controls). Each row: label + short description + `<Switch>`.
   - Keep the existing single Save mutation; it will now `.update(settingsForm)` with the expanded payload.

3. **`src/pages/portal/Portal.tsx`**:
   - Expand the `portal-settings` query to `select("*")` and derive booleans (default `true` when null).
   - Filter `tabs` array by the matching toggles (already done for `pharmacy`/shop).
   - Wrap the relevant JSX blocks (quick actions, booking button, cancel/reschedule UI, history sections, photos tab, bills section + outstanding balance, surveys tab, bot tab, our-team block, clinic hours block) in conditional renders.
   - If `activeTab` is filtered out, reset to `"home"`.

4. **No edits** to `src/integrations/supabase/client.ts` or `types.ts`; the latter regenerates after the migration is applied.

### Out of scope

- Per-staff visibility for the Our Team list (handled in Staff module, as noted).
- Permission-level overrides per patient — this is a clinic-wide configuration.
