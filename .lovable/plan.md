

## Plan: User Management Module

### Overview
Create a new "User Management" page with two tabs (Users, Roles & Permissions), add it to the sidebar under Master Data, and back it with two new database tables for roles and role-module permissions.

### Database Changes

**Table 1: `user_roles_config`** — stores the role definitions
- `id` (uuid, PK)
- `name` (text, unique, not null) — e.g. "Admin", "Doctor"
- `description` (text, nullable)
- `is_system` (boolean, default false) — true for pre-built roles
- `created_at` (timestamptz, default now())

**Table 2: `role_module_permissions`** — stores which modules each role can access
- `id` (uuid, PK)
- `role_id` (uuid, references user_roles_config)
- `module_key` (text, not null) — e.g. "dashboard", "patients", "pharmacy"
- `can_view` (boolean, default false)
- `can_edit` (boolean, default false)
- `created_at` (timestamptz, default now())
- Unique constraint on (role_id, module_key)

**Table 3: Add `role_id` column to `doctors` (staff) table** — assigns a role to each staff member
- `role_id` (uuid, nullable, references user_roles_config)

**Seed data** — insert 4 default roles (Admin, Doctor, Receptionist, Pharmacist) with their module permission rows pre-configured per the spec.

RLS: open policies matching existing pattern (anon + authenticated full access).

### Module List for Permissions Grid
The permission grid will list all sidebar modules as toggleable rows:
Dashboard, Patients, Appointments, Procedures, Photos, Pharmacy, Billing, Leave, Assets, Portal Orders, Expenses, Staff, Problem Areas, Reports, Report Builder, Surveys, Services, Vendors, Unit Master, Category Master, Settings, User Management.

Each module row has two checkboxes: "View" and "Edit".

### UI Implementation

**File: `src/pages/UserManagement.tsx`**

**Tab 1 — Users:**
- Fetch staff from `doctors` table (existing staff registry) joined with `user_roles_config` via `role_id`
- Table columns: Name, Email, Phone, Current Role (badge), Status
- Each row has a role dropdown (Select) to assign/change the role — updates `doctors.role_id`

**Tab 2 — Roles & Permissions:**
- Left: role selector dropdown (from `user_roles_config`) + "Add Role" button
- Below: permission grid table — rows = modules, columns = Module Name | View | Edit (checkboxes)
- Save button appears when changes are dirty
- Pre-built roles are editable but not deletable

### Sidebar Change
**File: `src/components/layout/AppSidebar.tsx`**
- Add `{ title: "User Management", url: "/user-management", icon: ShieldCheck }` to `masterDataItems` array after Category Master

### Routing Change
**File: `src/App.tsx`**
- Import and add route: `<Route path="/user-management" element={<UserManagement />} />`

### Files Changed
1. `src/pages/UserManagement.tsx` — new file (main page with both tabs)
2. `src/components/layout/AppSidebar.tsx` — add sidebar link
3. `src/App.tsx` — add route
4. Database migration — create tables, seed default roles and permissions, add `role_id` to doctors

