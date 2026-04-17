
## Plan: Full-Page Survey View

Replace modal/popup survey views with a dedicated full page at `/surveys/:id`.

### Exploration findings
- `AllSurveys.tsx` — currently opens survey detail in a modal/dialog when card clicked
- `PatientDetail.tsx` — Surveys tab has eye icon that opens a popup
- `SurveyTemplateDetail.tsx` already shows a similar pattern (Dialog for response details) — we'll reference its data shape
- Existing `survey_responses` table has `answers`, `dr_status`, `dr_notes`, plus joins to `patients`, `survey_templates`, `survey_questions`
- `SurveyRecommendations.tsx` exists for AI recommendations + approved products/services display

### What changes

**1. New file: `src/pages/SurveyResponseDetail.tsx`**
Full page route showing:
- Header: Back button (uses `navigate(-1)`) + survey template name + status badge
- **Patient info card**: name (link to patient profile), phone, age/gender
- **Template info card**: template name, problem area, service, submitted date, status
- **Answers section**: all questions + answers from `survey_responses.answers` joined with `survey_questions`
- **AI Recommendation section**: pulls from existing recommendation data (reuse `SurveyRecommendations` component or its display logic)
- **Approved products & services**: list of approved items linked from response
- **Doctor notes** (if present)

**2. `src/App.tsx`**
- Add route: `/surveys/:id` → `SurveyResponseDetail`

**3. `src/pages/AllSurveys.tsx`**
- Remove modal/dialog open logic on card click
- Replace with `navigate(\`/surveys/\${response.id}\`)`

**4. `src/pages/PatientDetail.tsx` (Surveys tab)**
- Eye icon / row click → `navigate(\`/surveys/\${response.id}\`)` instead of opening popup
- Remove the popup/dialog component for survey view

### Files modified
- `src/pages/SurveyResponseDetail.tsx` (new)
- `src/App.tsx`
- `src/pages/AllSurveys.tsx`
- `src/pages/PatientDetail.tsx`
