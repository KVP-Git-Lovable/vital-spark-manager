

## Plan: Add "Create User" Modal to User Management

### Overview
Add a "+ Create User" button next to the search bar in the Users tab. It opens a modal with Personal Info, Access Info, and Security sections. On save, the staff member's `role_id` is updated and a success toast is shown.

### Scope Limitation
Since this project uses Lovable Cloud authentication and we cannot create auth users programmatically from the client side (no admin API access), the "Create User" flow will:
- Link an existing staff member (or create a new staff record) with a role assignment
- Store the password preference and force-change flag for future backend integration
- The actual auth account creation and email sending would require a backend function (edge function) — this plan includes creating that edge function

### Database Changes
**Add columns to `staff` table:**
- `auth_user_id` (uuid, nullable) — links to the auth user once created
- `force_password_change` (boolean, default true)

### Edge Function: `create-user-account`
Creates an auth user via Supabase Admin API (service role), updates the staff record with the auth user ID and role, and optionally sends credentials via email. Accepts: `staff_id`, `email`, `password` (optional — auto-generate if not provided), `role_id`, `full_name`, `phone`, `send_email`, `force_password_change`.

### UI Changes — `src/pages/UserManagement.tsx`

**New state & dialog:**
- `createUserOpen` state toggle
- Modal with three sections:

**Personal Info:**
- "Link to Staff Member" — searchable Select dropdown from staff query. On select, auto-fills name/email/phone. Toggle to allow manual entry if no match.
- Full Name (text, required)
- Email (text, required)
- Phone (text, optional)

**Access Info:**
- Role dropdown (from `user_roles_config`)
- Status: Active/Inactive toggle (default Active)

**Security:**
- Password mode toggle: "Auto-generate & send via email" (default) / "Set manually"
- If manual: password + confirm password fields
- Force password change on first login: checkbox (default ON)

**On save:**
- Call the `create-user-account` edge function
- Update staff record's `role_id`
- Show success toast
- Refresh the staff list

### Files Changed
1. Database migration — add `auth_user_id` and `force_password_change` to `staff`
2. `supabase/functions/create-user-account/index.ts` — new edge function
3. `src/pages/UserManagement.tsx` — add Create User button and modal

