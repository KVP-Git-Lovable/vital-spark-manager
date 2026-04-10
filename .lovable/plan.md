

## Plan: Doctor Master Module with Dynamic Dropdowns

### Overview

Create a dedicated `doctors` table, a Doctor Master CRUD page under Master Data in the sidebar, and replace all doctor/staff dropdowns across the app to fetch from this new table.

### 1. Database Migration

**New table: `doctors`**
```sql
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialization text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
-- Open RLS policies for anon + authenticated (matching existing pattern)
```

### 2. Sidebar Update

**File: `src/components/layout/AppSidebar.tsx`**

Add `{ title: "Doctor Master", url: "/doctors", icon: UserCog }` to the `masterDataItems` array (using a suitable icon like `UserRound` or `Stethoscope`).

### 3. Doctor Master Page

**New file: `src/pages/Doctors.tsx`**

- Table listing all doctors with Name, Specialization, Phone, Email, Status columns
- "Add Doctor" button opens a dialog with the 5 fields
- Inline edit and delete capabilities
- Status toggle (Active/Inactive)

### 4. Route Registration

**File: `src/App.tsx`**

Add route: `<Route path="/doctors" element={<Doctors />} />`

### 5. Replace All Doctor Dropdowns

Currently, doctor dropdowns query `from("staff").select(...)` and display `Dr. {first_name}`. These will be replaced to query `from("doctors").select(...)` filtered by `status = 'Active'`, displaying the `name` field.

Files affected:
- **`src/pages/Appointments.tsx`** — staff-list query (~line 113), staffId state, create form dropdown, inline edit dropdown, doctor legend/filter, color map
- **`src/components/appointments/AppointmentDetailSheet.tsx`** — staff-list query (~line 280), edit staff dropdown
- **`src/components/procedures/ProcedureFormDialog.tsx`** — staff-list query (~line 70), doctor dropdown
- **`src/pages/Index.tsx`** — dashboard-staff query (~line 74), staff filter dropdown
- **`src/pages/Billing.tsx`** — doctor filter derived from invoices>appointments>staff join
- **`src/pages/portal/Portal.tsx`** — portal-staff query (~line 175) filtering by role "Doctor"
- **`supabase/functions/portal-bot/index.ts`** — `list_doctors` and `check_doctor_availability` tool functions

In each file:
- Change the query from `supabase.from("staff")` to `supabase.from("doctors")`
- Change `staff_id` references in the UI dropdown values to use `doctor.id`
- Change display from `Dr. {first_name}` to `doctor.name`
- The `appointments.staff_id` column continues to store the doctor UUID (now from the doctors table instead of staff table)

### 6. Portal Bot Edge Function

**File: `supabase/functions/portal-bot/index.ts`**

Update `list_doctors` to query `doctors` table instead of `staff`. Update `check_doctor_availability` to get doctor info from `doctors` table.

### Technical Notes

- The `appointments.staff_id` column remains unchanged in schema — it will now store a `doctors.id` UUID instead of a `staff.id` UUID. No FK constraint exists so this is safe.
- Existing appointment records that reference old staff IDs will still work but won't resolve to a doctor name in the new lookup. This is acceptable for historical data.
- The `staff` table and Staff Management page remain untouched — they serve a different purpose (HR, attendance, leave).

### Files Summary

| Action | File |
|--------|------|
| Migration | Create `doctors` table |
| Create | `src/pages/Doctors.tsx` |
| Modify | `src/components/layout/AppSidebar.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/pages/Appointments.tsx` |
| Modify | `src/components/appointments/AppointmentDetailSheet.tsx` |
| Modify | `src/components/procedures/ProcedureFormDialog.tsx` |
| Modify | `src/pages/Index.tsx` |
| Modify | `src/pages/Billing.tsx` |
| Modify | `src/pages/portal/Portal.tsx` |
| Modify | `supabase/functions/portal-bot/index.ts` |

