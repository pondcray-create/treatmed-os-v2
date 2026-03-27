"use client"

import { useEffect, useMemo, useState } from "react"
import { TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DealStageBadge } from "@/components/ui/status-badge"
import { formatCurrency } from "@/lib/utils"
import { readSEDeals, readSESettings, type SEDeal } from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { Textarea } from "@/components/ui/textarea"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts"

const MONTHLY_DATA = [
  { month: "ต.ค.", target: 20000000, actual: 18500000, forecast: 18500000 },
  { month: "พ.ย.", target: 22000000, actual: 21000000, forecast: 21000000 },
  { month: "ธ.ค.", target: 25000000, actual: 28000000, forecast: 28000000 },
  { month: "ม.ค.", target: 20000000, actual: 19000000, forecast: 19000000 },
  { month: "ก.พ.", target: 22000000, actual: 23500000, forecast: 23500000 },
  { month: "มี.ค.", target: 25000000, actual: 12000000, forecast: 35000000 },
  { month: "เม.ย.", target: 30000000, actual: 0, forecast: 25000000 },
  { month: "พ.ค.", target: 30000000, actual: 0, forecast: 15000000 },
]

const ytdActual = MONTHLY_DATA.filter(m => m.actual > 0).reduce((sum, m) => sum + m.actual, 0)
const ytdTarget = MONTHLY_DATA.filter(m => m.actual > 0).reduce((sum, m) => sum + m.target, 0)
const FORECAST_UPDATES_KEY = "se_monthly_forecast_updates"

type ForecastUpdate = { id: string; deal_id: string; month: string; note: string; updated_at: string }

