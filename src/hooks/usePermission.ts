import { useAuth } from "../lib/auth";
import { hasPermission } from "../lib/permissions";

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  // Free-tier users have no server role — default to full manager permissions
  const role = (user as { role?: string } | null)?.role ?? "manager";
  return hasPermission(role, permission);
}
