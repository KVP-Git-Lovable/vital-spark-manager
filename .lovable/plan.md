## Goal

Pre-create 4 working reports in the Report Builder:
1. Daily Billing by Doctor (Financial Reports)
2. Monthly Revenue by Doctor (Financial Reports)
3. Revenue by Payment Mode (Financial Reports)
4. Doctor Feedback Score (Clinical Reports)

The current builder can't render these end-to-end, so we extend the catalog + preview engine first, then seed the reports.

---

## Part 1 — Extend the catalog (`src/lib/reportObjects.ts`)

Add the missing fields, relations, and a new object:

- **invoices**: add `doctor_id` (text/uuid) and synthetic `doctor_name` (text); add relation `{ objectKey: "staff", foreignKey: "doctor_id", label: "Doctor" }`. Also expose `appointments` relation via `appointment_id`.
- **appointments**: add `staff_id` (text) and synthetic `doctor_name` (text); add relation `{ objectKey: "staff", foreignKey: "staff_id", label: "Doctor" }`.
- **staff**: add a synthetic `full_name` field (computed from `first_name` + `last_name`).
- **NEW object `patient_feedback`** (table `patient_feedback`) with fields: `id`, `appointment_id`, `patient_id`, `patient_name`, `nps_score` (number), `service_rating` (number), `created_at`. Relations: `appointments` via `appointment_id`, `patients` via `patient_id`.

## Part 2 — Aggregation support in `ReportPreview.tsx`

The reports need SUM / AVG / COUNT / COUNT DISTINCT, which today only exist for `chart_type === "number"`. Add real measure aggregation:

- Introduce a lightweight column-metadata convention: a field key prefix `agg:` (e.g. `invoices.agg:sum_total_amount`, `invoices.agg:count`, `invoices.agg:count_distinct_patient_id`, `patient_feedback.agg:avg_nps_score`, `patient_feedback.agg:avg_service_rating`). The catalog declares these as virtual fields with `type: "number"` and a parsed `{ fn, source }` descriptor.
- In `ReportPreview.fetchData`, when an `agg:` column is referenced, fetch the underlying real column instead and compute the aggregate per group during render.
- In the table renderer: when `groupRows` is set, render one row per group key and compute each `agg:` column. Existing non-agg columns render as the group's first value (or blank if mismatched).
- In the chart renderer: when `valueKey` resolves to an `agg:` column, use the aggregated value instead of `count` / naive `sum`.
- Synthetic `doctor_name` resolver: when columns/groups reference `*.doctor_name` and the underlying FK (`doctor_id` / `staff_id`) is present, embed `staff(first_name,last_name)` in the select and flatten into `doctor_name` on the row. Works for both primary side (invoices, appointments) and related side (appointments embedded under patient_feedback).
- Add a `Month` virtual field (`...agg:month_<dateField>` or simpler `created_at_month`) that buckets dates as `YYYY-MM` so we can group by month without hand-rolling SQL.

## Part 3 — Seed the 4 reports

Use a single `INSERT` on `saved_reports` that first deletes any existing rows with matching names in the target folders (replace-if-name-matches). Folder IDs from DB:
- Financial Reports: `ab900000-0000-0000-0000-000000000002`
- Clinical Reports:  `ab900000-0000-0000-0000-000000000001`

### 1. Daily Billing by Doctor
- primary: `invoices`, related: `appointments`
- columns: `invoices.doctor_name`, `invoices.patient_name`, `invoices.created_at`, `invoices.total_amount`, `invoices.payment_mode`, `invoices.status`
- filter: `invoices.created_at gte today 00:00` (stored as a relative filter value `__today__` handled in preview, or absolute ISO date generated at seed time — we'll use a `__today__` token resolved at query time)
- chart: `table`
- folder: Financial Reports

### 2. Monthly Revenue by Doctor
- primary: `invoices`, related: `appointments`
- group_rows: `invoices.doctor_name`, `invoices.created_at_month`
- columns: `invoices.doctor_name`, `invoices.created_at_month`, `invoices.agg:sum_total_amount`, `invoices.agg:count_distinct_patient_id`
- chart: `bar` (X = doctor_name via groupRows[0], Y = sum_total_amount)
- folder: Financial Reports

### 3. Revenue by Payment Mode
- primary: `invoices`
- group_rows: `invoices.payment_mode`
- columns: `invoices.payment_mode`, `invoices.agg:sum_total_amount`, `invoices.agg:count`, `invoices.created_at_month`
- chart: `doughnut`
- folder: Financial Reports

### 4. Doctor Feedback Score
- primary: `patient_feedback`, related: `appointments`
- group_rows: `appointments.doctor_name`, `patient_feedback.created_at_month`
- columns: `appointments.doctor_name`, `patient_feedback.agg:avg_nps_score`, `patient_feedback.agg:avg_service_rating`, `patient_feedback.agg:count`, `patient_feedback.created_at_month`
- chart: `bar`
- folder: Clinical Reports

## Part 4 — Filter token `__today__`

Add a tiny resolver in `ReportPreview` so a stored filter value of `__today__` becomes "start of today in the user's local time" at query time. Keeps the Daily Billing report rolling without re-seeding.

---

## Files touched

- `src/lib/reportObjects.ts` — new fields, relations, `patient_feedback` object, virtual `agg:` / `_month` / `doctor_name` fields
- `src/components/reports/ReportPreview.tsx` — aggregation engine, doctor_name auto-embed, month bucketing, `__today__` token
- Migration / insert via `supabase--insert` — seed 4 `saved_reports` rows (delete-by-name then insert)

## Out of scope

- No DB schema changes (all required columns already exist).
- No changes to the Report Builder UI itself — the new virtual fields appear in its existing field picker because they're declared in `reportObjects.ts`.
