
## Goal

Add a reusable voice-to-text microphone control across the clinic app using the browser's free Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`). Click to record (red dot + timer), click again to stop, transcript auto-fills the field and remains editable.

## 1. Shared building blocks

**`src/hooks/useSpeechRecognition.ts`** — new hook
- Wraps `window.SpeechRecognition || window.webkitSpeechRecognition`
- Returns: `{ supported, listening, transcript, interimTranscript, elapsedMs, start, stop, reset, error }`
- Continuous mode, interim results on, language defaults to `en-IN` (configurable)
- Internal `setInterval` for timer; auto-stops on error/end

**`src/components/shared/MicButton.tsx`** — new component
- Props: `value`, `onChange(text)`, `mode: "append" | "replace"` (default append), `language?`, `size?`, `className?`, `title?`
- Renders a small ghost icon button with `Mic` (idle) / `MicOff` + pulsing red dot + `MM:SS` timer (recording)
- On click: toggle start/stop; on final transcript chunks, calls `onChange(value + " " + chunk)` (append) or `onChange(chunk)` (replace)
- Graceful fallback: if unsupported, render disabled icon with tooltip "Voice input not supported in this browser"
- Uses `sonner` toast for permission/error feedback

**`src/components/shared/MicTextarea.tsx`** and **`MicInput.tsx`** — thin wrappers that compose `Textarea`/`Input` with `MicButton` positioned absolute top-right inside the field's relative container. Optional — use bare `MicButton` next to label where wrapping is awkward.

## 2. Procedures module

File: `src/components/procedures/ProcedureFormDialog.tsx` (and `ProcedureDetailSheet.tsx` if it has the same fields).

Add `MicButton` next to the label (append mode) for:
- Symptoms
- Diagnosis
- Procedure Notes
- Recommendations
- Prescription notes field (the freeform one — individual medicine rows handled in §4)

## 3. New Appointment form — smart voice intake

File: `src/pages/Appointments.tsx` (New Appointment dialog).

Add a single mic button in the dialog header labeled "Voice fill". On stop:
1. Take final transcript
2. Call new edge function `voice-parse-appointment` (Lovable AI Gateway, `google/gemini-2.5-flash`) with prompt:
   - Input: transcript + list of active patients (id, name, phone) + list of services (id, name)
   - Output JSON: `{ patient_id?, patient_query?, date?, time?, service_id?, notes? }`
3. Apply returned fields to existing form state (patient combobox, date, time, service select). Show toast summarizing what was filled; unmatched values surface as a warning.

Also add a small mic on the **patient search combobox** itself (replace mode) that just dictates the search string — no AI call needed.

## 4. Prescription / Rx tab (Patient profile)

Files: `src/pages/PatientDetail.tsx` Rx tab + any shared Rx row component (search project for the prescription editor — likely inside `PatientDetail.tsx` or a Procedure prescription sub-form).

Per medicine row: add small `MicButton` (replace mode) next to:
- Medicine name
- Dosage
- Frequency
- Duration

Mic on medicine name additionally triggers a lightweight async lookup against `pharma_products` to suggest the closest match (existing combobox handles selection — voice just fills the query).

## 5. Top patient search bar

File: likely `src/components/layout/AppLayout.tsx` or a top-bar component (will confirm during implementation).

Add mic icon inside the global search input. On final transcript:
1. Query `patients` table by name (ilike on first/last/full)
2. If single match → `navigate('/patients/:id')`
3. If multiple → drop transcript into the search input and open the existing search dropdown
4. If none → toast "No patient matched '<transcript>'"

## 6. Therapy Notes (Appointment sidebar)

File: `src/components/appointments/AppointmentDetailSheet.tsx`.

Locate the Therapy Notes textarea (search project; may live in a sub-tab). Add `MicButton` (append mode) inline with the field label. Transcribed text appended to existing notes, save button unchanged.

## Behavior spec (applies everywhere)

- Click mic → request permission (browser handles) → start recognition → button turns destructive variant, shows pulsing red dot + `MM:SS` elapsed
- Click again → stop, final transcript flushed to field
- Interim results not written into the field (avoids flicker); shown as muted helper text under the field while recording
- Permission denied / unsupported → toast + button disabled state
- Field remains a normal input/textarea so user can edit afterwards
- Language: `en-IN` default (matches India clinical context); easy to change per call

## Technical notes

- No new npm deps — Web Speech API is built into Chrome/Edge/Android Chrome
- TypeScript: add minimal `SpeechRecognition` type declarations in `src/vite-env.d.ts`
- New edge function `voice-parse-appointment` uses `LOVABLE_API_KEY` (already provisioned), no user secret needed
- All other voice features are 100% client-side, zero backend cost
- Mobile Safari does not support Web Speech API → disabled-state fallback handles it cleanly

## Files to add

- `src/hooks/useSpeechRecognition.ts`
- `src/components/shared/MicButton.tsx`
- `supabase/functions/voice-parse-appointment/index.ts`

## Files to edit

- `src/vite-env.d.ts` (types)
- `src/components/procedures/ProcedureFormDialog.tsx`
- `src/components/procedures/ProcedureDetailSheet.tsx` (if applicable)
- `src/pages/Appointments.tsx`
- `src/pages/PatientDetail.tsx` (Rx tab)
- `src/components/layout/AppLayout.tsx` (top search)
- `src/components/appointments/AppointmentDetailSheet.tsx` (therapy notes)
