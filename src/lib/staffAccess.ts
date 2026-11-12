// Who may open a page of the clinic app. The database enforces the same rule
// (signed_in_must_be_staff), so this only decides what screen to show.
export type StaffAccess = "sign_in" | "deactivated" | "not_staff" | "allowed" | "denied";

export function staffAccess(input: {
  hasSession: boolean;
  isStaff: boolean;
  staffDeactivated: boolean;
  isAdmin: boolean;
  permissions: Record<string, { can_view?: boolean } | undefined>;
  moduleKey: string;
}): StaffAccess {
  if (!input.hasSession) return "sign_in";
  if (input.staffDeactivated) return "deactivated";
  // A signed-in account with no staff record (e.g. a patient) never gets in.
  if (!input.isStaff) return "not_staff";
  return canViewModule(input) ? "allowed" : "denied";
}

/**
 * Whether this person may see a module at all - the one answer behind both the
 * route guard above and the left-hand menu.
 *
 * It is a separate exported function, rather than the three lines inlined in
 * each place, because they were not the same three lines: AppSidebar's canView
 * was `return true` with a note saying "for now", so the menu offered all 47
 * pages to everyone and the route guard then refused most of them. A menu that
 * disagrees with the guard is worse than no menu gating at all - it sends
 * people to Access Denied and teaches them the app is broken.
 *
 * Two conventions it has to keep, both relied on elsewhere:
 *
 *   - An admin's permission map is EMPTY by design (useAuth sets `{}` and
 *     returns early), so admin is checked first and never through the map.
 *   - A non-admin with an empty map keeps full access. That is what a role
 *     nobody has configured yet looks like, and locking those people out of
 *     their own clinic on an upgrade would be the worse failure.
 */
export function canViewModule(input: {
  isAdmin: boolean;
  permissions: Record<string, { can_view?: boolean } | undefined>;
  moduleKey: string;
}): boolean {
  if (input.isAdmin) return true;
  if (input.permissions[input.moduleKey]?.can_view) return true;
  return Object.keys(input.permissions).length === 0;
}
