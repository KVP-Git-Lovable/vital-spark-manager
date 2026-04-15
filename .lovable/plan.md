

## Plan: User Profile Avatar, Role-Based Access Control & Admin Password Reset

### Overview
Replace the static "DC" avatar with a dynamic user profile dropdown, enforce role-based access control (RBAC) across the app after login, and add admin password reset for other users.

### 1. Extend Auth Context (`src/hooks/useAuth.tsx`)

Add staff profile loading alongside the existing patient profile logic:
- After auth session is established, query `staff` table by `auth_user_id` to get: `id`, `first_name`, `last_name`, `email`, `phone`, `role_id`, and join `user_roles_config(id, name)`
- Then query `role_module_permissions` for that `role_id` to get the full permissions map
- Expose new fields in context: `staffProfile` (name, email, phone, role name, initials), `permissions` (map of module_key → { can_view, can_edit }), `isAdmin` (boolean)

### 2. User Avatar Dropdown (`src/components/layout/AppLayout.tsx`)

Replace the hardcoded "DC" div with a `Popover` or `DropdownMenu`:
- **Trigger**: Circle avatar showing logged-in user's initials (from staffProfile or user email fallback)
- **Dropdown content**:
  - Profile header: initials avatar, full name, role badge, email (non-clickable)
  - "My Profile" → navigates to `/profile` (new page)
  - "Log Out" → opens AlertDialog confirmation → calls `signOut()` → redirects to `/login`

### 3. My Profile Page (`src/pages/Profile.tsx`)

New page at `/profile` route with:
- Editable fields: Name, Email, Phone
- Change Password section (current password + new password + confirm)
- Save updates staff record and calls `supabase.auth.updateUser()` for password changes

### 4. Role-Based Sidebar Filtering (`src/components/layout/AppSidebar.tsx`)

- Import `useAuth` to get `permissions` and `isAdmin`
- Map each sidebar item to its module_key (e.g., `{ url: "/patients", moduleKey: "patients" }`)
- Filter out items where `can_view` is false (unless user is Admin)
- Apply same filtering to Master Data items and Survey sub-items

### 5. Route Guard / Access Denied (`src/App.tsx`)

- Create a `<ProtectedRoute moduleKey="patients">` wrapper component
- Checks permissions from auth context; if no `can_view`, renders an "Access Denied" page
- Wrap each clinic route with the appropriate moduleKey
- Admin bypasses all checks

### 6. Edit Permission Enforcement

- Create a `useCanEdit(moduleKey)` hook that returns boolean
- Components that have Create/Edit/Delete buttons check this hook and disable/hide buttons when `can_edit` is false

### 7. Admin Password Reset in User Management (`src/pages/UserManagement.tsx`)

- Add a "Reset Password" button (key icon) in each user row, visible only to Admin users
- Clicking opens a dialog with two options: auto-generate or set manually (similar to Create User)
- Calls a new action in the `create-user-account` edge function (or a new endpoint) that uses `supabaseAdmin.auth.admin.updateUserById()` to set the new password

### 8. Edge Function Update (`supabase/functions/create-user-account/index.ts`)

Add a `reset_password` action path:
- Accepts `auth_user_id` and `password` (optional, auto-generate if not provided)
- Calls `supabaseAdmin.auth.admin.updateUserById(auth_user_id, { password })`
- Returns success/failure

### Module Key Mapping
```text
URL Path          → Module Key
/                 → dashboard
/patients         → patients
/appointments     → appointments
/procedures       → procedures
/photos           → photos
/pharma           → pharmacy
/billing          → billing
/leave            → leave
/assets           → assets
/orders           → portal_orders
/expenses         → expenses
/staff            → staff
/problem-areas    → problem_areas
/reports          → reports
/report-builder   → report_builder
/survey-templates → surveys
/all-surveys      → surveys
/services         → services
/vendors          → vendors
/unit-master      → unit_master
/category-master  → category_master
/settings         → settings
/user-management  → user_management
```

### Files Changed
1. `src/hooks/useAuth.tsx` — add staff profile, permissions, isAdmin to context
2. `src/components/layout/AppLayout.tsx` — avatar dropdown with profile header, My Profile link, Log Out
3. `src/pages/Profile.tsx` — new profile edit page
4. `src/components/layout/AppSidebar.tsx` — filter sidebar items by permissions
5. `src/App.tsx` — add ProtectedRoute wrapper, /profile route
6. `src/pages/UserManagement.tsx` — add Reset Password button per user row
7. `supabase/functions/create-user-account/index.ts` — add reset_password action
8. `src/pages/AccessDenied.tsx` — new "Access Denied" page
9. `src/hooks/useCanEdit.ts` — new hook for edit permission checks

