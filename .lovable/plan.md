

## Plan: Import Patients (Excel/CSV) with mapping & validation

### Where
New button on `src/pages/Patients.tsx` header → opens a multi-step `ImportPatientsDialog` (new component).

### Flow (4 steps in one dialog)

**1. Upload**
- Drag/drop or file picker accepts `.csv`, `.xlsx`, `.xls`
- Parse with `xlsx` library (handles both CSV and Excel uniformly)
- Read first sheet → array of rows with header row detected

**2. Column Mapping**
- Left column: every header from the file
- Right column: dropdown of patient fields (the 16 listed) + "— Skip —"
- **Auto-detect**: fuzzy match headers to field names (e.g. "Phone Number" → `phone`, "DOB"/"Birth Date" → `date_of_birth`, "First Name"/"Fname" → `first_name`). Pre-fill dropdowns; user can override.
- Required field indicator on `first_name`, `last_name`, `phone`

**3. Preview & Validate**
- Table showing first 50 mapped rows with the target field names as headers
- Run validations row-by-row:
  - `phone` required, non-empty, normalized (strip spaces/dashes)
  - `phone` unique within the file (flag duplicates)
  - `phone` not already in DB (single query: `select phone from patients where phone in (...)`)
  - `email` format check if present
  - `date_of_birth` parseable to ISO date (accept dd/mm/yyyy, yyyy-mm-dd, Excel serial)
  - `gender` normalized to Male/Female/Other if recognizable
  - `follows_facebook`/`follows_instagram` → boolean (yes/y/true/1)
  - `skin_concerns` → split by comma into text[] 
- Summary banner: `X valid · Y errors · Z duplicates` + toggle "Show only errors"
- Each error row shows inline reason ("Phone missing", "Phone already exists", etc.)

**4. Confirm & Import**
- Button: `Import N valid patients` (disabled if N=0)
- Insert in batches of 100 via `supabase.from("patients").insert(...)`
- Progress bar; on completion show toast `Imported N · Skipped M`
- Refetch patient list, close dialog

### Files
- **New**: `src/components/patients/ImportPatientsDialog.tsx` — the full 4-step dialog
- **New**: `src/lib/patientImport.ts` — header auto-detect map, row validators, date/boolean/array normalizers
- **Modified**: `src/pages/Patients.tsx` — add `Import` button next to `Add Patient`, wire dialog open state + refetch on success
- **Dependency**: add `xlsx` (sheetjs) via npm

### Salesforce integration (research outcome)
Direct Salesforce sync is feasible later via OAuth 2.0 + REST API (`/services/data/vXX.0/sobjects/Contact`), but requires a Connected App in the user's Salesforce org and a backend edge function to hold refresh tokens securely. **Not built now** — Excel/CSV import ships as the primary path. When the user is ready, we'd add: (a) a `salesforce-sync` edge function with stored refresh token, (b) field mapping UI mirroring this importer, (c) optional scheduled pull. Flagged as a follow-up; no scaffolding added in this change.

### Out of scope
- Update-on-conflict (duplicates are skipped, not merged) — can add later as a checkbox option
- Family/relationship import — patient records only

