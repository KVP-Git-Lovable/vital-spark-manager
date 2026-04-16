

## Plan: Enhanced Survey System — Approval Workflow, Selective Recommendations, and UI Improvements

### Overview
Three major improvements: (1) Add an approval workflow to survey templates, (2) Allow selective approval of AI-recommended products/services in the Surveys page, (3) Improve the Surveys page UI to match the Survey Templates card-based design.

### Database Migration

Add an `approval_status` column to `survey_templates`:
```sql
ALTER TABLE survey_templates ADD COLUMN approval_status text NOT NULL DEFAULT 'draft';
-- Values: 'draft', 'pending_approval', 'approved'
```

Add `selected_products` and `selected_services` JSONB columns to `survey_responses` to track which AI recommendations were selectively approved:
```sql
ALTER TABLE survey_responses ADD COLUMN selected_products jsonb DEFAULT '[]'::jsonb;
ALTER TABLE survey_responses ADD COLUMN selected_services jsonb DEFAULT '[]'::jsonb;
```

### Changes

#### 1. Survey Templates — Approval Workflow (`SurveyTemplateForm.tsx`, `SurveyTemplates.tsx`)
- Add "Save as New Template" button alongside existing Save — clones the current template (with modified products/services) as a new template with `approval_status = 'draft'`
- Add "Send for Approval" button that sets `approval_status = 'pending_approval'`
- On the templates list page, show approval status badge (Draft / Pending Approval / Approved) on each card
- Admin users see an "Approve" button on pending templates, setting `approval_status = 'approved'`

#### 2. All Surveys Page — UI Upgrade + Selective Approval (`AllSurveys.tsx`)
- Replace the table layout with a card-based grid matching the Survey Templates page style
- Each card shows: patient name, template name, date, status badge, and action buttons
- In the detail dialog, show AI-recommended products and services with checkboxes for selective approval
- Add "Approve All" toggle to select/deselect all products and services at once
- When approving, only the selected (checked) products/services get saved to `selected_products`/`selected_services` and create prescriptions
- Filter: Only show surveys from templates that are both `is_active = true` AND `approval_status = 'approved'`

#### 3. Survey Templates Filtering
- In the Surveys page, template filter dropdown only lists templates with `approval_status = 'approved'` and `is_active = true`
- The survey fill flow (when assigning surveys to appointments) also restricts to approved + active templates only

### Files Changed
1. **Database migration** — add `approval_status` to `survey_templates`, add `selected_products`/`selected_services` to `survey_responses`
2. **`src/pages/AllSurveys.tsx`** — card-based UI, selective product/service checkboxes in detail dialog, approve all toggle, filter by approved templates
3. **`src/pages/SurveyTemplates.tsx`** — show approval status badge, approve button for admins on pending templates
4. **`src/components/surveys/SurveyTemplateForm.tsx`** — "Save as New Template" button, "Send for Approval" button
5. **`src/components/surveys/SurveyFill.tsx`** — filter template list to approved + active only

