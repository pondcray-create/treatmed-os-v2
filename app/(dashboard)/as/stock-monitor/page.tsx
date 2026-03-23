"use client"

import { BarChart2, AlertTriangle, CheckCircle, Package } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

const MOCK_ITEMS = [
  { id: "1", code: "PRB-001", name: "Probe MRI Surface Coil", category: "อะไหล่", unit: "ชิ้น", qty_in_stock: 3, min_qty: 2 },
  { id: "2", code: "FIL-001", name: "ไส้กรอง Coolant", category: "สิ้นเปลือง", unit: "ชิ้น", qty_in_stock: 12, min_qty: 5 },
  { id: "3", code: "OIL-001", name: "น้ำมัน Compressor", category: "สิ้นเปลือง", unit: "ลิตร", qty_in_stock: 1, min_qty: 3 },
  { id: "4", code: "TUB-001", name: "หลอด X-Ray", category: "อะไหล่", unit: "ชิ้น", qty_in_stock: 2, min_qty: 1 },
  { id: "5", code: "CAB-001", name: "สายสัญญาณ ECG", category: "อะไหล่", unit: "เส้น", qty_in_stock: 8, min_qty: 5 },
  { id: "6", code: "BAT-001", name: "Battery UPS", category: "อะไหล่", unit: "ก้อน", qty_in_stock: 0, min_qty: 2 },
]

export default function StockMonitorPage() {
  const critical = MOCK_ITEMS.filter(i => i.qty_in_stock === 0)
  const low = MOCK_ITEMS.filter(i => i.qty_in_stock > 0 && i.qty_in_stock <= i.min_qty)
  const ok = MOCK_ITEMS.filter(i => i.qty_in_stock > i.min_qty)

  const chartData = MOCK_ITEMS.map(i => ({
    name: i.name.length > 15 ? i.name.slice(0, 15) + "..." : i.name,
    qty: i.qty_in_stock,
    min: i.min_qty,
    status: i.qty_in_stock === 0 ? "critical" : i.qty_in_stock <= i.min_qty ? "low" : "ok",
  }))

  return (
    <div>
      <PageHeader
        title="ติดตามสต็อก (Stock Monitor)"
        description="ดูภาพรวมสถานะสินค้าคงคลัง"
        icon={BarChart2}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">หมดสต็อก</p>
              <p className="text-3xl font-bold text-destructive">{critical.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-300/50 bg-yellow-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">ใกล้หมด (≤ min)</p>
              <p className="text-3xl font-bold text-yellow-600">{low.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-300/50 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">ปกติ</p>
              <p className="text-3xl font-bold text-green-600">{ok.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">ปริมาณสต็อกแต่ละรายการ</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" name="คงเหลือ" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.status === "critical" ? "#ef4444" : entry.status === "low" ? "#f59e0b" : "#22c55e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>หมวด</TableHead>
                <TableHead className="text-center">คงเหลือ</TableHead>
                <TableHead className="text-center">Min</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_ITEMS.sort((a, b) => (a.qty_in_stock / a.min_qty) - (b.qty_in_stock / b.min_qty)).map(i => {
                const status = i.qty_in_stock === 0 ? "critical" : i.qty_in_stock <= i.min_qty ? "low" : "ok"
                return (
                  <TableRow key={i.id} className={status === "critical" ? "bg-destructive/5" : status === "low" ? "bg-yellow-50/50" : ""}>
                    <TableCell className="font-mono text-xs">{i.code}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell><Badge variant="outline">{i.category}</Badge></TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${status === "critical" ? "text-destructive" : status === "low" ? "text-yellow-600" : "text-green-600"}`}>
                        {i.qty_in_stock}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{i.unit}</span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{i.min_qty}</TableCell>
                    <TableCell>
                      <Badge variant={status === "critical" ? "destructive" : status === "low" ? "warning" : "success"}>
                        {status === "critical" ? "หมดสต็อก" : status === "low" ? "ใกล้หมด" : "ปกติ"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
