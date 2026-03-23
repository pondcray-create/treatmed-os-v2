"use client"

import { Users, Package, Wrench, GitBranch, AlertTriangle, Clock, TrendingUp, CheckCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { readStockItems, type ASStockSnapshotItem } from "@/lib/mock/as-store"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts"

const MONTHLY_SALES = [
  { month: "ต.ค.", value: 18500000 },
  { month: "พ.ย.", value: 21000000 },
  { month: "ธ.ค.", value: 28000000 },
  { month: "ม.ค.", value: 19000000 },
  { month: "ก.พ.", value: 23500000 },
  { month: "มี.ค.", value: 12000000 },
]

const RECENT_SR = [
  { ticket_no: "SR-2024-001", customer: "โรงพยาบาลกรุงเทพ", equipment: "MRI 3T", status: "in_progress", priority: "urgent" },
  { ticket_no: "SR-2024-002", customer: "โรงพยาบาลรามาธิบดี", equipment: "CT Scan", status: "pending", priority: "medium" },
  { ticket_no: "SR-2024-004", customer: "โรงพยาบาลสมิติเวช", equipment: "X-Ray", status: "pending", priority: "high" },
  { ticket_no: "SR-2024-005", customer: "โรงพยาบาลมหาราชนครเชียงใหม่", equipment: "Ventilator", status: "in_progress", priority: "urgent" },
]

const RECENT_DEALS = [
  { deal_no: "DEAL-001", title: "MRI 3T ใหม่", customer: "โรงพยาบาลกรุงเทพ", stage: "negotiation", value: 25000000 },
  { deal_no: "DEAL-002", title: "CT Scan 128 Slice", customer: "โรงพยาบาลรามาธิบดี", stage: "proposal", value: 15000000 },
  { deal_no: "DEAL-003", title: "Ultrasound High-end", customer: "รพ.มหาราช เชียงใหม่", stage: "qualified", value: 8000000 },
]

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
  const [stockItems, setStockItems] = useState<ASStockSnapshotItem[]>([])

  useEffect(() => {
    const sync = () => {
      setStockItems(readStockItems([]))
    }
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [])

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
            <p className="text-3xl font-bold text-sky-600">5</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">งานซ่อมค้างอยู่</p>
              <div className="p-2 bg-amber-100 rounded-lg"><Wrench className="h-4 w-4 text-amber-600" /></div>
            </div>
            <p className="text-3xl font-bold text-amber-600">3</p>
            <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> 2 รายเร่งด่วน
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Pipeline มูลค่า</p>
              <div className="p-2 bg-violet-100 rounded-lg"><GitBranch className="h-4 w-4 text-violet-600" /></div>
            </div>
            <p className="text-3xl font-bold text-violet-600">57M</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">สต็อกใกล้หมด</p>
              <div className="p-2 bg-red-100 rounded-lg"><Package className="h-4 w-4 text-red-600" /></div>
            </div>
            <p className="text-3xl font-bold text-red-600">2</p>
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MONTHLY_SALES} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" name="ยอดขาย" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
            {[
              { subject: "ส่งใบเสนอราคา MRI", customer: "รพ.กรุงเทพ", overdue: true },
              { subject: "โทรติดตาม X-Ray", customer: "คลินิกสุขภาพดี", overdue: true },
              { subject: "ส่ง Spec Sheet", customer: "รพ.มหาราช", overdue: false },
            ].map((f, i) => (
              <div key={i} className={`p-3 rounded-lg border text-sm ${f.overdue ? "bg-destructive/5 border-destructive/30" : "bg-muted/30"}`}>
                <p className="font-medium">{f.subject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.customer}</p>
                {f.overdue && <Badge variant="destructive" className="mt-1 text-xs">เกินกำหนด</Badge>}
              </div>
            ))}
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
            {RECENT_SR.map(r => (
              <div key={r.ticket_no} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.ticket_no}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                  </div>
                  <p className="font-medium text-sm mt-0.5">{r.customer}</p>
                  <p className="text-xs text-muted-foreground">{r.equipment}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {r.status === "in_progress" ? "กำลังซ่อม" : "รอดำเนินการ"}
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
            {RECENT_DEALS.map(d => (
              <div key={d.deal_no} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{d.deal_no}</span>
                  <p className="font-medium text-sm mt-0.5">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.customer}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">{formatCurrency(d.value)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STAGE_COLORS[d.stage]}`}>{d.stage}</span>
                </div>
              </div>
            ))}
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
