"use client"

import { TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DealStageBadge } from "@/components/ui/status-badge"
import { formatCurrency } from "@/lib/utils"
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

const PIPELINE_DEALS = [
  { deal_no: "DEAL-001", title: "MRI 3T ใหม่", customer: "โรงพยาบาลกรุงเทพ", stage: "negotiation" as const, value: 25000000, probability: 70, weighted: 17500000, close_date: "2024-04-30" },
  { deal_no: "DEAL-002", title: "CT Scan 128 Slice", customer: "โรงพยาบาลรามาธิบดี", stage: "proposal" as const, value: 15000000, probability: 50, weighted: 7500000, close_date: "2024-05-15" },
  { deal_no: "DEAL-003", title: "Ultrasound High-end", customer: "โรงพยาบาลมหาราชนครเชียงใหม่", stage: "qualified" as const, value: 8000000, probability: 30, weighted: 2400000, close_date: "2024-06-01" },
  { deal_no: "DEAL-004", title: "X-Ray Digital", customer: "คลินิกสุขภาพดี", stage: "lead" as const, value: 3500000, probability: 20, weighted: 700000, close_date: "2024-07-01" },
  { deal_no: "DEAL-006", title: "Endoscopy System", customer: "โรงพยาบาลสมิติเวช", stage: "lead" as const, value: 5000000, probability: 20, weighted: 1000000, close_date: "2024-08-01" },
]

const STAGE_DIST = [
  { name: "Lead", value: 8500000, color: "#94a3b8" },
  { name: "Qualified", value: 8000000, color: "#60a5fa" },
  { name: "Proposal", value: 15000000, color: "#a78bfa" },
  { name: "Negotiation", value: 25000000, color: "#fb923c" },
]

const totalPipeline = PIPELINE_DEALS.reduce((sum, d) => sum + d.value, 0)
const weightedPipeline = PIPELINE_DEALS.reduce((sum, d) => sum + d.weighted, 0)
const ytdActual = MONTHLY_DATA.filter(m => m.actual > 0).reduce((sum, m) => sum + m.actual, 0)
const ytdTarget = MONTHLY_DATA.filter(m => m.actual > 0).reduce((sum, m) => sum + m.target, 0)

export default function ForecastPage() {
  return (
    <div>
      <PageHeader title="Forecast / พยากรณ์ยอดขาย" description="ภาพรวมยอดขายและ pipeline" icon={TrendingUp} />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-3 gap-6 mb-6">
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
                <Pie data={STAGE_DIST} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                  {STAGE_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {STAGE_DIST.map(s => (
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
              {PIPELINE_DEALS.map(d => (
                <TableRow key={d.deal_no}>
                  <TableCell className="font-mono text-xs">{d.deal_no}</TableCell>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-sm">{d.customer}</TableCell>
                  <TableCell><DealStageBadge stage={d.stage} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(d.value)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={d.probability >= 70 ? "success" : d.probability >= 40 ? "warning" : "secondary"}>
                      {d.probability}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatCurrency(d.weighted)}</TableCell>
                  <TableCell className="text-sm">{d.close_date}</TableCell>
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
    </div>
  )
}
