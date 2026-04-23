

## Plan: Fix 1000-row cap and phone-as-name issue

### Diagnosis

**Issue 1 — "Showing 1000 of 1000 patients"**
Database actually has **25,019 patients**. Supabase caps every `.select()` at 1000 rows by default. Every list query in the app (Patients, Appointments dropdown, Billing, Procedures, Photos, etc.) is hitting that cap, so the UI only ever sees the first 1000.

**Issue 2 — Patient dropdown shows phone numbers instead of names**
The dropdown code is correct (`{p.first_name} {p.last_name}`). The problem is the underlying data: the Salesforce-style CSV import wrote the phone number into the `first_name` column for those rows (or `first_name` is empty and the rendered string falls back to phone elsewhere). We need to (a) verify with a DB scan and (b) repair those rows by swapping the phone-shaped value out of `first_name` and using the actual name from the source CSV when available.

### Fix

**Part A — Remove the 1000-row cap (permanent, all list queries)**

Add a small paginated fetch helper and replace the unbounded `.select()` calls in these files:
- `src/pages/Patients.tsx` (main list — fetch all 25k)
- `src/pages/Appointments.tsx` (patient + staff dropdowns + appointments list)
- `src/pages/Billing.tsx` (patient dropdown)
- `src/pages/Photos.tsx` (patient dropdown)
- `src/components/procedures/ProcedureFormDialog.tsx` (patient dropdown)
- `src/components/patients/PatientFormSheet.tsx` (family lookup)

Helper pattern (in `src/lib/supabasePaginate.ts`, new file):
```ts
export async function fetchAll<T>(builder: (from: number, to: number) => any) {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
```

**Part B — Convert big dropdowns to a searchable combobox**

Rendering 25k `<SelectItem>`s will freeze the browser. Replace the plain `Select` patient pickers in Appointments / Billing / Photos / Procedures with the existing searchable combobox pattern (same look as `StaffCombobox` / `VendorCombobox`, with virtualized command list and async search by name/phone). New component: `src/components/patients/PatientCombobox.tsx`.

**Part C — Repair patient rows where `first_name` is a phone number**

One-time SQL cleanup (safe, reversible):
1. Identify rows: `WHERE first_name ~ '^[0-9+\-\s()]{7,}$'` — first_name is digits/symbols only.
2. Report count to user before changing anything.
3. For each such row, if `phone` is empty, copy the digits into `phone`. Then set `first_name` to a sensible placeholder derived from `email` local-part (capitalized) or `'Patient'` if no email. Preserve original value in a new `notes` append (`"Imported name: <original>"`) so nothing is lost.
4. Run as a migration so it's auditable.

**Part D — Prevent regression in importer**

Add a validation in `src/lib/patientImport.ts`: if `first_name` after normalization matches a phone-like regex AND `phone` is empty, swap it; if `phone` is also present, flag the row as an error in the preview ("First name looks like a phone number").

### Deliverables
1. Patients list shows all 25,019 patients (with pagination/virtual scrolling — see note below).
2. Appointment / Billing / Photo / Procedure dropdowns show searchable names, not phone numbers, across all 25k.
3. DB cleanup report: how many rows had phone-as-name, what each was changed to.
4. Importer guards against the same mistake going forward.

### Note on rendering 25k rows
For the **Patients page table** itself, also add simple client-side pagination (50 per page) — rendering 25k table rows at once is slow. Search stays global (filters all 25k).

### Files
- New: `src/lib/supabasePaginate.ts`, `src/components/patients/PatientCombobox.tsx`, one DB migration for the cleanup.
- Modified: `src/pages/Patients.tsx`, `src/pages/Appointments.tsx`, `src/pages/Billing.tsx`, `src/pages/Photos.tsx`, `src/components/procedures/ProcedureFormDialog.tsx`, `src/components/patients/PatientFormSheet.tsx`, `src/lib/patientImport.ts`.

### Out of scope
- No schema changes to `patients` table.
- No deletion of any patient records — cleanup only edits `first_name` / `phone` / `notes`.

