/**
 * Mock session for AS Stock approvals (localStorage phase).
 * Replace with Supabase auth + RLS when backend is connected.
 *
 * Override in dev: localStorage.setItem("as_mock_session", JSON.stringify({
 *   userId: "u1",
 *   displayName: "Admin",
 *   roles: ["as_admin","stock_approver","stock"]
 * }))
 */
export type MockRole = "viewer" | "stock" | "stock_approver" | "as_admin"

export interface MockSession {
  userId: string
  displayName?: string
  roles: MockRole[]
}

const MOCK_SESSION_KEY = "as_mock_session"

const DEFAULT_SESSION: MockSession = {
  userId: "dev-1",
  displayName: "Dev User",
  roles: ["as_admin", "stock_approver", "stock"],
}

export function readMockSession(): MockSession {
  if (typeof window === "undefined") return DEFAULT_SESSION
  try {
    const raw = window.localStorage.getItem(MOCK_SESSION_KEY)
    if (!raw) return DEFAULT_SESSION
    const p = JSON.parse(raw) as Partial<MockSession>
    if (!p.userId || !Array.isArray(p.roles) || p.roles.length === 0) return DEFAULT_SESSION
    return {
      userId: p.userId,
      displayName: p.displayName,
      roles: p.roles as MockRole[],
    }
  } catch {
    return DEFAULT_SESSION
  }
}

export function canApproveStockLoan(session: MockSession): boolean {
  return session.roles.includes("as_admin") || session.roles.includes("stock_approver")
}
