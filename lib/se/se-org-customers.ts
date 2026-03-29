import { readOrganizations } from "@/lib/mock/as-store"

/** ลูกค้าใน dropdown SE — จาก AS Customer Register */
export function sortedOrgCustomerNames(): string[] {
  const names = readOrganizations([])
    .map((o) => o.name.trim())
    .filter(Boolean)
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "th"))
}
