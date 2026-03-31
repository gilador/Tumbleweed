import type { UserRole } from "@tumbleweed/shared";

// Maps role to allowed UI actions. Mirrors the server-side RBAC matrix.
const rolePermissions: Record<UserRole, Set<string>> = {
  manager: new Set([
    "team:read",
    "team:write",
    "users:manage",
    "schedule:read",
    "schedule:write",
    "schedule:publish",
    "availability:own",
    "availability:all",
    "constraints:write",
    "billing:manage",
    "co-manager:invite",
  ]),
  "co-manager": new Set([
    "team:read",
    "users:manage",
    "schedule:read",
    "schedule:write",
    "schedule:publish",
    "availability:own",
    "availability:all",
    "constraints:write",
  ]),
  staff: new Set([
    "team:read",
    "schedule:read",
    "availability:own",
  ]),
};

export function hasPermission(role: UserRole | string | undefined, permission: string): boolean {
  if (!role) return false;
  return rolePermissions[role as UserRole]?.has(permission) ?? false;
}
