

## Investigation Results: Imported Patient Data Audit

### 1. Where does "Age" come from?

**No `age` column exists in the database.** Age is computed live in the UI from `date_of_birth`:

```ts
// src/pages/Patients.tsx
const getAge = (dob) => Math.abs(new Date(diff).getUTCFullYear() - 1970);
```

It's displayed as `Gender · Age N` next to the patient name. So whenever DOB exists, an age is rendered — even if the DOB is wrong.

### 2. Data transformation during import

The importer (`src/lib/patientImport.ts → parseDate`) **does** auto-transform DOB strings. There's a serious bug in two-digit year handling:

```ts
let yy = +m1[3];
if (yy < 100) yy += 2000;   // BUG: always assumes 21st century
```

Result: a CSV value like `15/06/85` (intended 1985) is stored as **2085**, `05/01/01` becomes **2101**.

### 3. Audit of the 17,440 imported patient records

| Check | Count | Verdict |
|---|---|---|
| Total patients | 17,440 | — |
| With DOB | 8,104 | OK |
| **DOB in the future (>= today)** | **5,522** | **Corrupted by 2-digit year bug** |
| DOB year ≥ 2070 (impossible) | ~5,500 | Same root cause |
| DOB year ≤ 1900 (e.g. 1789) | a few | Likely typos in source CSV |
| Missing first_name | 0 | OK |
| Missing last_name | 8,509 | Expected — single-token full names like "Madonna" |
| Missing phone | 0 | OK (required field) |
| Distinct phones / total | 17,440 / 17,440 | No phone duplicates — dedup worked |
| With email | 16,600 | OK |
| Malformed email | 18 | Negligible |

### 4. Column mapping — was it correct?

Names, phone, email, gender, address all look intact based on spot checks (e.g. `Sharanam / 7760442342 / shettysharanam@gmail.com / Male`). The mapping itself is fine. **Only the date-of-birth field is affected**, and only when the source value used a 2-digit year.

### 5. Conclusion

- **No phantom `age` field** — it's a UI calculation from DOB.
- **No record corruption beyond DOB.** Names, phones, emails, gender are intact.
- **DOB has ~5,522 records with future years** because the importer's 2-digit year logic always pivots to 21st century. These show absurd ages like "Age -75".
- No duplicates were created; dedup-by-phone is working.

### Recommended Fix (next step, requires your approval to switch out of read-only)

**A. Patch the importer pivot rule** (`src/lib/patientImport.ts`):
```ts
if (yy < 100) yy += yy <= (currentYear % 100) ? 2000 : 1900;
// e.g. in 2026: 00–26 → 2000s, 27–99 → 1900s
```

**B. One-off SQL repair for the 5,522 affected rows** — subtract 100 years from any `date_of_birth > CURRENT_DATE`:
```sql
UPDATE patients
SET date_of_birth = date_of_birth - INTERVAL '100 years'
WHERE date_of_birth > CURRENT_DATE;
```
This will restore them to the 20th century (e.g. 2085 → 1985, 2101 → 2001).

**C. Optional secondary cleanup** — flag DOBs before 1900 as suspect (a handful of records like `1789-08-10`) for manual review; these came from typos in your source CSV, not the importer.

Approve and I'll apply A + B (and surface a review list for C).

