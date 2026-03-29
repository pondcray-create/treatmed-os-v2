"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, CheckCircle2 } from "lucide-react"
import {
  AS_STORE_KEYS,
  markSESalesNeglectNotificationRead,
  markStockNotificationRead,
  readSESalesNeglectNotifications,
  readStockNotifications,
  type ASStockNotification,
  type SESalesNeglectNotification,
} from "@/lib/mock/as-store"
import { formatThDateTime } from "@/lib/format-th-datetime"

export default function ASNotificationsPage() {
  const [stockItems, setStockItems] = useState<ASStockNotification[]>([])
  const [seItems, setSeItems] = useState<SESalesNeglectNotification[]>([])
  const [showUnreadOnly, setShowUnreadOnly] = useState(true)

  useEffect(() => {
    const syncStock = () => setStockItems(readStockNotifications([]))
    const syncSe = () => setSeItems(readSESalesNeglectNotifications([]))
    const sync = () => {
      syncStock()
      syncSe()
    }
    sync()
    const onStorage = (e: StorageEvent) => {
      if (!e.key) {
        sync()
        return
      }
      if (e.key === AS_STORE_KEYS.stockNotifications) syncStock()
      if (e.key === AS_STORE_KEYS.seSalesNeglectNotifications) syncSe()
    }
    const onStore = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.stockNotifications) syncStock()
      if (key === AS_STORE_KEYS.seSalesNeglectNotifications) syncSe()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStore)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStore)
    }
  }, [])

  const stockList = useMemo(
    () => (showUnreadOnly ? stockItems.filter((i) => !i.read_at) : stockItems),
    [stockItems, showUnreadOnly],
  )
  const seList = useMemo(
    () => (showUnreadOnly ? seItems.filter((i) => !i.read_at) : seItems),
    [seItems, showUnreadOnly],
  )

  return (
    <div className="p-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock + SE · แจ้งเตือนดีลไม่มีการติดต่อ (mock / local)</p>
        </div>
        <button
          type="button"
          onClick={() => setShowUnreadOnly((v) => !v)}
          className={`px-3 py-2 rounded-xl text-xs font-bold border ${showUnreadOnly ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200"}`}
        >
          {showUnreadOnly ? "แสดงเฉพาะยังไม่อ่าน" : "แสดงทั้งหมด"}
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-4 mb-6">
        <h2 className="text-sm font-bold text-violet-900 mb-2 flex items-center gap-2">
          <Bell className="h-4 w-4" /> SE — ดีลเพิกเฉย / ไม่มี Activity
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          โอกาสต่ำกว่า 60%: แจ้งเมื่อเงียบ ≥ 90 วัน · 60–80%: ≥ 30 วัน · มากกว่า 80%: แจ้งรายสัปดาห์เมื่อเงียบ ≥ 7 วัน · ข้อความระบุว่า Sales อาจเพิกเฉยต่องานสำคัญ
        </p>
        {seList.length === 0 ? (
          <p className="text-sm text-gray-500">ไม่มีรายการแจ้งเตือน SE</p>
        ) : (
          <div className="space-y-2">
            {seList.map((n) => (
              <div key={n.id} className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{n.message}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{formatThDateTime(n.created_at)}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <Link
                      href="/se/deals"
                      className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700"
                    >
                      เปิด Deals
                    </Link>
                    {!n.read_at ? (
                      <button
                        type="button"
                        onClick={() => {
                          markSESalesNeglectNotificationRead(n.id)
                          setSeItems(readSESalesNeglectNotifications([]))
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600"
                      >
                        รับทราบ
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5" /> อ่านแล้ว
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Stock / Service</h2>
        {stockList.length === 0 ? (
          <p className="text-sm text-gray-500">ไม่มีรายการแจ้งเตือน Stock</p>
        ) : (
          <div className="space-y-2">
            {stockList.map((n) => (
              <div key={n.id} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{formatThDateTime(n.created_at)}</p>
                  </div>
                  {!n.read_at ? (
                    <div className="shrink-0 flex items-center gap-1.5">
                      {n.job_id && (
                        <Link
                          href={`/as/service-request?job_id=${encodeURIComponent(n.job_id)}&job_no=${encodeURIComponent(n.job_no)}`}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500 text-white text-[11px] font-bold hover:bg-indigo-600"
                        >
                          เปิดงาน
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          markStockNotificationRead(n.id)
                          setStockItems(readStockNotifications([]))
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600"
                      >
                        รับทราบ
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0 flex items-center gap-1.5">
                      {n.job_id && (
                        <Link
                          href={`/as/service-request?job_id=${encodeURIComponent(n.job_id)}&job_no=${encodeURIComponent(n.job_no)}`}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100"
                        >
                          เปิดงาน
                        </Link>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5" /> อ่านแล้ว
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
        <Bell className="h-3.5 w-3.5" />
        Stock: สถานะงาน / อะไหล่ / Commissioning · SE: สแกนดีลเปิดตามเกณฑ์โอกาส (รันทุก ~2 นาทีเมื่ออยู่โมดูล SE)
      </div>
    </div>
  )
}
