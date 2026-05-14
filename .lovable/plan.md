## Goal
Convert Patient ↔ Campaign from a single FK (`patients.campaign_id`) to a many-to-many relationship via a new `patient_campaigns` junction table, and surface it on both sides (Patient profile + Campaign detail), in the New Patient form, ROI metrics, and Reports.

---

## 1. Database migration

Create junction table `public.patient_campaigns`:
- `id` uuid pk
- `patient_id` uuid → patients(id) on delete cascade
- `campaign_id` uuid → campaigns(id) on delete cascade
- `linked_date` timestamptz default now()
- `linked_by` uuid (auth user id, nullable)
- `notes` text nullable
- `created_at` timestamptz default now()
- Unique (patient_id, campaign_id)
- Indexes on patient_id and campaign_id
- Enable RLS with same policy pattern used by `patients`/`campaigns` (authenticated full access — to confirm via existing policies).

Data migration:
- `INSERT INTO patient_campaigns (patient_id, campaign_id) SELECT id, campaign_id FROM patients WHERE campaign_id IS NOT NULL;`
- Drop column `patients.campaign_id` (after verifying inserts).

---

## 2. Patient profile — new "Campaigns" tab
File: `src/pages/PatientDetail.tsx`
- Add a new `<TabsTrigger value="campaigns">` placed immediately after the Attachments trigger, plus a matching `<TabsContent>`.
- Component fetches `patient_campaigns` joined with `campaigns` for this patient.
- Table columns: Campaign Name (link to `/campaigns/:id`) | Type | Status | Date Linked | Linked By (resolve via profiles if available, else show "—").
- `+ Link Campaign` button opens a dialog with a searchable Combobox (Command pattern, like existing PatientCombobox) listing campaigns not yet linked. On select → insert row with `linked_by = auth.uid()`.
- Row-level Unlink button → delete junction row (with confirm).
- No max limit. Invalidate queries: `["patient-campaigns", patientId]` and `["campaign-patients", campaignId]`.

---

## 3. New/Edit Patient form — multi-select campaigns
File: `src/components/patients/PatientFormSheet.tsx`
- Replace the single `<Select>` campaign field (lines ~505–515) with a multi-select control (Popover + Command with checkboxes, mirroring existing multi-select patterns in the project — to confirm by quick grep; otherwise build a small inline one).
- Local state: `selectedCampaignIds: string[]`. On edit, preload from `patient_campaigns`.
- On submit:
  - After patient insert/update succeeds, diff selected vs existing rows in `patient_campaigns`, insert added, delete removed.
  - Use `linked_by = current user id`.

---

## 4. Campaign detail — Linked Patients tab
File: `src/pages/CampaignDetail.tsx`
- Replace `linkedPatients` query: fetch `patient_campaigns` by `campaign_id`, join `patients` for name/phone, expose `linked_date`.
- Replace `linkMutation` to `INSERT INTO patient_campaigns` (campaign_id, patient_id, linked_by).
- Replace `unlinkMutation` to `DELETE FROM patient_campaigns WHERE campaign_id = ? AND patient_id = ?`.
- Update table columns to: Name | Phone | Date Linked | Revenue (per-patient subtotal) — replacing current Joined/Source columns per spec.
- Revenue per row: derive from existing `invoices` query result grouped by `patient_id`; show total in Spend & ROI tab as today.

---

## 5. Spend & ROI metrics
Same file (`CampaignDetail.tsx`):
- "New Patients" = distinct `patient_id` count from `patient_campaigns` for this campaign (already distinct by unique constraint).
- "Revenue" = sum of `invoices.total_amount` for those patient ids (logic preserved).

---

## 6. Reports — Campaigns ROI
Files: `src/lib/reportsCatalog.ts` (and any campaign ROI report builder).
- Where the campaign report joins patients via `campaign_id`, switch to joining via `patient_campaigns` (campaign_id → patient_id).
- Use distinct patient counts to avoid duplicate rows when a patient is in multiple campaigns.
- Verify `reportObjects.ts` for any `patients.campaign_id` field reference and remove/replace.

---

## Technical notes
- All Supabase calls must use `from("patient_campaigns" as any)` until types regenerate post-migration.
- Migration order: (a) create table + RLS, (b) backfill, (c) drop `patients.campaign_id`. Code changes ship after migration is approved so types regenerate cleanly.
- Reuse existing `PatientCombobox` for patient pickers; build a lightweight CampaignCombobox (or inline Command list) for the patient side.
- Keep all UI within existing design tokens; no new colors.

---

## Out of scope / assumptions
- "Linked By" displays the user UUID truncated unless a `profiles` lookup already exists for staff names (will check during implementation; fall back to "—").
- WhatsApp / campaign analytics dashboards outside the listed surfaces are not touched.

Ready to implement on approval.