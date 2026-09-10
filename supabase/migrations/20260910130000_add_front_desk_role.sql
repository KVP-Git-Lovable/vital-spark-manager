-- A Front Desk role, so the front-desk account no longer needs to be an Admin.
--
-- Why this exists: isAdmin (role name = 'admin') bypasses every module permission
-- check in the app, so while the front-desk account held the Admin role it could
-- always reach Report Builder and Dashboards and read a month or a year there,
-- regardless of the day-at-a-time limit on the Reports module. Permissions only
-- start applying once the account is off Admin.

-- 1. Dashboards gets its own module key ------------------------------------------
-- It used to be gated on 'reports', which makes "daily reports but no dashboards"
-- impossible to express. Seed the new key from each role's existing 'reports' row so
-- no role's current access changes; a role with no 'reports' row stays without both,
-- exactly as before.

INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete)
SELECT role_id, 'dashboards', can_view, can_create, can_edit, can_delete
  FROM public.role_module_permissions
 WHERE module_key = 'reports'
ON CONFLICT (role_id, module_key) DO NOTHING;

-- 2. The role ---------------------------------------------------------------------
-- data_scope stays 'all': front desk works across every doctor.

INSERT INTO public.user_roles_config (name, description, is_system, data_scope)
VALUES (
  'Front Desk',
  'Front-desk / clinic manager. Full day-to-day access across all doctors; reporting is limited to one day at a time.',
  false,
  'all'
)
ON CONFLICT (name) DO UPDATE SET data_scope = 'all';

-- 3. Its permissions ---------------------------------------------------------------
-- Everything the account needs day to day, at full create/edit/delete. Deliberately
-- excluded, and each one is a checkbox away in User Management if that is wrong:
--   report_builder  - would allow building an arbitrary query over any table, which
--                     is precisely the monthly/annual view the day limit prevents
--   dashboards      - same, via pinned monthly charts
--   user_management - an account that can edit roles can lift its own restriction

DO $$
DECLARE
  _role_id uuid;
  _granted text[] := ARRAY[
    'dashboard', 'patients', 'appointments', 'procedures', 'photos', 'pharmacy',
    'billing', 'leave', 'assets', 'portal_orders', 'campaigns', 'expenses', 'staff',
    'problem_areas', 'reports', 'surveys', 'services', 'vendors', 'unit_master',
    'category_master', 'settings'
  ];
  _denied text[] := ARRAY['report_builder', 'dashboards', 'user_management'];
  _k text;
BEGIN
  SELECT id INTO _role_id FROM public.user_roles_config WHERE name = 'Front Desk';

  FOREACH _k IN ARRAY _granted LOOP
    INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete)
    VALUES (_role_id, _k, true, true, true, true)
    ON CONFLICT (role_id, module_key)
    DO UPDATE SET can_view = true, can_create = true, can_edit = true, can_delete = true;
  END LOOP;

  FOREACH _k IN ARRAY _denied LOOP
    INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete)
    VALUES (_role_id, _k, false, false, false, false)
    ON CONFLICT (role_id, module_key)
    DO UPDATE SET can_view = false, can_create = false, can_edit = false, can_delete = false;
  END LOOP;
END $$;

-- 4. Move the front-desk account onto it -------------------------------------------
-- Only this account, matched on the address it signs in with. The day-at-a-time
-- reporting limit is set separately on the staff row and is unaffected by this.

UPDATE public.staff
   SET role_id = (SELECT id FROM public.user_roles_config WHERE name = 'Front Desk')
 WHERE lower(email) = 'theskinclinic30@gmail.com';
