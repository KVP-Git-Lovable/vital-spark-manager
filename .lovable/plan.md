## Goal
Make the "Parse & Fill Fields" AI in **New Procedure / Prescription** correctly populate dropdown fields (Patient, Doctor, Assisted By, Problem Areas) from dictated text using fuzzy matching against the actual database lists — and tell the user when a value couldn't be matched instead of silently leaving it blank.

## Changes

### 1. `supabase/functions/procedure-ai-parse/index.ts` (Edge Function rewrite)
- Accept new payload fields from the client:
  - `patients: [{ id, name }]`
  - `doctors: [{ id, name }]` (staff with role doctor)
  - `assistants: [{ id, name }]` (staff with role nurse/assistant)
  - `problemAreas: [{ id, name }]`
- Rewrite the system prompt to:
  - Include each list (id|name lines, capped) as ground-truth options.
  - Instruct the model to map spoken text to the closest option using fuzzy/word-overlap matching, returning the exact `id` from the list when confident; otherwise return `null` for the id and the raw spoken phrase in a `*_query` field so the UI can show a hint.
  - For `problem_area_ids`, return an array of matched ids plus any unmatched queries.
- Extend the `fill_procedure_fields` tool schema with:
  - `patient_id`, `patient_query`
  - `doctor_id`, `doctor_query`
  - `assistant_id`, `assistant_query`
  - `problem_area_ids: string[]`, `problem_area_unmatched: string[]`
- Keep all existing fields (`service_name`, `symptoms`, `diagnosis`, `procedure_notes`, `recommendations`, `prescriptions`) unchanged.

### 2. `src/components/procedures/ProcedureFormDialog.tsx`
- Fetch active doctors and assistant-eligible staff (reuse existing staff query pattern; filter by role on the client to avoid new queries).
- In `parseDictation`, send the four lists (patients, doctors, assistants, problem areas) to the edge function alongside `transcript` and `currentFields`.
- On response, set state when an id is returned:
  - `setPatientId`, `setStaffId`, `setAssistedBy`, `setSelectedProblemAreas(prev => unique merge)`.
- Track unmatched queries in a new `unmatchedHints` state: `{ patient?: string; doctor?: string; assistant?: string; problemAreas?: string[] }`.
- Render a small muted inline hint under each affected field, e.g. *"Couldn't match 'Punya Suvarna' — please select manually."* Clear the hint when the user picks a value manually.
- Keep the existing flash-highlight + toast behavior; include the new fields in the "filled" count.

### 3. Light client-side safety net
- After the model returns, verify each returned id actually exists in the corresponding list (defensive); if not, treat as unmatched and surface the hint. No client-side Levenshtein needed — the model does the fuzzy matching with the list in context.

## Out of scope
- No schema changes, no new tables, no changes to other dialogs or to `procedure-ai-elaborate-all`.
- Symptoms/diagnosis remain free-text (no master tables exist).
