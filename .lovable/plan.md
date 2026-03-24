

## Plan: AI-Powered Survey Templates with Smart Recommendations

### What We Are Building

A survey system where clinic admins create question templates grouped by patient age, problem area, and service type. Each template includes questions with ideal answers, linked products, and recommended services. When a patient fills out a survey (linked to an appointment), an AI model analyzes responses and recommends products, services, and advice -- all pending doctor approval before being finalized.

### Architecture

```text
┌─────────────────────────────────────────────────┐
│  Survey Template (admin-managed)                │
│  Grouped by: Age Range + Problem Area + Service │
│  Contains: Questions, Ideal Answers,            │
│            Products, Recommended Services       │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Survey Response (per appointment/patient)      │
│  Patient answers questions → saved              │
│  AI analyzes answers vs template ideals         │
│  Generates: Product + Service recommendations   │
│  Status: Pending Dr Review → Approved           │
└─────────────────────────────────────────────────┘
```

### Database Tables (5 new)

1. **survey_templates** -- id, name, description, age_range_min, age_range_max, problem_area_id (FK → problem_areas), service_id (FK → services), is_active, created_at
2. **survey_questions** -- id, template_id (FK), question_text, question_type (text/single_choice/multi_choice/scale), options (jsonb), ideal_answer (jsonb), sort_order
3. **survey_template_products** -- id, template_id (FK), product_id (FK → pharma_products), advice_text
4. **survey_template_services** -- id, template_id (FK), service_id (FK → services), advice_text
5. **survey_responses** -- id, template_id (FK), appointment_id (FK), patient_id (FK), answers (jsonb), ai_recommendation (jsonb), ai_products (jsonb), ai_services (jsonb), dr_status (pending_review/approved/modified), dr_notes, reviewed_by (FK → staff), reviewed_at, created_at

### Implementation Steps

#### Step 1: Database Migration
Create all 5 tables with RLS policies (anon + authenticated full access, matching existing patterns).

#### Step 2: Survey Templates Admin Page (`/survey-templates`)
- List view of all templates with filters by problem area and service
- Create/edit dialog with:
  - Name, description, age range (min/max)
  - Problem area lookup (from `problem_areas` table)
  - Service type lookup (from `services` table)
  - Questions builder: add/reorder questions, set type (text, single choice, multi choice, 1-10 scale), define ideal answers
  - Products section: search and add products from `pharma_products` with advice text
  - Recommended services section: add from `services` with advice text
- Add to sidebar navigation and App.tsx routes

#### Step 3: Link Survey to Appointments
- In the appointment form, add an optional "Survey Template" lookup field
- Auto-suggest matching templates based on patient age + selected problem areas + selected service
- When a template is linked, show a "Fill Survey" button on the appointment detail sheet

#### Step 4: Survey Fill & AI Recommendation (Edge Function)
- Survey fill UI: renders questions from the linked template, patient answers inline
- On submit, call a new **`survey-recommend`** edge function that:
  - Receives: template questions + ideal answers + patient answers + available products + available services
  - Uses AI (Gemini Flash) to compare patient responses against ideals
  - Returns: scored product recommendations, service recommendations, and personalized advice
  - Stores results in `survey_responses` with `dr_status = 'pending_review'`

#### Step 5: Doctor Review Workflow
- In the appointment detail or procedure page, show AI recommendations with a clear "Pending Review" badge
- Doctor can: approve as-is, modify recommendations (add/remove products/services, edit advice), or reject
- On approval, status changes to `approved` and recommendations become visible to the patient (portal)

### AI Strategy for Multiple Combinations

Rather than hardcoding rules for every age/problem/service combination, the AI approach works as follows:

- **Template as context**: The AI receives the full template (ideal answers, associated products, services) as structured context
- **Scoring**: AI compares patient answers to ideals, identifies gaps and concerns
- **Dynamic selection**: From the template's product and service pool, AI picks the most relevant based on the gap analysis
- **Prompt engineering**: The system prompt instructs the AI to act as a dermatology advisor, considering age, skin type, and problem severity
- **Human-in-the-loop**: Every AI output requires doctor sign-off, creating a feedback loop that improves trust over time

This means admins only need to maintain templates (which products/services are candidates for each scenario), and the AI handles the combinatorial matching in real-time.

### Technical Details

**New files:**
- `src/pages/SurveyTemplates.tsx` -- Admin CRUD page
- `src/components/surveys/SurveyTemplateForm.tsx` -- Template builder with questions, products, services
- `src/components/surveys/SurveyFill.tsx` -- Patient-facing survey form
- `src/components/surveys/SurveyRecommendations.tsx` -- AI results + doctor review UI
- `supabase/functions/survey-recommend/index.ts` -- AI edge function

**Modified files:**
- `src/App.tsx` -- Add `/survey-templates` route
- `src/components/layout/AppSidebar.tsx` -- Add sidebar link
- `src/pages/Appointments.tsx` -- Add survey template lookup + fill button
- `src/components/appointments/AppointmentDetailSheet.tsx` -- Show survey results + review UI

