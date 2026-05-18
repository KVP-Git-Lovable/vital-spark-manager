## Plan

1. **Remove the portal fallback that fetches all active survey templates**
   - Delete the unused `portal-available-surveys` query from `PortalSurveysList`.
   - Keep the portal Surveys tab driven only by `survey_assignments` where `patient_id` matches and `status = pending`.
   - Remove the stale invalidation for `portal-available-surveys` after submission.

2. **Create a survey assignment when staff clicks “Send Survey Link” during new appointment creation**
   - Before/with the WhatsApp send, insert a `survey_assignments` row with:
     - `patient_id`
     - selected `template_id`
     - `status: pending`
   - This makes the selected appointment survey appear in the patient portal.
   - Avoid creating duplicate pending assignments for the same patient/template if one already exists.

3. **Keep appointment creation behavior consistent**
   - The “Send Survey Link” button will still show success/error confirmation.
   - The selected survey link will only expose that assigned template in the portal.
   - Filled survey responses will continue to update the assignment to completed and appear in appointment Survey tab / All Surveys.

## Technical notes

- Files to update:
  - `src/pages/portal/Portal.tsx`
  - `src/pages/Appointments.tsx`
- No database schema change is needed because `survey_assignments` already exists with the needed fields.