

## Plan: Recover missing patients + fix bulk-import scale issue

### Diagnosis

- **Database now**: 25,019 patients (25,017 imported in last 7 days from your earlier runs).
- **CSV uploaded**: ~28,663 rows. So ~3,000–3,600 patients are still missing.
- **Root cause of partial import**: In `ImportPatientsDialog.goToPreview()`, the existing-phone check runs `supabase.from("patients").select("phone").in("phone", [...28k phones])`. Supabase caps that response at **1000 rows** by default, so the dialog only "knew about" 1000 existing patients. But importing didn't dedupe at all (we removed dedup blocking earlier per your request) — combined with the dialog re-running on a partial CSV it produced an incomplete import.
- **Per your latest rule**: dedup must happen on **phone AND email** so we don't reimport existing patients.

### Two-part fix

**Part A — One-time recovery run (now, server-side)**

Process your `patients_import.csv` directly on the server using the same column mapping as your Salesforce export:

```text
First_Name → first_name        Mobile_Number__c → phone
Last_Name  → last_name         Email_ID__c     → email
Date_of_birth__c → date_of_birth   Sex__c → gender
Place__c → address              Patient_source__c → source
Reason_for_Consulting__c → skin_concerns
Patient_details__c → medical_history
Others__c → notes
Emergency_Contact_Person__c → emergency_contact_name
Emergency_Contact_Number__c → emergency_contact_phone
FB_follower__c → follows_facebook
Instagram_follower__c → follows_instagram
```

Steps:
1. Pull all existing `(phone, email)` from the DB in pages of 1000 (full 25k rows) → build two sets: `existingPhones`, `existingEmails`.
2. Stream-parse the CSV.
3. For each row:
   - Normalize phone (strip spaces/dashes), lowercase email.
   - **Skip** if phone exists in DB OR email exists in DB OR phone+email already seen earlier in this CSV.
   - **Skip** if missing both first name and phone.
   - Otherwise add to insert batch.
4. Insert in batches of 500 using the service role (bypasses any RLS edge cases, faster).
5. After completion, output a **CSV report** to `/mnt/documents/patient_import_report.csv` with columns: `row_number, salesforce_id, name, phone, email, status (imported / skipped_duplicate_phone / skipped_duplicate_email / skipped_duplicate_in_file / skipped_invalid / failed), reason`.
6. Print summary: total rows, imported, skipped (broken down), failed.

This runs once and recovers the ~3k missing records without touching the dialog UI.

**Part B — Permanent fix to `ImportPatientsDialog` so this never happens again**

Modify `src/components/patients/ImportPatientsDialog.tsx` and `src/lib/patientImport.ts`:

1. **Fix existing-record lookup to handle >1000 rows**: paginate the `patients` SELECT in 1000-row pages (using `.range()`) until exhausted — load all phones AND emails into two sets.
2. **Dedup on phone OR email** (both, not just phone) — both against DB and within the file.
3. **Mark dedup rows as `skip` with a clear reason** (`Duplicate phone in DB`, `Duplicate email in DB`, `Duplicate within file`) — already-imported patients will not be re-inserted.
4. **Batch inserts**: keep at 100 but add proper per-row error capture so a single bad row doesn't fail the whole batch (fall back to per-row insert on batch failure).
5. **Step 3 preview**: show separate counters — `Valid · Duplicates (DB) · Duplicates (file) · Errors`.
6. **Step 4 result**: show the breakdown and add a "Download report" button that exports a CSV of every row's outcome.

### Files

- **Run once**: a one-off Node script (server-side, not added to repo) to recover the missing ~3k patients from your uploaded CSV.
- **Modified**: `src/components/patients/ImportPatientsDialog.tsx` — paginated existing-record fetch, phone+email dedup, per-row error fallback, downloadable report.
- **Modified**: `src/lib/patientImport.ts` — accept both `existingPhones` and `existingEmails` sets, return richer skip reasons.

### Deliverables to you

1. ✅ All missing patients imported (target: bring total to ~28,663 unique).
2. ✅ A downloadable CSV report at `/mnt/documents/patient_import_report.csv` listing every row's outcome.
3. ✅ Console summary: `Imported: X · Skipped (DB dup): Y · Skipped (file dup): Z · Invalid: W · Failed: F`.
4. ✅ Future imports through the UI will correctly skip already-existing patients (by phone or email) at any scale.

### Out of scope

- No DB schema changes (no unique constraints added — your data already has legitimate duplicate phones/emails for family members, so a hard constraint would break inserts).
- Existing 25,019 patients are not touched/deduped — only new rows from the CSV are added.

