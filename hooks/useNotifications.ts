"use client"

import { useState, useEffect } from "react"
import { getNotificationCounts, NotificationCounts } from "@/lib/notificationStore"

const DEFAULTS: NotificationCounts = { serviceRequestPending: 0, inspectionPending: 0 }

export function useNotifications() {
  const [counts, setCounts] = useState<NotificationCounts>(DEFAULTS)

  useEffect(() => {
    setCounts(getNotificationCounts())
    const handler = () => setCounts(getNotificationCounts())
    window.addEventListener("treatmed-notif-changed", handler)
    return () => window.removeEventListener("treatmed-notif-changed", handler)
  }, [])

  return counts
}
