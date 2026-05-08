# Add Survey Section to New Appointment Form

## Goal
After the Problem Areas field in the New Appointment dialog (`src/pages/Appointments.tsx`), add an optional **Survey** section with two independent dropdowns:
1. **Assign to Patient** — sends a WhatsApp invite to the patient to self-fill the chosen survey.
2. **Fill Now** — opens the full survey form on screen (same `SurveyFill` dialog used in Patient Detail) right after the appointment is created, so front desk can complete it on behalf of the patient.

Either, both, or neither may be used. If neither is selected, the appointment creates normally with no extra side-effects.

## UI Changes (`src/pages/Appointments.tsx`)

Insert a new block immediately after the Problem Areas section (around line 898), styled consistently with surrounding fields:

```
Survey (optional)
├── Assign to Patient   [Select active survey template ▾]   (WhatsApp invite on save)
└── Fill Now            [Select active survey template ▾]   (Opens survey after save)
```

- Each dropdown lists only **active + approved** survey templates  
  (`is_active = true AND approval_status = 'approved'`).
- Each dropdown includes a "None" option (clears selection).
- Show a small helper line under each: "Patient will receive a WhatsApp link" / "Survey opens after appointment is created".
- New local state: `assignSurveyTemplateId`, `fillNowSurveyTemplateId`. Reset on dialog close, after submit, and when switching patients.

## Data Fetch
Add a TanStack `useQuery` (`enabled: open`) keyed `["active-survey-templates"]` that selects `id, name` from `survey_templates` where `is_active = true` and `approval_status = 'approved'`, ordered by name. Reuse for both dropdowns.

## Behaviour on Appointment Save

After the appointment row is successfully inserted (inside the existing create mutation's `onSuccess` / post-insert flow):

1. **If `assignSurveyTemplateId` is set:**
   - Look up the chosen template's name.
   - Invoke the existing edge function `send-survey-whatsapp` with `{ patient_id, template_name }`.
   - Toast success/failure independently — do not block appointment creation.
   - Note: this currently only sends a notification message. We are matching the existing "WhatsApp invite" pattern already used elsewhere; no new SMS link generation is added in this change.

2. **If `fillNowSurveyTemplateId` is set:**
   - Close the New Appointment dialog.
   - Open the existing `SurveyFill` dialog (`src/components/surveys/SurveyFill.tsx`) with:
     - `templateId = fillNowSurveyTemplateId`
     - `appointmentId = newly created appointment id`
     - `patientId = selected patient id`
   - On `onComplete`, just close the survey dialog (existing behaviour).

3. **If both are set:** fire the WhatsApp invite **and** open Fill Now. (Front desk explicitly chose both.)

4. **If neither:** unchanged flow.

## State / Component Wiring

- Import `SurveyFill` at the top of `Appointments.tsx`.
- Add component-level state to keep the post-save Fill Now context alive after the booking dialog closes:
  ```
  const [pendingFillNow, setPendingFillNow] = useState<{
    templateId: string;
    appointmentId: string;
    patientId: string;
  } | null>(null);
  ```
- Render `<SurveyFill open={!!pendingFillNow} ... />` near the bottom of the page (alongside other dialogs), wired to clear `pendingFillNow` on close.

## Out of Scope
- No DB schema changes.
- No edits to `SurveyFill` or `send-survey-whatsapp` edge function.
- No changes to recurring-appointment flow logic beyond the same hook point (only single-create triggers Fill Now to avoid opening many dialogs; for recurring, only the WhatsApp assign fires, on the first created appointment). Will confirm/implement this guard during build.

## Files Touched
- `src/pages/Appointments.tsx` (UI + state + post-save hook)

No new files.
