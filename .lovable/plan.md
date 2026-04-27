# Fix: Survey Approval → Auto-create Rx & Procedures

## Problems found

1. **Approve handler only exists in `AllSurveys.tsx`.** The other two approve buttons — `SurveyRecommendations.tsx` (inside Appointment Detail Sheet) and `SurveyResponseDetail.tsx` — only flip `dr_status` and never insert Rx or procedures. Approving from these places does nothing downstream.
2. **Approved products are missing dosage / frequency / duration / instructions.** The AI tool schema in `survey-recommend` only returns `product_name` + `advice`. The template-level `survey_template_products` config (which has these fields) is fetched but never carried into `ai_products`, so created prescriptions have null clinical fields.
3. **Services are never pushed to the patient's Procedures tab.** No code path inserts into `procedures` on approval.
4. **No "From Survey: [Template Name]" source label** is stored on either prescriptions or procedures.

## Fix plan

### 1. Centralize approval in a shared helper
Create `src/lib/surveyApproval.ts` with `approveSurveyResponse(response, { selectedProducts, selectedServices })` that:
- Updates `survey_responses` with `dr_status: "approved"`, `selected_products`, `selected_services`, `reviewed_at`.
- For each selected product, inserts a row in `prescriptions`:
  - `survey_response_id` = response.id, `procedure_id: null`
  - `medicine_name` = product name
  - `dosage`, `frequency`, `duration`, `quantity`, `instructions` populated from product config (template values take precedence; falls back to AI values, then `advice`)
  - Prefixes `instructions` with `From Survey: [Template Name] — ` so the source is visible in the Rx tab
  - `product_id` linked when known
- For each selected service, inserts a row in `procedures`:
  - `patient_id` = response.patient_id
  - `service_name` = service name
  - `status: "Recommended"` (so it shows as a pending/suggested procedure, not "Completed")
  - `procedure_date: now()`
  - `procedure_notes` = `From Survey: [Template Name] — [advice text]`
- Invalidates `patient-prescriptions`, `patient-procedures`, `patient-surveys`, `all-survey-responses`, `survey-responses` (for AppointmentDetailSheet) queries.

### 2. Enrich `ai_products` with template clinical fields
In `src/pages/SurveyNew.tsx` and `src/components/surveys/SurveyFill.tsx`, after `survey-recommend` returns, merge each AI product back with its matching `survey_template_products` row (by name) and persist the merged objects into `ai_products`. Each saved product will then carry: `product_id`, `product_name`, `advice`, `dosage`, `frequency`, `duration`, `instructions`. Same enrichment for services (carry `service_id`, `advice`).

### 3. Update `survey-recommend` edge function
Pass dosage/frequency/duration/instructions into the AI's product pool context so it can echo them back, and extend the tool schema to optionally return them. (Frontend enrichment in step 2 is the safety net if the model omits them.)

### 4. Wire up the missing approve buttons
- **`src/components/surveys/SurveyRecommendations.tsx`**: in the existing Approve / Modify mutation, call `approveSurveyResponse(...)` instead of just updating `dr_status`. Pass all AI products/services as "selected" by default (since this UI has no per-item checklist).
- **`src/pages/SurveyResponseDetail.tsx`**: add an "Approve" button (visible when `dr_status !== "approved"`) that calls the same helper, defaulting to all recommended items.
- **`src/pages/AllSurveys.tsx`**: replace the inline approve logic with a call to the same helper so behavior is identical everywhere.

### 5. Show services in the patient Procedures tab
The procedures query in `PatientDetail.tsx` already pulls all rows for the patient, so the new "Recommended"-status procedures will appear automatically. Add a "Recommended" badge variant in the procedures list rendering and (optionally) a "Convert to Appointment" affordance — out of scope for this fix; the row will simply appear with status "Recommended".

## Files touched
- `src/lib/surveyApproval.ts` *(new)*
- `src/pages/SurveyNew.tsx`
- `src/components/surveys/SurveyFill.tsx`
- `src/components/surveys/SurveyRecommendations.tsx`
- `src/pages/SurveyResponseDetail.tsx`
- `src/pages/AllSurveys.tsx`
- `supabase/functions/survey-recommend/index.ts`

## Result
Approving a survey response from any screen (AllSurveys list, Patient → Surveys tab detail, or Appointment Detail Sheet) will:
- Insert each approved product into the patient's **Rx tab** with full dosage/frequency/duration/instructions and a `From Survey: [Template Name]` prefix.
- Insert each approved service into the patient's **Procedures tab** as a "Recommended" procedure tagged with the template name.
