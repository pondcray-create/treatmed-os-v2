"use client"

import { useEffect, useMemo, useState } from "react"
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts"
import { ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AS_STORE_KEYS, readSESettings } from "@/lib/mock/as-store"
import { Badge } from "@/components/ui/badge"

type AxisRow = { axis: string; score: number; fullMark: number }
const PHOTO_STORE_KEY = "se_performance_hex_photos"

export default function SalesPerformanceHexPage() {
  const initial = readSESettings()
  const [owners, setOwners] = useState<string[]>(initial.se_owners)
  const [selectedOwner, setSelectedOwner] = useState<string>(initial.se_owners[0] ?? "")
  const [photoByOwner, setPhotoByOwner] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PHOTO_STORE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed && typeof parsed === "object") setPhotoByOwner(parsed)
    } catch {
      // ignore parse errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PHOTO_STORE_KEY, JSON.stringify(photoByOwner))
    } catch {
      // ignore storage quota/privacy mode errors
    }
  }, [photoByOwner])

  useEffect(() => {
    const sync = () => {
      const next = readSESettings().se_owners
      setOwners(next)
      setSelectedOwner((cur) => (next.includes(cur) ? cur : next[0] ?? ""))
    }
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seSettings) sync()
    }
    sync()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  useEffect(() => {
    if (owners.length > 0 && !selectedOwner) setSelectedOwner(owners[0])
  }, [owners, selectedOwner])

  const axisNames = [
    "Responsibility",
    "Target",
    "Pipeline",
    "Closing",
    "Follow-up",
    "Collaboration",
  ]

  const scoreByOwner = useMemo(() => {
    const by = new Map<string, AxisRow[]>()
    owners.forEach((owner, ownerIdx) => {
      const rows: AxisRow[] = axisNames.map((axis, idx) => {
        // deterministic mock scoring per person (stable view)
        const seed = `${owner}-${axis}-${ownerIdx}-${idx}`.length * 17 + ownerIdx * 11 + idx * 7
        const score = Math.max(35, Math.min(96, 40 + (seed % 58)))
        return { axis, score, fullMark: 100 }
      })
      by.set(owner, rows)
    })
    return by
  }, [owners])

  const rows = selectedOwner ? scoreByOwner.get(selectedOwner) || [] : []

  const avg = Math.round(rows.reduce((sum, r) => sum + r.score, 0) / Math.max(1, rows.length))

  function onUploadPhoto(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (!result) return
      setPhotoByOwner((prev) => ({ ...prev, [selectedOwner]: result }))
    }
    reader.readAsDataURL(file)
  }

  if (owners.length === 0) {
    return (
      <div>
        <PageHeader
          title="Sales Performance Hex"
          description="เรดาร์ 6 ด้านสำหรับวัดความพร้อมและคุณภาพการขายของทีม SE"
          icon={ShieldCheck}
        />
        <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 p-10 text-center text-sm text-muted-foreground">
          ยังไม่มีรายชื่อ SE ในระบบ — ไปที่{" "}
          <span className="font-semibold text-gray-800">Settings → SE Module → SE Owners</span> เพื่อเพิ่มทีมขายก่อน
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Sales Performance Hex"
        description="เรดาร์ 6 ด้านสำหรับวัดความพร้อมและคุณภาพการขายของทีม SE"
        icon={ShieldCheck}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {owners.map((owner) => (
          <button
            key={owner}
            type="button"
            onClick={() => setSelectedOwner(owner)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
              selectedOwner === owner
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {owner}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {photoByOwner[selectedOwner] ? (
              <img
                src={photoByOwner[selectedOwner]}
                alt={`Sales ${selectedOwner}`}
                className="h-48 w-full rounded-2xl object-cover border border-gray-200"
              />
            ) : (
              <div className="h-48 w-full rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-5xl font-bold text-gray-500">
                {(selectedOwner || "?").trim().charAt(0)}
              </div>
            )}
            <p className="font-semibold text-gray-900">{selectedOwner}</p>
            <label className="inline-block text-xs font-semibold text-indigo-700 cursor-pointer hover:text-indigo-900">
              อัปโหลดรูปของ Sales
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUploadPhoto(e.target.files?.[0])}
              />
            </label>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">6-Dimension Radar — {selectedOwner}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={rows}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 14, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="SE baseline" dataKey={() => 100} stroke="#d1d5db" fill="#f3f4f6" fillOpacity={0.25} />
                  <Radar name={selectedOwner} dataKey="score" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.45} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-xs text-indigo-700">Average ({selectedOwner})</p>
              <p className="text-3xl font-black text-indigo-700">{avg}</p>
            </div>
            {rows.map((r) => (
              <div key={r.axis} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{r.axis}</span>
                <Badge variant={r.score >= 80 ? "success" : r.score >= 60 ? "warning" : "secondary"}>{r.score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
