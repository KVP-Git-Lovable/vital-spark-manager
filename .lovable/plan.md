

## Plan: Split "Patient_Name__c" into first/last on import

### Context
Your CSV has a single `Patient_Name__c` column (e.g. "Amulya Shetty", "Pranoti A Pol"). The current importer maps one source column to one DB field, so it can't split a single column into two. Database currently has only 2 patient rows, so this run will be a clean bulk load of ~28,690 records from `SF_patients.csv`.

### What gets built

**1. Auto-split logic in the importer** (`src/lib/patientImport.ts`)
- New alias entry `patient_name` recognized for headers like `Patient_Name__c`, `Patient Name`, `Full Name`, `Name`.
- When mapped (or auto-detected) to a virtual `__full_name__` target, the row builder splits on the **first space**:
  - "Amulya Shetty" → first_name="Amulya", last_name="Shetty"
  - "Pranoti A Pol" → first_name="Pranoti", last_name="A Pol"
  - "Madonna" (single token) → first_name="Madonna", last_name="" (empty allowed; DB default already handles this)
- Trims extra whitespace, collapses multiple spaces.
- If user explicitly maps both `first_name` and `last_name` separately, those win — auto-split is skipped.

**2. Mapping UI option** (`src/components/patients/ImportPatientsDialog.tsx`)
- Add a "Full Name (auto-split)" option alongside First Name / Last Name in the field dropdown.
- Auto-detect picks it for `Patient_Name__c`.

**3. Salesforce-friendly column aliases**
Add these aliases so all your CSV headers auto-map:
- `Patient_Name__c` → Full Name (auto-split)
- `Mobile_Number__c` → phone
- `Email_ID__c` → email
- `Date_of_birth__c` → date_of_birth
- `Sex__c` → gender
- `Place__c` → address
- `Emergency_Contact_Person__c` → emergency_contact_name
- `Emergency_Contact_Number__c` → emergency_contact_phone
- `Patient_source__c` → source
- `Reason_for_Consulting__c` → skin_concerns
- `Patient_details__c` → notes (preserves multi-line treatment history verbatim)
- `FB_follower__c` → follows_facebook
- `Instagram_follower__c` → follows_instagram
- The leading `_` column is ignored.

**4. Removed phone-as-name guard side effect**
The existing guard that swaps phone-shaped first names into the phone field stays, but only fires when the source header is mapped to `first_name` directly — not when it came from a full-name split (split values are never phone-like).

### How you'll use it
1. Open Patients → **Import Patients** → upload `SF_patients.csv`.
2. Mapping screen shows everything pre-mapped, including `Patient_Name__c → Full Name (auto-split)`.
3. Preview shows the first/last split per row so you can verify before commit.
4. Click Import. Existing dedup-by-phone/email logic skips the 2 rows already in DB; the rest (~28,688) insert in batches of 500 with progress.
5. Final report lists Imported / Skipped (DB dup) / Skipped (file dup) / Invalid, downloadable as CSV.

### Files
- Modified: `src/lib/patientImport.ts`, `src/components/patients/ImportPatientsDialog.tsx`

### Out of scope
- No DB schema changes.
- No bulk update of existing 2 records (they're test rows; tell me if you want them re-split too and I'll add a one-off SQL fix).

