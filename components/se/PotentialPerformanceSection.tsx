"use client"

import { useEffect, useMemo, useState } from "react"
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts"
import { ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AS_STORE_KEYS,
  initialSESettingsForSSR,
  readSEDealActivities,
  readSEDeals,
  readSESettings,
  type SEDeal,
  type SEDealActivityRecord,
  type SESettings,
} from "@/lib/mock/as-store"
import { Badge } from "@/components/ui/badge"
import { buildPotentialPerformanceRows } from "@/lib/se/se-potential-performance"

const NEW_PHOTO_KEY = "se_potential_performance_photos"
const LEGACY_PHOTO_KEY = "se_performance_hex_photos"

type Props = {
  chartHeight?: number
}

export function PotentialPerformanceSection({ chartHeight = 320 }: Props) {
  const [settings, setSettings] = useState<SESettings>(() => initialSESettingsForSSR())
  const [deals, setDeals] = useState<SEDeal[]>([])
  const [activities, setActivities] = useState<SEDealActivityRecord[]>([])
  const owners = settings.se_owners
  const [selectedOwner, setSelectedOwner] = useState<string>("")
  const [photoByOwner, setPhotoByOwner] = useState<Record<string, string>>({})

  useEffect(() => {
    setSettings(readSESettings())
    setDeals(readSEDeals([]))
    setActivities(readSEDealActivities([]))
    const sync = () => setSettings(readSESettings())
    const syncDeals = () => setDeals(readSEDeals([]))
    const syncActivities = () => setActivities(readSEDealActivities([]))
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) sync()
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) syncDeals()
      if (!ev.key || ev.key === AS_STORE_KEYS.seDealActivities) syncActivities()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seSettings) sync()
      if (key === AS_STORE_KEYS.seDeals) syncDeals()
      if (key === AS_STORE_KEYS.seDealActivities) syncActivities()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  useEffect(() => {
    try {
      let raw = localStorage.getItem(NEW_PHOTO_KEY)
      if (!raw) raw = localStorage.getItem(LEGACY_PHOTO_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed && typeof parsed === "object") setPhotoByOwner(parsed)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(NEW_PHOTO_KEY, JSON.stringify(photoByOwner))
    } catch {
      // ignore
    }
  }, [photoByOwner])

  useEffect(() => {
    if (owners.length > 0 && (!selectedOwner || !owners.includes(selectedOwner))) {
      setSelectedOwner(owners[0]!)
    }
  }, [owners, selectedOwner])

  const rows = useMemo(() => {
    if (!selectedOwner) return []
    return buildPotentialPerformanceRows(settings, selectedOwner, deals, activities)
  }, [settings, selectedOwner, deals, activities])

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
      <Card className="border-violet-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-600" />
            Potential Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center">
            ยังไม่มีรายชื่อ SE — ตั้งค่าที่ <span className="font-semibold text-gray-800">Settings → SE Owners</span>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-violet-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-600" />
          Potential Performance (ทีมขาย)
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          คะแนนแต่ละแกนคำนวณอัตโนมัติจากดีล/กิจกรรมในระบบ โดยอิง key ของแกนจาก{" "}
          <span className="font-medium text-gray-700">Settings → SE → Potential Performance</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {owners.map((owner) => (
            <button
              key={owner}
              type="button"
              onClick={() => setSelectedOwner(owner)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                selectedOwner === owner
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {owner}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Sales Profile</p>
            {photoByOwner[selectedOwner] ? (
              <img
                src={photoByOwner[selectedOwner]}
                alt=""
                className="h-36 w-full rounded-2xl object-cover border border-gray-200"
              />
            ) : (
              <div className="h-36 w-full rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-3xl font-bold text-gray-400">
                {(selectedOwner || "?").trim().charAt(0)}
              </div>
            )}
            <p className="text-sm font-semibold text-gray-900 truncate">{selectedOwner}</p>
            <label className="text-[11px] font-semibold text-indigo-700 cursor-pointer hover:text-indigo-900">
              อัปโหลดรูป
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div className="lg:col-span-6" style={{ minHeight: chartHeight }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <RadarChart data={rows}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="baseline" dataKey={() => 100} stroke="#d1d5db" fill="#f3f4f6" fillOpacity={0.25} />
                <Radar name={selectedOwner} dataKey="score" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.45} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">สรุปคะแนน</p>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2">
              <p className="text-[10px] text-indigo-700">เฉลี่ย</p>
              <p className="text-2xl font-black text-indigo-700">{avg}</p>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.axis} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-600 truncate mr-1">{r.axis}</span>
                  <Badge variant={r.score >= 80 ? "success" : r.score >= 60 ? "warning" : "secondary"} className="text-[10px] shrink-0">
                    {r.score}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
