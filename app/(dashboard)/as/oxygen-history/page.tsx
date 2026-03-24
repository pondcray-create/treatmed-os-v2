"use client"

import { useEffect, useMemo, useState } from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Droplets, Search } from "lucide-react"
import {
  AS_STORE_KEYS,
  readOxygenSensorHistory,
  type ASOxygenSensorHistoryEntry,
} from "@/lib/mock/as-store"
import { formatThDateTime } from "@/lib/format-th-datetime"

function ASOxygenHistoryContent() {
  const searchParams = useSearchParams()
  const initialQ = searchParams.get("q") || ""
  const [items, setItems] = useState<ASOxygenSensorHistoryEntry[]>([])
  const [query, setQuery] = useState(initialQ)
  const [mode, setMode] = useState<"all" | "changed" | "no_change">("all")

  useEffect(() => {
    const sync = () => setItems(readOxygenSensorHistory([]))
    sync()
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key !== AS_STORE_KEYS.oxygenSensorHistory) return
      sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key && key !== AS_STORE_KEYS.oxygenSensorHistory) return
      sync()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      const modeOk =
        mode === "all" ? true : mode === "changed" ? i.changed : !i.changed
      if (!modeOk) return false
      if (!q) return true
      return (
        i.job_id.toLowerCase().includes(q) ||
        i.job_no.toLowerCase().includes(q) ||
        i.serial_number.toLowerCase().includes(q) ||
        i.model.toLowerCase().includes(q) ||
        i.note.toLowerCase().includes(q) ||
        (i.oxygen_sensor_serial || "").toLowerCase().includes(q) ||
        (i.stock_item_id || "").toLowerCase().includes(q)
      )
    })
  }, [items, query, mode])

  const changedCount = items.filter((i) => i.changed).length

  return (
    <div className="p-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oxygen Sensor History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            บันทึกการเปลี่ยน/ไม่เปลี่ยน Oxygen Sensor สำหรับงาน VT Calibration
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">รายการทั้งหมด</p>
          <p className="text-lg font-black text-gray-900">{items.length}</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา Job / job_id / SN เครื่อง / O₂ SN / Stock id / Note"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
            />
          </div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option value="changed">เปลี่ยน Oxygen Sensor</option>
            <option value="no_change">ไม่เปลี่ยน Oxygen Sensor</option>
          </select>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold">
            เปลี่ยนแล้ว {changedCount}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
            ไม่เปลี่ยน {items.length - changedCount}
          </span>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูล Oxygen Sensor History</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((i) => (
              <div key={i.id} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-500">{i.job_no}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {i.model} · SN {i.serial_number}
                    </p>
                    {i.oxygen_sensor_serial && (
                      <p className="text-xs font-mono text-indigo-700 mt-0.5">O₂ SN: {i.oxygen_sensor_serial}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-0.5">{i.note}</p>
                    {(i.stock_item_id || i.stock_item_name || i.stock_qty_before != null) && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Stock{i.stock_item_id ? ` · ${i.stock_item_id.slice(0, 8)}…` : ""}: {i.stock_item_name || "—"} ·{" "}
                        {i.stock_qty_before ?? "—"} {"->"} {i.stock_qty_after ?? "—"}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                        i.changed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Droplets className="h-3.5 w-3.5" />
                      {i.changed ? "Changed" : "No Change"}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">{formatThDateTime(i.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ASOxygenHistoryPage() {
  return (
    <Suspense fallback={<div className="p-1 text-sm text-gray-500">Loading oxygen history...</div>}>
      <ASOxygenHistoryContent />
    </Suspense>
  )
}

