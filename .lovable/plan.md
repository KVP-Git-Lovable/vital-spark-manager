

## Plan: Vendor Master Module, Sidebar Reorganization, and Global Vendor Dropdown

### Overview

Three changes: (1) reorganize the sidebar with a "Master Data" group, (2) build a full Vendor Master page with parent-child structure (vendor + multiple contacts), and (3) replace plain text vendor inputs in Expenses and Inward Stock with searchable dropdowns.

Also fixes the two existing build errors in `Appointments.tsx` and `Orders.tsx` caused by `Record<string, any>` type mismatches.

### 1. Database Changes

**New table: `vendor_contacts`**
```sql
CREATE TABLE public.vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
-- Open RLS policies for anon + authenticated (matching existing pattern)
```

**Add `website` column to `vendors` table:**
```sql
ALTER TABLE public.vendors ADD COLUMN website text;
```

### 2. Sidebar Reorganization

**File: `src/components/layout/AppSidebar.tsx`**

- Split `mainItems` into two arrays: core menu items and a new `masterDataItems` array containing "Service Master" (moved from main) and "Vendor Master" (new, url `/vendors`).
- Add a second `SidebarGroup` labeled "Master Data" between the main menu and settings.

### 3. Vendor Master Page

**New file: `src/pages/Vendors.tsx`**

- List view showing all vendors in a table with name, GST, city, and contact count.
- Click a vendor row to open a detail sheet.
- "Add Vendor" button opens a dialog with parent fields: Name, GST Number, Office Address (textarea), Website.
- Below the parent form, a "Contacts" section with dynamic rows (Contact Name, Phone, Email) and an "+ Add Contact" button.
- On save: insert into `vendors` table, then bulk insert contacts into `vendor_contacts`.
- Detail sheet shows vendor info + contacts list, with edit and delete capabilities.

### 4. Global Vendor Dropdown

**New shared component: `src/components/shared/VendorCombobox.tsx`**

A reusable searchable combobox (using existing Command/Popover components) that fetches from the `vendors` table. Props: `value`, `onChange`, `placeholder`.

**File: `src/pages/Expenses.tsx`** (line ~618-621)
- Replace the vendor `<Input>` with `<VendorCombobox>` that sets `vendor_name` to the selected vendor's name.

**File: `src/pages/Pharma.tsx`** (line ~310) and **`src/components/pharma/PharmaDetailSheet.tsx`** (line ~482)
- Replace the supplier `<Input>` with `<VendorCombobox>` that sets the `supplier` field.

### 5. Build Error Fixes

**File: `src/pages/Appointments.tsx`** (line ~356)
- Change `async (data: Record<string, any>)` to use a properly typed object or cast with `as any` to satisfy the strict Supabase types.

**File: `src/pages/Orders.tsx`** (line ~150)
- Same fix: type the `updates` parameter explicitly or use `as any` cast.

### 6. Route Registration

**File: `src/App.tsx`**
- Add route: `<Route path="/vendors" element={<Vendors />} />`

### Technical Details

- The `VendorCombobox` uses the existing `Command`, `CommandInput`, `CommandItem`, `Popover` UI primitives already in the project.
- Vendor contacts are fetched alongside the vendor in the detail view using a second query on `vendor_contacts` filtered by `vendor_id`.
- The existing `VendorFormDialog.tsx` (used in Assets) will remain as-is since it serves a different context; the new Vendors page has its own form.

### Files Summary

| Action | File |
|--------|------|
| Create | `src/pages/Vendors.tsx` |
| Create | `src/components/shared/VendorCombobox.tsx` |
| Modify | `src/components/layout/AppSidebar.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/pages/Expenses.tsx` |
| Modify | `src/pages/Pharma.tsx` |
| Modify | `src/components/pharma/PharmaDetailSheet.tsx` |
| Modify | `src/pages/Appointments.tsx` |
| Modify | `src/pages/Orders.tsx` |
| Migration | Add `vendor_contacts` table + `website` column on `vendors` |

