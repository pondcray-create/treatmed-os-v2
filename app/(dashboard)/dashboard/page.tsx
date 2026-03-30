"use client"

import { Users, Package, Wrench, GitBranch, AlertTriangle, Clock, TrendingUp, CheckCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  AS_STORE_KEYS,
  readJobs,
  readOrganizations,
  readSEDeals,
  readStockItems,
  type ASOrganization,
  type ASServiceJob,
  type ASStockSnapshotItem,
  type SEDeal,
} from "@/lib/mock/as-store"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts"

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-gray-100 text-gray-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-purple-100 text-purple-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
}

export default function DashboardPage() {
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  const [jobs, setJobs] = useState<ASServiceJob[]>([])
  const [stockItems, setStockItems] = useState<ASStockSnapshotItem[]>([])
  const [seDeals, setSEDeals] = useState<SEDeal[]>([])

  useEffect(() => {
    const syncOrgs = () => setOrgs(readOrganizations([]))
    const syncJobs = () => setJobs(readJobs([]))
    const syncStock = () => setStockItems(readStockItems([]))
    const syncDeals = () => setSEDeals(readSEDeals([]))
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.orgs) syncOrgs()
      if (!ev.key || ev.key === AS_STORE_KEYS.jobs || ev.key === AS_STORE_KEYS.jobsVersion) syncJobs()
      if (!ev.key || ev.key === AS_STORE_KEYS.stockItems) syncStock()
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) syncDeals()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.orgs) syncOrgs()
      if (key === AS_STORE_KEYS.jobs || key === AS_STORE_KEYS.jobsVersion) syncJobs()
      if (key === AS_STORE_KEYS.stockItems) syncStock()
      if (key === AS_STORE_KEYS.seDeals) syncDeals()
    }
    syncOrgs()
    syncJobs()
    syncStock()
    syncDeals()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const monthlySales = useMemo(() => {
    const won = seDeals.filter((d) => String(d.stage).toLowerCase() === "won")
    const monthMap = new Map<string, number>()
    for (const d of won) {
      const ymd = d.expected_close_date || ""
      const m = ymd.slice(5, 7)
      if (!m) continue
      const key = `${m}`
      monthMap.set(key, (monthMap.get(key) || 0) + (Number(d.value) || 0))
    }
    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({ month, value }))
  }, [seDeals])

  const recentServiceRequests = useMemo(() => {
    return [...jobs]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 6)
      .map((j) => ({
        ticket_no: j.job_no,
        customer: j.customer_org || "-",
        equipment: j.model || j.serial_number || "-",
        status: j.status,
        priority: j.priority || "low",
      }))
  }, [jobs])

  const pendingJobsCount = useMemo(
    () => jobs.filter((j) => j.status !== "ปิดงาน" && j.status !== "ยกเลิก").length,
    [jobs],
  )
  const urgentJobsCount = useMemo(
    () => jobs.filter((j) => j.priority === "urgent" && j.status !== "ปิดงาน" && j.status !== "ยกเลิก").length,
    [jobs],
  )
  const lowStockCount = useMemo(
    () => stockItems.filter((i) => i.status === "in_stock" && i.qty < 3).length,
    [stockItems],
  )

  const activeSEDeals = useMemo(
    () => seDeals.filter((d) => d.stage !== "won" && d.stage !== "lost"),
    [seDeals],
  )
  const weightedPipeline = useMemo(
    () => activeSEDeals.reduce((sum, d) => sum + d.value * (d.probability / 100), 0),
    [activeSEDeals],
  )
  const pipelineLabel =
    weightedPipeline >= 1_000_000
      ? `${(weightedPipeline / 1_000_000).toFixed(1)}M`
      : weightedPipeline >= 1000
        ? `${(weightedPipeline / 1000).toFixed(0)}K`
        : String(Math.round(weightedPipeline))

  const stockAging = useMemo(() => {
    const today = new Date()
    return stockItems
      .filter((i) => i.status === "in_stock" && i.qty > 0 && i.stocked_at)
      .map((i) => {
        const entered = new Date(`${i.stocked_at}T00:00:00`)
        const diff = Math.max(0, Math.floor((today.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)))
        return { ...i, aging_days: diff }
      })
      .sort((a, b) => b.aging_days - a.aging_days)
  }, [stockItems])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">ลูกค้าทั้งหมด</p>
              <div className="p-2 bg-sky-100 rounded-lg"><Users className="h-4 w-4 text-sky-600" /></div>
            </div>
            <p className="text-3xl font-bold text-sky-600">{orgs.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">งานซ่อมค้างอยู่</p>
              <div className="p-2 bg-amber-100 rounded-lg"><Wrench className="h-4 w-4 text-amber-600" /></div>
            </div>
            <p className="text-3xl font-bold text-amber-600">{pendingJobsCount}</p>
            <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {urgentJobsCount} รายเร่งด่วน
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Pipeline มูลค่า</p>
              <div className="p-2 bg-violet-100 rounded-lg"><GitBranch className="h-4 w-4 text-violet-600" /></div>
            </div>
            <p className="text-3xl font-bold text-violet-600">{activeSEDeals.length === 0 ? "—" : pipelineLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Weighted (ไม่รวม Won/Lost)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">สต็อกใกล้หมด</p>
              <div className="p-2 bg-red-100 rounded-lg"><Package className="h-4 w-4 text-red-600" /></div>
            </div>
            <p className="text-3xl font-bold text-red-600">{lowStockCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Sales Chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> ยอดขายรายเดือน (บาท)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">ยังไม่มีข้อมูลยอดขาย Won ตามเดือน</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlySales} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" name="ยอดขาย" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Follow-up Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Follow-up วันนี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground py-2">
              ดูรายการ follow-up จริงได้ที่เมนู <span className="font-semibold text-foreground">SE → Follow-up</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Service Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" /> งานซ่อมล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentServiceRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">ยังไม่มีงานซ่อมล่าสุด</p>
            ) : recentServiceRequests.map(r => (
              <div key={r.ticket_no} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.ticket_no}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                  </div>
                  <p className="font-medium text-sm mt-0.5">{r.customer}</p>
                  <p className="text-xs text-muted-foreground">{r.equipment}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === "กำลังซ่อม" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {r.status === "กำลังซ่อม" ? "กำลังซ่อม" : "รอดำเนินการ"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> ดีลที่กำลังดำเนินการ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSEDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">ยังไม่มีดีลที่กำลังดำเนินการ (หรือดีลทั้งหมดอยู่ที่ Won/Lost)</p>
            ) : (
              activeSEDeals.slice(0, 6).map((d) => (
                <div key={d.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{d.deal_no}</span>
                    <p className="font-medium text-sm mt-0.5">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{formatCurrency(d.value)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STAGE_COLORS[d.stage] ?? "bg-gray-100 text-gray-700"}`}>{d.stage}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Stock Aging (Oldest First)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stockAging.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลอายุสินค้าใน Stock</p>
            ) : (
              stockAging.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.serial_number ? `SN: ${item.serial_number} · ` : ""}
                      In stock since {item.stocked_at}
                    </p>
                  </div>
                  <Badge variant={item.aging_days >= 180 ? "destructive" : "secondary"}>
                    {item.aging_days} days
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
