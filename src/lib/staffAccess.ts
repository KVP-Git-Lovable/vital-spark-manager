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
  if (input.isAdmin) return "allowed";
  if (input.permissions[input.moduleKey]?.can_view) return "allowed";
  // A staff member whose role has no permission rows configured yet keeps access.
  if (Object.keys(input.permissions).length === 0) return "allowed";
  return "denied";
}