export default function ForecastPage() {
  const { profile } = useAuth()
  const [seSettings, setSESettings] = useState(readSESettings())
  const [deals, setDeals] = useState<SEDeal[]>(readSEDeals([]))
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [myDealsOnly, setMyDealsOnly] = useState(true)
  const [updates, setUpdates] = useState<ForecastUpdate[]>([])
  const [draftNoteByDeal, setDraftNoteByDeal] = useState<Record<string, string>>({})
  useEffect(() => {
    const sync = () => {
      setSESettings(readSESettings())
      setDeals(readSEDeals([]))
    }
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    sync()
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORECAST_UPDATES_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ForecastUpdate[]
      if (Array.isArray(parsed)) setUpdates(parsed)
    } catch {
      // ignore
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(FORECAST_UPDATES_KEY, JSON.stringify(updates))
    } catch {
      // ignore storage quota/privacy mode errors
    }
  }, [updates])

  const visibleDeals = useMemo(() => {
    const owner = profile?.full_name?.trim()
    if (myDealsOnly && profile?.role !== "admin" && owner) return deals.filter((d) => (d.owner || "").trim() === owner)
    return deals
  }, [deals, myDealsOnly, profile?.full_name, profile?.role])
  useEffect(() => {
    if (profile?.role !== "admin") setMyDealsOnly(true)
  }, [profile?.role])

  const months = useMemo(() => {
    const set = new Set<string>()
    visibleDeals.forEach((d) => {
      if (d.expected_close_date?.length >= 7) set.add(d.expected_close_date.slice(0, 7))
    })
    return Array.from(set).sort((a, b) => (a > b ? 1 : -1))
  }, [visibleDeals])

  const monthlyDeals = useMemo(() => {
    if (selectedMonth === "all") return visibleDeals
    return visibleDeals.filter((d) => d.expected_close_date?.startsWith(selectedMonth))
  }, [visibleDeals, selectedMonth])

  const totalPipeline = monthlyDeals.reduce((sum, d) => sum + (d.value || 0), 0)
  const weightedPipeline = monthlyDeals.reduce((sum, d) => sum + (d.value || 0) * (d.probability || 0) / 100, 0)

  const stageDist = useMemo(() => {
    const palette = ["#94a3b8", "#60a5fa", "#a78bfa", "#fb923c", "#34d399", "#f87171", "#2dd4bf", "#c084fc"]
    const stageOrder = seSettings.se_stages.length > 0 ? seSettings.se_stages : Array.from(new Set(monthlyDeals.map((d) => d.stage)))
    return stageOrder
      .map((s, idx) => ({
        name: s,
        value: monthlyDeals.filter((d) => d.stage === s).reduce((sum, d) => sum + (d.value || 0), 0),
        color: palette[idx % palette.length],
      }))
      .filter((s) => s.value > 0)
  }, [seSettings.se_stages, monthlyDeals])

  function appendUpdate(deal: SEDeal) {
    const note = (draftNoteByDeal[deal.id] || "").trim()
    if (!note) return
    const month = deal.expected_close_date?.slice(0, 7) || "unknown"
    setUpdates((prev) => [{ id: `fu-${Date.now()}`, deal_id: deal.id, month, note, updated_at: new Date().toISOString() }, ...prev])
    setDraftNoteByDeal((prev) => ({ ...prev, [deal.id]: "" }))
  }

  return (
    <div>
      <PageHeader title="Forecast / พยากรณ์ยอดขาย" description="ภาพรวมยอดขายและ pipeline" icon={TrendingUp} />
      {profile?.role !== "admin" && (
        <div className="mb-3">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline">Monthly Forecast List</Badge>
        <button
          type="button"
          onClick={() => setMyDealsOnly((v) => !v)}
          disabled={profile?.role !== "admin"}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${myDealsOnly ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-gray-200 text-gray-600"} ${profile?.role !== "admin" ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {myDealsOnly ? "เฉพาะดีลของฉัน" : "ดีลทั้งหมด"}
        </button>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs"
        >
          <option value="all">ทุกเดือน</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pipeline ทั้งหมด</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalPipeline)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Weighted Pipeline</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(weightedPipeline)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">ยอดขาย YTD</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(ytdActual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">% เทียบเป้า YTD</p>
            <p className="text-2xl font-bold text-orange-600">{Math.round(ytdActual / ytdTarget * 100)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Bar Chart */}
        <Card className="col-span-2">
          <CardHeader><CardTitle className="text-base">ยอดขาย vs เป้าหมาย (รายเดือน)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={MONTHLY_DATA} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="target" name="เป้าหมาย" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="ยอดจริง" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="forecast" name="Forecast" fill="#a78bfa" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stage Distribution Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Pipeline ตาม Stage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stageDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                  {stageDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {stageDist.map(s => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(s.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deal List */}
      <Card>
        <CardHeader><CardTitle className="text-base">รายการดีลใน Pipeline</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal No.</TableHead>
                <TableHead>ดีล</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">มูลค่า</TableHead>
                <TableHead className="text-center">โอกาส</TableHead>
                <TableHead className="text-right">Weighted</TableHead>
                <TableHead>ปิดภายใน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyDeals.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.deal_no}</TableCell>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-sm">{d.customer_name}</TableCell>
                  <TableCell><DealStageBadge stage={d.stage} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(d.value || 0)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={(d.probability || 0) >= 70 ? "success" : (d.probability || 0) >= 40 ? "warning" : "secondary"}>
                      {d.probability}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatCurrency((d.value || 0) * (d.probability || 0) / 100)}</TableCell>
                  <TableCell className="text-sm">{d.expected_close_date || "-"}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={4}>รวม</TableCell>
                <TableCell className="text-right">{formatCurrency(totalPipeline)}</TableCell>
                <TableCell />
                <TableCell className="text-right text-primary">{formatCurrency(weightedPipeline)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">อัปเดต Forecast ในเดือน (ส่งผู้ผลิต)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {monthlyDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">ไม่มีดีลในช่วงเดือนที่เลือก</p>
          ) : monthlyDeals.slice(0, 12).map((d) => (
            <div key={`upd-${d.id}`} className="rounded-xl border border-gray-200 p-3">
              <p className="text-sm font-semibold">{d.deal_no} · {d.title}</p>
              <p className="text-xs text-muted-foreground">{d.customer_name} · Owner: {d.owner || "-"}</p>
              <Textarea
                className="mt-2"
                placeholder="บันทึกการอัปเดตดีลสำหรับรายงานผู้ผลิต..."
                value={draftNoteByDeal[d.id] || ""}
                onChange={(e) => setDraftNoteByDeal((prev) => ({ ...prev, [d.id]: e.target.value }))}
              />
              <button type="button" onClick={() => appendUpdate(d)} className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">บันทึกอัปเดต</button>
              <div className="mt-2 space-y-1">
                {updates.filter((u) => u.deal_id === d.id).slice(0, 3).map((u) => (
                  <p key={u.id} className="text-xs text-gray-600">- {u.note}</p>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
