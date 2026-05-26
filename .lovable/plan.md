## Changes to `src/components/procedures/ProcedureFormDialog.tsx`

### 1. Rename dialog heading
- `New Procedure / Consultation` → `New Procedure / Prescription`

### 2. Add unified AI bar at the top of the form
A new card-styled section, placed above the Patient/Doctor grid, using the teal brand color (`bg-primary/5 border-primary/20`, mic and Elaborate accents in `text-primary`). Contents:

- **Mic button** (pulsing dot while listening) — uses existing `useSpeechRecognition` hook (`en-IN`, continuous, interim results)
- **Live transcript textarea** — shows interim + final transcript; editable so doctor can correct before parsing
- **"Parse & Fill Fields" auto-trigger** — fires after speech stops (debounced ~1.2s of silence) AND also exposed as a manual button
- **"AI Elaborate All" button** — single call that elaborates every text section at once

### 3. New edge function `supabase/functions/procedure-ai-parse/index.ts`
- Input: `{ transcript: string, currentFields: {...} }`
- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`) with tool-calling for structured JSON
- Returns: `{ symptoms, diagnosis, procedure_notes, recommendations, service_name, prescriptions: [{medicine_name, frequency, duration, instructions}] }` — all optional/nullable
- System prompt: parse free-form clinical dictation; only fill fields explicitly mentioned; preserve existing field values when transcript doesn't mention them

### 4. New edge function `supabase/functions/procedure-ai-elaborate-all/index.ts`
- Input: `{ symptoms, diagnosis, procedure_notes, recommendations, serviceName }`
- Single AI call returns elaborated versions of all four fields in one structured response
- Empty fields are skipped (not invented)

### 5. Auto-fill UX
- After parse, merge returned fields into state (only overwrite non-empty returns)
- Apply a brief `animate-fade-in` + ring highlight (`ring-2 ring-primary/40`) on filled textareas for ~1.5s using per-field `recentlyFilled` state
- Toast: "Filled N fields from dictation"

### 6. Elaborate All UX
- All four textareas get a shimmer overlay (opacity pulse) while loading
- On response, replace values and clear shimmer

### 7. Remove per-field AI controls
- Remove the inline `MicButton` and `Elaborate AI` buttons from Symptoms, Diagnosis, Procedure Notes, Recommendations
- Remove now-unused `elaborate()` function and `elaborating` state
- Keep field labels and textareas clean

### Out of scope
- Prescriptions parsing from dictation is included in the parse schema but only appends new rows (does not delete existing). Asset rows are not auto-filled.
- The `Procedures` page list and other call sites are unchanged.
