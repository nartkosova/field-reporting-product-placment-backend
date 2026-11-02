export interface PermissionUser {
  role?: string | null;
  // mysql2 returns BOOLEAN columns as 0 or 1.
  field_access?: boolean | number | null;
}

// Roles that can hold markets. Viewers only read reports.
export const ASSIGNABLE_ROLES = ["admin", "employee"];

export const isAdmin = (user?: PermissionUser | null): boolean =>
  user?.role === "admin";

// Admins see and use every market, whatever is assigned to them.
export const hasAllStoresAccess = isAdmin;

export const canHoldStores = (role?: string | null): boolean =>
  ASSIGNABLE_ROLES.includes(role ?? "");

// An admin with field_access stays an admin, and can also use everything an
// employee can (check-ins, PPL, photo uploads).
export const hasFieldAccess = (user?: PermissionUser | null): boolean =>
  user?.role === "employee" || (isAdmin(user) && Boolean(user?.field_access));

export const hasRoleAccess = (
  user: PermissionUser | null | undefined,
  roles: string[]
): boolean =>
  roles.includes(user?.role ?? "") ||
  (roles.includes("employee") && hasFieldAccess(user));

// Field admins work through the employee day flow, so their day picker must
// only show their own days.
export const canManageAllWorkDays = (user?: PermissionUser | null): boolean =>
  isAdmin(user) && !hasFieldAccess(user);
