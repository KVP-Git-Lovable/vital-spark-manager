## Goal

Enable patients to fill surveys from the portal (assigned by staff or self-picked from active templates), and let staff assign templates without filling.

## Database (1 migration)

Create `survey_assignments` table:
- `id uuid pk`, `patient_id uuid not null`, `template_id uuid not null`, `assigned_by uuid` (staff), `status text default 'pending'` (pending | completed | cancelled), `response_id uuid` (set after submission), `notes text`, `created_at`, `updated_at`
- Indexes on `patient_id`, `(patient_id, status)`
- RLS: enable; portal reads via session token pattern (mirroring how other portal queries currently work — current portal uses anon `supabase` client directly, so add permissive `select`/`update` policies for `anon` filtered by patient_id is not safe. Match the existing pattern in the portal: open select to anon (same as `appointments`/`procedures` queries already do). Use the same RLS approach already used by the existing `survey_responses` table to stay consistent.)

## Clinic App

**`src/pages/PatientDetail.tsx`** — replace single template selector in Surveys tab with a 2-step flow:
1. Click "+ Add Survey" → small dialog with two buttons: **Fill Now** and **Assign to Patient**
2. Both show the template dropdown:
   - Fill Now → existing behavior: navigate to `/surveys/new?patient=:id&template=:id`
   - Assign to Patient → insert into `survey_assignments` (status=pending), toast success, refresh list
3. Show assigned (pending) items above responses with an "Assigned • Pending patient" badge

## Patient Portal

**`src/pages/portal/Portal.tsx`**:
- Add `surveys` tab to bottom nav before `bot`: `Home | Appts | History | Photos | Bills | Shop | Surveys | AI Bot` (icon: `ClipboardCheck`)
- Add new tab content section with two collapsible groups:
  - **Assigned Surveys**: query `survey_assignments` where `patient_id = me AND status = 'pending'`, joined with template name/description. Empty state if none.
  - **Available Surveys**: query `survey_templates` where `is_active = true`, excluding those already assigned-pending (to avoid duplicates in both lists). Show name + description + "Start" button.
- Tapping any item opens a new in-portal fill view (reuse a new lightweight component, see below) — not the clinic `/surveys/new` page (portal is a self-contained `/portal` route with no auth header).

**New component `src/components/portal/PortalSurveyFill.tsx`**:
- Props: `patientId`, `templateId`, `assignmentId?`, `onClose`, `onSubmitted`
- Fetches template + questions, renders inputs (mirror `SurveyNew.tsx` rendering: text/single_choice/multi_choice/scale with empty-options textarea fallback)
- On submit:
  1. Call `survey-recommend` edge function (same as `SurveyNew`) for AI products/services + enrich via `enrichAiProducts/Services`
  2. Insert into `survey_responses` with `dr_status='pending_review'`
  3. If `assignmentId`, update assignment → `status='completed'`, `response_id=<new>`
  4. Invoke new edge function `send-survey-whatsapp` with `{ patient_id, template_name, response_id }`
  5. Toast + close, refresh portal queries

This guarantees responses appear in:
- Patient Detail → Surveys tab (already queries `survey_responses` by patient_id)
- All Surveys page (already lists all `survey_responses`)
- Doctor approval flow unchanged (status defaults to Pending)

## Edge Function

**New `supabase/functions/send-survey-whatsapp/index.ts`**:
- CORS + JWT-optional (consistent with existing whatsapp functions)
- Inputs (zod): `patient_id`, `template_name`, `response_id`
- Loads patient phone from `patients` table via service role client
- Sends WhatsApp via Twilio gateway (mirror `send-appointment-whatsapp` pattern). Use a configurable `SURVEY_WHATSAPP_TEMPLATE_SID` env var; if unset, send a plain text body fallback ("New survey submitted: {template_name}. Pending doctor review.")
- Returns `{ success: true }` (non-blocking — failures logged, do not break submit)

Notify user in chat: they may add `SURVEY_WHATSAPP_TEMPLATE_SID` secret later for an approved template; until then we use freeform text.

## Files Touched

- **New migration**: `survey_assignments` table + RLS
- **New**: `src/components/portal/PortalSurveyFill.tsx`
- **New**: `supabase/functions/send-survey-whatsapp/index.ts`
- **Edited**: `src/pages/portal/Portal.tsx` (nav tab + Surveys page)
- **Edited**: `src/pages/PatientDetail.tsx` (Add Survey → Fill Now / Assign dialog, show assigned list)

## Out of Scope

- Patient-side viewing of past responses (existing `survey_responses` shown only in clinic; can be added later)
- Twilio template SID configuration UI (user configures secret directly)
