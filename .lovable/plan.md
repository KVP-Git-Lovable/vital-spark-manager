## Problem

In Report Builder → Save & Run shows "No records found" even though data exists. Root cause confirmed by reproducing the PostgREST query:

- The report was built with a related object (e.g. Procedures + Patients).
- The selected Group Rows / Group Columns / Columns reference field keys that do not exist on the chosen tables (e.g. `patients.patient_name`, `procedures.appointment_id`). These can come from stale saved reports (created with a different join, then primary/related changed) or from leftover chips when the user switches objects.
- `ReportPreview.fetchData` blindly forwards every selected key into the Supabase `select(...)` string. PostgREST then returns:
  `{"code":"42703","message":"column patients_1.patient_name does not exist"}`
- The error is caught and `setData([])` is called, producing the empty-state message — with no visible feedback to the user.

## Fix

1. **`src/components/reports/ReportPreview.tsx` — sanitize keys before querying**
   - When building `primaryFieldKeys` and `relatedFieldKeys`, validate each key against the object's `fields` list (`getObjectByKey(...).fields`). Drop any key that isn't a real column.
   - Always include `id` for the primary object and the foreign key column for related joins.
   - If after sanitization the primary has zero usable fields, fall back to the object's first 6 fields (current default behavior for the empty case).
   - When iterating filters, also skip filters whose column doesn't exist on the target object so a stale filter doesn't break the query.

2. **`src/components/reports/ReportPreview.tsx` — surface errors instead of silently emptying**
   - On Supabase error, render a small inline error block in place of "No records found": shows a friendly message ("Couldn't load data — some selected fields may no longer exist") plus the PostgREST error message in a muted style. This makes future schema mismatches obvious instead of looking like "no data".

3. **`src/components/reports/ReportBuilder.tsx` — purge stale field chips on object change**
   - When `primaryObject` or `relatedObject` changes, filter `columns`, `groupRows`, `groupColumns`, and `filters` to only keep keys whose `objectKey` is still `primaryObject` or `relatedObject` AND whose `fieldKey` exists on that object. This prevents the user from saving a report that references invalid fields in the first place.

4. **Defensive load of saved reports**
   - When a report is opened (in `ReportViewer` / `ReportBuilder`), apply the same sanitization once on load so old saved reports with invalid keys self-heal silently.

## Out of scope

- No DB or RLS changes — data and policies are fine (verified 16,544 procedures rows query cleanly when the select string is valid).
- No changes to the chart rendering, grouping, or matrix logic.

## Files touched

- `src/components/reports/ReportPreview.tsx` — sanitize keys, sanitize filters, show real error message.
- `src/components/reports/ReportBuilder.tsx` — purge invalid chips on object change and on initial load.
- `src/components/reports/ReportViewer.tsx` — sanitize the loaded `report` object before passing to `ReportPreview`.
