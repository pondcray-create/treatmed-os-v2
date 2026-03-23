"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, CheckCircle2 } from "lucide-react"
import {
  markStockNotificationRead,
  readStockNotifications,
  type ASStockNotification,
} from "@/lib/mock/as-store"
import { formatThDateTime } from "@/lib/format-th-datetime"

export default function ASNotificationsPage() {
  const [items, setItems] = useState<ASStockNotification[]>([])
  const [showUnreadOnly, setShowUnreadOnly] = useState(true)

  useEffect(() => {
    const sync = () => setItems(readStockNotifications([]))
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [])

  const list = useMemo(
    () => (showUnreadOnly ? items.filter((i) => !i.read_at) : items),
    [items, showUnreadOnly],
  )

  return (
    <div className="p-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">แจ้งเตือนจาก Service แบบ near real-time</p>
        </div>
        <button
          type="button"
          onClick={() => setShowUnreadOnly((v) => !v)}
          className={`px-3 py-2 rounded-xl text-xs font-bold border ${showUnreadOnly ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200"}`}
        >
          {showUnreadOnly ? "แสดงเฉพาะยังไม่อ่าน" : "แสดงทั้งหมด"}
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        {list.length === 0 ? (
          <p className="text-sm text-gray-500">ไม่มีรายการแจ้งเตือน</p>
        ) : (
          <div className="space-y-2">
            {list.map((n) => (
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
                          setItems(readStockNotifications([]))
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
        Notification source: Status change, parts request, escalation, commissioning fail.
      </div>
    </div>
  )
}

