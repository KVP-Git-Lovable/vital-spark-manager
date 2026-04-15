import { useAuth } from "@/hooks/useAuth";

export function useCanEdit(moduleKey: string): boolean {
  const { isAdmin, permissions } = useAuth();
  if (isAdmin) return true;
  return permissions[moduleKey]?.can_edit ?? false;
}
