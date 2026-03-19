import type { UserRole } from "@/types/database";

// Route permissions per role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["/dashboard", "/as", "/se"],
  as_staff: ["/dashboard", "/as"],
  se_staff: ["/dashboard", "/se"],
};

export function canAccess(role: UserRole, pathname: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  return allowed.some((prefix) => pathname.startsWith(prefix));
}

export function getDefaultRedirect(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "as_staff":
      return "/as/customers";
    case "se_staff":
      return "/se/pipeline";
    default:
      return "/dashboard";
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  as_staff: "AS Staff",
  se_staff: "SE Staff",
};
