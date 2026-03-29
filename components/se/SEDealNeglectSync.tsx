"use client"

import { useEffect } from "react"
import { AS_STORE_KEYS, readSEDealActivities, readSEDeals } from "@/lib/mock/as-store"
import { runSENeglectNotificationScan } from "@/lib/se/se-deal-neglect"

/** รันสแกนดีลเพิกเฉย → เขียน SESalesNeglectNotification (แสดงที่ AS → Notifications) */
export function SEDealNeglectSync() {
  useEffect(() => {
    function tick() {
      const todayYmd = new Date().toISOString().slice(0, 10)
      runSENeglectNotificationScan({
        deals: readSEDeals([]),
        activities: readSEDealActivities([]),
        todayYmd,
      })
    }
    tick()
    const onStore = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.seDeals || key === AS_STORE_KEYS.seDealActivities) tick()
    }
    window.addEventListener("as-store-updated", onStore)
    const id = window.setInterval(tick, 120_000)
    return () => {
      window.removeEventListener("as-store-updated", onStore)
      window.clearInterval(id)
    }
  }, [])
  return null
}
