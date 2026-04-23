

## Plan: Import Salesforce Procedures CSV

### What's wrong today

Your `Procedures_and_Prescriptions.csv` doesn't fit the current importer at all:

| Issue | Cause | Effect |
|---|---|---|
| Patient shows as a number/ID | CSV has `Patient__c` (Salesforce ID like `a0D2w0000018iqAEAQ`) and `Patient_Name__c` (text). Importer matches patients **by phone**, which the file doesn't contain. | Every row would fail "Patient not found" — or worse, the SF ID gets stored as patient_id text. |
| Service is now a dropdown | DB requires `service_name` to match a row in `services` (29 rows). CSV's `Service__c` column is **empty** in every row. | Every row would fail "service required". |
| Procedure date missing | CSV has no date column. | Importer rejects every row (date is required). |
| Prescriptions ignored | CSV `Prescription__c` is free-text (e.g. "tab traxido 500mg 0-1-0"). Current schema needs structured rows in `prescriptions` table. | Lost data. |
| Symptoms/Diagnosis multi-line | CSV cells span many physical lines. | Already handled by `XLSX` parser — fine. |

### What gets built

**1. Upgrade `src/lib/procedureImport.ts`**
- Add new mappable fields:
  - `patient_sf_id` → matches against a new `patients.sf_id` column (see #4) OR falls back to **fuzzy name match** on `patient_name`.
  - `patient_name` → used to disambiguate when SF ID isn't in DB.
  - `service_name_text` → free-text; if non-empty, fuzzy-match (case-insensitive, trimmed) to `services.name`. If no match, store the literal text as `procedures.service_name` AND add a warning row "Service not in master — kept as free text".
  - `prescription_text` → dumped verbatim into `procedures.procedure_notes` under a "Prescription:" heading (no structured prescriptions inserted — it's unsalvageable text).
  - `special_instructions`, `dietary_advice`, `lab_tests` → appended to `recommendations` with section headings.
  - `visit_type` → stored as `status` if value matches an allowed status; otherwise prepended to `consultation_notes`.
- Salesforce header aliases auto-detected: `Patient__c`, `Patient_Name__c`, `Service__c`, `Symptoms__c`, `Diagnosis__c`, `Prescription__c`, `Special_Instructions__c`, `Dietary_Advice__c`, `Required_Lab_Test_s__c`, `Visit_type__c`.
- **Date fallback**: since the CSV has no date, default `procedure_date` to a single user-pickable date in the import dialog (a "Default procedure date" field shown when no date column is mapped). Suggested default: today, but user should set it to a representative historical date (e.g. CSV export date). One date applies to all rows that don't have one.
- Drop `patient_phone` from required fields. New required: **(patient_sf_id OR patient_name)** + **service text OR a fallback "Consultation"** + **date (mapped or default)**.

**2. Patient resolution flow** (in importer)
- Build two lookup maps on dialog open:
  - `sfIdToPatient` — only if `patients.sf_id` column exists and is populated.
  - `nameToPatients` — `lower(trim(first_name+' '+last_name)) → [patient ids]`. If multiple patients share a name, pick the most recent and warn.
- Resolution order per row: `sf_id` exact → `patient_name` exact (case-insensitive, trimmed, multi-space collapsed) → unresolved (row marked invalid with reason "No patient match for 'jewel martis'").

**3. Update `ImportProceduresDialog.tsx`**
- Show new fields in the mapping dropdown with labels: "Patient (Salesforce ID)", "Patient Name", "Service (free text)", "Prescription (free text)", "Special Instructions", "Dietary Advice", "Lab Tests", "Visit Type".
- Auto-pre-map all the `*__c` Salesforce columns.
- Add a **"Default procedure date"** date picker in step 2, enabled only when no `procedure_date` column is mapped. Required if no date column.
- Preview step shows resolved patient name + matched/unmatched service + the assembled `procedure_notes` snippet so you can verify before commit.
- Final report CSV lists every skipped row with the reason ("patient not found: jewel martis", "service kept as text: 'resurfx and fractional co2'", etc.).

**4. Optional one-time DB column for future re-imports**
- Add nullable `patients.sf_id text unique` (no FK). If the user re-runs the patient import with `Id → sf_id` mapped, future procedure imports will resolve by SF ID instead of by name (much more reliable).
- This requires a small patch to `src/lib/patientImport.ts` to add `sf_id` as a mappable target and to `ImportPatientsDialog.tsx` to expose it.
- **You'll need to re-import patients (or run a one-off update) to populate `sf_id` for the 17,440 existing patients.** Without this, name matching is the only option for the procedures CSV — and ~15-20% of names will likely be ambiguous (duplicates) or unmatched (typos).

### Recommended sequence

```text
Step A: Add patients.sf_id column + patient importer support  (one migration + ~30 lines)
Step B: Re-import the SF patients CSV with Id mapped to sf_id  (you do this in UI)
        → 17,440 patients now have sf_id
Step C: Procedures importer changes + Salesforce field support
Step D: Import Procedures_and_Prescriptions.csv (~28k rows)
        → resolves by sf_id, near-100% match rate
        → free-text prescriptions land inside procedure_notes
        → services not in master are kept as text + warned
```

### Files

- New migration: add `patients.sf_id text` + unique index.
- Modified: `src/lib/patientImport.ts`, `src/components/patients/ImportPatientsDialog.tsx` (add sf_id mapping).
- Modified: `src/lib/procedureImport.ts`, `src/components/procedures/ImportProceduresDialog.tsx` (new fields, default date, name/sf_id resolution, fuzzy service match).

### Out of scope

- Structured parsing of `Prescription__c` free text into `prescriptions` rows — the format is too inconsistent ("tab traxido 500mg 0-1-0 for 3 months" mixed with "all the above for 2 months"). Kept verbatim in notes; can be revisited later with an AI parser if needed.
- Linking back to original `Appointment__c` SF IDs (no SF ID column on `appointments` table either).

### Decision needed before I implement

1. Approve adding `patients.sf_id` and the recommended A→D sequence? (Strongly recommended — without it the match rate drops to maybe 70%.)
2. What default `procedure_date` should rows without a date use? Today, or a specific date like `2024-12-31`?

