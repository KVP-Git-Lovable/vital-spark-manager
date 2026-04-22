
## Plan: Make last name optional in Patient Import

### Change
In `src/lib/patientImport.ts`, remove `last_name` from the `REQUIRED_FIELDS` array so only `first_name` and `phone` are mandatory.

```ts
export const REQUIRED_FIELDS: PatientField[] = ["first_name", "phone"];
```

### Effect
- Step 2 (Mapping): Only First Name and Phone show the `*` required indicator. The "Preview" button enables once those two are mapped.
- Step 3 (Preview): Rows missing `last_name` no longer get the "last name missing" error and are counted as valid. Empty `last_name` is inserted as null/blank.
- Step 4 (Import): Previously-skipped rows (only failing on last name) will now import successfully.

### Files
- Modified: `src/lib/patientImport.ts` (one-line change to `REQUIRED_FIELDS`)

No DB or schema changes — `patients.last_name` is already nullable in the database.
