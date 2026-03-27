import type { UserRole } from "@/types/database";

// Route permissions per role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["/dashboard", "/as", "/se", "/settings"],
  // Legacy AS role (backward compatibility): broad AS access
  as_staff: ["/dashboard", "/as"],
  // New split roles
  as_service: [
    "/dashboard",
    "/as/customers",
    "/as/service-request",
    "/as/service-monitor",
    "/as/calibration-proactive",
    "/as/oxygen-history",
  ],
  as_stock: [
    "/dashboard",
    "/as/customers",
    "/as/stock",
    "/as/stock-monitor",
    "/as/notifications",
  ],
  // SE pages + customer register access
  se_staff: ["/dashboard", "/se", "/as/customers"],
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
    case "as_service":
      return "/as/service-request";
    case "as_stock":
      return "/as/stock";
    case "se_staff":
      return "/se/dashboard";
    default:
      return "/dashboard";
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  as_staff: "AS Staff",
  as_service: "Service Staff",
  as_stock: "Stock Staff",
  se_staff: "SE Staff",
};
