

## Plan: Expand Permissions to View/Create/Edit/Delete/All + Show Reset Password for All Users

### Overview
Update the permissions system from 2 columns (View, Edit) to 5 columns (View, Create, Edit, Delete, All) matching the reference app. Also show the Reset Password button for all staff users, not just those with `auth_user_id`.

### 1. Database Migration
Add `can_create` and `can_delete` boolean columns to `role_module_permissions`:
```sql
ALTER TABLE public.role_module_permissions 
  ADD COLUMN can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN can_delete boolean NOT NULL DEFAULT false;

-- Update Admin role to have all permissions
UPDATE public.role_module_permissions 
SET can_create = true, can_delete = true 
WHERE role_id = 'a0000000-0000-0000-0000-000000000001';

-- Update Doctor permissions (create/delete for their modules)
UPDATE public.role_module_permissions 
SET can_create = can_edit, can_delete = can_edit 
WHERE role_id = 'a0000000-0000-0000-0000-000000000002';

-- Same for Receptionist and Pharmacist
UPDATE public.role_module_permissions 
SET can_create = can_edit, can_delete = can_edit 
WHERE role_id IN ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004');
```

### 2. Update Permissions UI (`src/pages/UserManagement.tsx`)
- Change `PermMap` type to include `can_create`, `can_delete`
- Add "Create", "Delete", and "All" column headers to the permissions table
- Add checkboxes for each new field
- "All" checkbox toggles all 4 permissions (view/create/edit/delete) for a module
- Update `togglePerm` logic: unchecking View unchecks all; "All" checks/unchecks everything
- Show info banner for Admin system role: "System Administrator has all permissions granted automatically and cannot be modified."
- Update `savePerms` mutation to include `can_create` and `can_delete`

### 3. Update Auth Context (`src/hooks/useAuth.tsx`)
- Expand `PermMap` type to include `can_create` and `can_delete` fields
- Fetch and expose the new permission fields

### 4. Update `useCanEdit` Hook
- Create additional hooks or expand to cover `can_create` and `can_delete` checks

### 5. Reset Password for All Users
- Remove the `s.auth_user_id` condition — show the Reset Password button for every staff user
- If user has no `auth_user_id`, the edge function will return an appropriate error

### Files Changed
1. Database migration — add `can_create`, `can_delete` columns
2. `src/pages/UserManagement.tsx` — 5-column permissions table, All toggle, reset button for all
3. `src/hooks/useAuth.tsx` — expand PermMap type
4. `src/hooks/useCanEdit.ts` — expand for create/delete checks

