

## Plan: Clean manual mapping in Import Patients dialog

### Problem
- Auto-detection guesses field matches (often wrongly, e.g., a Salesforce column gets mapped to `first_name` automatically), and the user has to undo bad guesses.
- The dropdown shows technical field names (e.g., `first_name`, `emergency_contact_phone`) which can feel inconsistent.

### Changes

**1. Disable auto-mapping** (`src/components/patients/ImportPatientsDialog.tsx`)
- In `handleFile`, replace `setMapping(autoDetectMapping(h))` with an empty mapping (`Object.fromEntries(h.map(c => [c, ""]))`), so every column starts as **— Skip —**.
- User must explicitly map each file column.

**2. Cleaner field labels** (same file)
- Add a `FIELD_LABELS` map for human-readable names shown in the dropdown (e.g., `first_name → "First Name"`, `emergency_contact_phone → "Emergency Contact Phone"`).
- Field list still comes only from `PATIENT_FIELDS` in `src/lib/patientImport.ts` — the canonical 16 system fields. Nothing extra is added.
- Required fields keep the `*` indicator.

**3. Keep "Skip" default & duplicate prevention**
- "— Skip —" remains the first option and is the default for every row.
- Already-mapped fields stay disabled in other rows (prevents two file columns mapping to the same patient field).

**4. Update the help text** at top of step 2:
- From: *"We've auto-detected mappings…"*
- To: *"Map each file column to a patient field. Required: First Name, Last Name, Phone."*

**5. Keep `autoDetectMapping`** in `patientImport.ts` untouched (no longer called, but left for potential future use). No DB changes, no other files touched.

### Files
- Modified: `src/components/patients/ImportPatientsDialog.tsx`

### Result
Step 2 opens with every column set to **— Skip —**. User manually picks the matching system field from a dropdown of friendly labels. Required fields are flagged; duplicate mappings are prevented; previously-incorrect auto-mappings (like `first_name` getting wrongly assigned) no longer happen.

