// Simple localStorage-backed notification store
// Used to share pending counts between Stock → Services → Sidebar

export interface NotificationCounts {
  serviceRequestPending: number   // from_stock + from_se unread
  inspectionPending: number       // new machines waiting Services to inspect
}

const KEY = "treatmed_notif_v2"

const DEFAULTS: NotificationCounts = {
  serviceRequestPending: 2,
  inspectionPending: 1,
}

export function getNotificationCounts(): NotificationCounts {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULTS
}

export function setNotificationCounts(patch: Partial<NotificationCounts>) {
  if (typeof window === "undefined") return
  const next = { ...getNotificationCounts(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("treatmed-notif-changed"))
}

export function decrementServiceRequest() {
  const c = getNotificationCounts()
  setNotificationCounts({ serviceRequestPending: Math.max(0, c.serviceRequestPending - 1) })
}

export function decrementInspection() {
  const c = getNotificationCounts()
  setNotificationCounts({ inspectionPending: Math.max(0, c.inspectionPending - 1) })
}
