

## Plan: Bulk Import for Procedures (Excel/CSV)

Mirror the Patients import flow for the Procedures module — same 4-step dialog (Upload → Map → Preview → Import), same UX, same validation pattern.

### Where
- New button on `src/pages/Procedures.tsx` header → "Import Procedures"
- New component: `src/components/procedures/ImportProceduresDialog.tsx` (cloned/adapted from `ImportPatientsDialog.tsx`)
- New helper: `src/lib/procedureImport.ts` (cloned/adapted from `patientImport.ts`)

### Procedure fields available for mapping
Based on the `procedures` table (and patterns in `ProcedureFormDialog`):

| Field | Required | Notes |
|---|---|---|
| `patient_phone` | ✅ Yes | Used to look up `patient_id` |
| `service_name` | ✅ Yes | Free text — matches Service Master where possible |
| `procedure_date` | ✅ Yes | Parsed via same date logic as patients (dd/mm/yyyy, ISO, Excel serial) |
| `staff_name` | optional | Looked up against `staff` table by full name |
| `status` | optional | Defaults to `Completed` if blank |
| `chief_complaint` | optional | |
| `diagnosis` | optional | |
| `treatment_notes` | optional | |
| `prescription` | optional | |
| `follow_up_date` | optional | |
| `cost` | optional | Numeric |
| `notes` | optional | |

Dropdown shows friendly labels (e.g., "Patient Phone", "Service Name") — same `FIELD_LABELS` pattern as Patients.

### Flow

**Step 1 – Upload**
Drag/drop or pick `.csv`, `.xlsx`, `.xls`. Parse with `xlsx` (already installed).

**Step 2 – Mapping**
- Every column starts as **— Skip —** (no auto-detection — matches the corrected Patients behavior).
- User maps each file column to a procedure field from the dropdown.
- Required fields flagged with `*`. "Preview" button enables once all 3 required fields are mapped.
- Already-mapped fields disabled in other rows (no duplicate mappings).

**Step 3 – Preview**
- Show table of parsed rows with status badge (OK / Error).
- Validation rules (only block these):
  - Missing `patient_phone`
  - Missing `service_name`
  - Missing/invalid `procedure_date`
  - `patient_phone` not found in `patients` table → error "Patient not found"
- All other fields optional. Duplicates allowed. Unknown staff names → imported with `staff_id = null` (warning shown, not blocking).
- Summary: `X valid, Y errors`.

**Step 4 – Import**
- Resolve `patient_id` from phone (case/whitespace-normalized lookup).
- Resolve `staff_id` from name (best-effort, optional).
- Bulk insert in batches of 100 to `procedures`.
- Toast on success; surface DB errors to console + toast on failure.
- Invalidate `["procedures"]` query so the list refreshes.

### UI consistency
- Same dialog shell, stepper, table styling, button labels, and copy as Patients import.
- Same mobile-friendly layout.
- Help text at top of Step 2: *"Map each file column to a procedure field. Required: Patient Phone, Service Name, Procedure Date."*

### Files
- **New**: `src/lib/procedureImport.ts`
- **New**: `src/components/procedures/ImportProceduresDialog.tsx`
- **Modified**: `src/pages/Procedures.tsx` (add "Import Procedures" button next to "New Procedure", wire dialog open state)

### Out of scope
- Creating new patients on-the-fly when phone not found (rows are flagged as errors instead — keeps imports safe).
- Service Master auto-creation for unknown service names (stored as free text on the procedure, same as manual entry).
- Photo/attachment import.

