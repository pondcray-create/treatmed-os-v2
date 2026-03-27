"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart2, AlertTriangle, CheckCircle, Package, ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { AS_STORE_KEYS, readStockItems, readStockTransactionsLedger } from "@/lib/mock/as-store"
import { formatThDateFromYMD } from "@/lib/format-th-datetime"

type StockMonitorItem = {
  id: string
  name: string
  category: string
  unit: string
  qty: number
  minQty: number
  status: string
  serial?: string
  hasSerial: boolean
  lastCal?: string
  dueCal?: string
  loanDue?: string
  stockedAt?: string
  lastMoveAt?: string
  ageDays: number
  idleDays: number
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function diffDays(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime()
  const to = new Date(`${toISO}T00:00:00`).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.floor((to - from) / 86400000))
}

export default function StockMonitorPage() {
  const [items, setItems] = useState<StockMonitorItem[]>([])
  const today = todayISO()

  useEffect(() => {
    const sync = () => {
      const raw = readStockItems([]) as unknown as Array<Record<string, unknown>>
      const tx = readStockTransactionsLedger<Array<Record<string, unknown>>>([])
      const lastMoveByItem = new Map<string, string>()
      for (const row of tx) {
        const itemId = String(row.item_id || "").trim()
        const d = String(row.date || "").slice(0, 10)
        if (!itemId || !d) continue
        const prev = lastMoveByItem.get(itemId)
        if (!prev || d > prev) lastMoveByItem.set(itemId, d)
      }
      const mapped: StockMonitorItem[] = raw.map((i) => ({
        id: String(i.id || ""),
        name: String(i.name || "—"),
        category: String(i.category || "unknown"),
        unit: String(i.unit || "ชิ้น"),
        qty: Math.max(0, Math.floor(Number(i.qty || 0))),
        minQty: Math.max(0, Math.floor(Number(i.min_qty || 0))),
        status: String(i.status || "in_stock"),
        serial: String(i.serial_number || "") || undefined,
        hasSerial: Boolean(i.has_serial),
        lastCal: String(i.last_calibration_date || "") || undefined,
        dueCal: String(i.calibration_due_date || "") || undefined,
        loanDue: String(i.loan_due || "") || undefined,
        stockedAt: String(i.stocked_at || "").slice(0, 10) || undefined,
        lastMoveAt: lastMoveByItem.get(String(i.id || "").trim()),
        ageDays: diffDays(String(i.stocked_at || "").slice(0, 10) || today, today),
        idleDays: diffDays(lastMoveByItem.get(String(i.id || "").trim()) || String(i.stocked_at || "").slice(0, 10) || today, today),
      }))
      setItems(mapped)
    }
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key !== AS_STORE_KEYS.stockItems && ev.key !== AS_STORE_KEYS.stockItemsVersion) return
      sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key && key !== AS_STORE_KEYS.stockItems && key !== AS_STORE_KEYS.stockItemsVersion) return
      sync()
    }
    sync()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const metrics = useMemo(() => {
    const critical = items.filter((i) => i.qty === 0)
    const low = items.filter((i) => i.qty > 0 && i.minQty > 0 && i.qty <= i.minQty)
    const ok = items.filter((i) => !(i.qty === 0 || (i.qty > 0 && i.minQty > 0 && i.qty <= i.minQty)))
    const missingSerial = items.filter((i) => i.hasSerial && !i.serial)
    const pendingQc = items.filter((i) => i.status === "pending_qc")
    const overdueLoan = items.filter((i) => i.status === "on_loan" && i.loanDue && i.loanDue < today)
    const stagnant30 = items.filter((i) => (i.status === "in_stock" || i.status === "reserved") && i.idleDays >= 30)
    const stagnant60 = items.filter((i) => (i.status === "in_stock" || i.status === "reserved") && i.idleDays >= 60)
    const stagnant90 = items.filter((i) => (i.status === "in_stock" || i.status === "reserved") && i.idleDays >= 90)
    const calibrationDueSoon = items.filter(
      (i) => i.dueCal && i.dueCal >= today && (new Date(i.dueCal).getTime() - new Date(today).getTime()) / 86400000 <= 30,
    )
    const calibrationOverdue = items.filter((i) => i.dueCal && i.dueCal < today)

    const total = Math.max(1, items.length)
    const stockAvailabilityScore = Math.max(0, 100 - (critical.length / total) * 100 - (low.length / total) * 40)
    const dataQualityScore = Math.max(0, 100 - (missingSerial.length / total) * 100 - (pendingQc.length / total) * 50)
    const complianceScore = Math.max(0, 100 - (calibrationOverdue.length / total) * 100 - (overdueLoan.length / total) * 80 - (stagnant90.length / total) * 40)
    const healthScore = Math.round(stockAvailabilityScore * 0.45 + dataQualityScore * 0.3 + complianceScore * 0.25)

    return {
      critical,
      low,
      ok,
      missingSerial,
      pendingQc,
      overdueLoan,
      stagnant30,
      stagnant60,
      stagnant90,
      calibrationDueSoon,
      calibrationOverdue,
      healthScore,
      riskCount: missingSerial.length + pendingQc.length + overdueLoan.length + calibrationOverdue.length + stagnant60.length,
    }
  }, [items, today])

  const statusChart = useMemo(
    () => [
      { name: "หมดสต็อก", value: metrics.critical.length, color: "#ef4444" },
      { name: "ใกล้หมด", value: metrics.low.length, color: "#f59e0b" },
      { name: "ปกติ", value: metrics.ok.length, color: "#22c55e" },
    ],
    [metrics],
  )

  const qualityChart = useMemo(
    () => [
      { name: "Missing SN", value: metrics.missingSerial.length, color: "#dc2626" },
      { name: "Pending QC", value: metrics.pendingQc.length, color: "#f59e0b" },
      { name: "Overdue Loan", value: metrics.overdueLoan.length, color: "#a855f7" },
      { name: "Cal Overdue", value: metrics.calibrationOverdue.length, color: "#0ea5e9" },
      { name: "Stagnant 60d+", value: metrics.stagnant60.length, color: "#334155" },
    ],
    [metrics],
  )

  const agingChart = useMemo(() => {
    const stockLike = items.filter((i) => i.status === "in_stock" || i.status === "reserved")
    return [
      { name: "0-30 วัน", value: stockLike.filter((i) => i.idleDays < 30).length, color: "#22c55e" },
      { name: "31-60 วัน", value: stockLike.filter((i) => i.idleDays >= 30 && i.idleDays < 60).length, color: "#f59e0b" },
      { name: "61-90 วัน", value: stockLike.filter((i) => i.idleDays >= 60 && i.idleDays < 90).length, color: "#fb7185" },
      { name: "90+ วัน", value: stockLike.filter((i) => i.idleDays >= 90).length, color: "#dc2626" },
    ]
  }, [items])

  const riskRows = useMemo(() => {
    return items
      .map((i) => {
        const issues: string[] = []
        if (i.qty === 0) issues.push("Out of stock")
        else if (i.minQty > 0 && i.qty <= i.minQty) issues.push("Low stock")
        if (i.hasSerial && !i.serial) issues.push("Missing serial")
        if (i.status === "pending_qc") issues.push("Pending QC")
        if (i.status === "on_loan" && i.loanDue && i.loanDue < today) issues.push("Overdue loan")
        if (i.dueCal && i.dueCal < today) issues.push("Calibration overdue")
        if ((i.status === "in_stock" || i.status === "reserved") && i.idleDays >= 60) issues.push("Stagnant stock")
        if (issues.length === 0) return null
        const severity = issues.length + (i.qty === 0 ? 2 : 0) + (issues.includes("Calibration overdue") ? 1 : 0)
        return { ...i, issues, severity }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.severity - a.severity)
  }, [items, today])

  const stagnantRows = useMemo(() => {
    return items
      .filter((i) => (i.status === "in_stock" || i.status === "reserved") && i.idleDays >= 30)
      .sort((a, b) => b.idleDays - a.idleDays)
  }, [items])

  return (
    <div>
      <PageHeader
        title="Stock Monitor Intelligence"
        description="Dashboard ภาพรวมความเสี่ยงสต็อก + Health Stock Quality เพื่อคุมคุณภาพคลังเชิงรุก"
        icon={BarChart2}
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="border-cyan-300/50 bg-cyan-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-cyan-700" />
            <div>
              <p className="text-sm text-muted-foreground">Health Stock Quality</p>
              <p className="text-3xl font-black text-cyan-700">{metrics.healthScore}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">หมดสต็อก</p>
              <p className="text-3xl font-bold text-destructive">{metrics.critical.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-300/50 bg-yellow-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">ใกล้หมด</p>
              <p className="text-3xl font-bold text-yellow-600">{metrics.low.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-300/50 bg-rose-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-rose-600" />
            <div>
              <p className="text-sm text-muted-foreground">Quality Risks</p>
              <p className="text-3xl font-bold text-rose-600">{metrics.riskCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-300/50 bg-slate-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-slate-700" />
            <div>
              <p className="text-sm text-muted-foreground">ค้างสต็อก 60+ วัน</p>
              <p className="text-3xl font-bold text-slate-700">{metrics.stagnant60.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusChart} margin={{ top: 8, right: 18, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="จำนวนรายการ" radius={[6, 6, 0, 0]}>
                  {statusChart.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health Stock Quality Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={qualityChart} margin={{ top: 8, right: 18, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="จำนวนความเสี่ยง" radius={[6, 6, 0, 0]}>
                  {qualityChart.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Aging (Idle Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingChart} margin={{ top: 8, right: 18, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="จำนวนรายการ" radius={[6, 6, 0, 0]}>
                  {agingChart.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Risk Items (Action Queue)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>สินค้า</TableHead>
                <TableHead>หมวด</TableHead>
                <TableHead className="text-center">คงเหลือ</TableHead>
                <TableHead>สถานะระบบ</TableHead>
                <TableHead>ประเด็นคุณภาพ</TableHead>
                <TableHead>Cal Due</TableHead>
                <TableHead>Idle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    ไม่มีความเสี่ยงสำคัญในตอนนี้
                  </TableCell>
                </TableRow>
              ) : (
                riskRows.slice(0, 30).map((i) => (
                  <TableRow key={i.id} className={i.severity >= 4 ? "bg-red-50/60" : i.severity >= 3 ? "bg-amber-50/60" : ""}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{i.name}</p>
                      {i.serial && <p className="text-xs text-gray-500 font-mono">SN: {i.serial}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{i.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${i.qty === 0 ? "text-red-600" : i.qty <= i.minQty && i.minQty > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {i.qty}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{i.unit}</span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">{i.status}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {i.issues.map((issue) => (
                          <Badge key={`${i.id}-${issue}`} variant="outline" className="text-[10px]">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {i.dueCal ? formatThDateFromYMD(i.dueCal) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">{i.idleDays}d</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">เครื่องค้างสต็อก 30+ วัน (Deep Dive)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>สินค้า</TableHead>
                <TableHead className="text-center">คงเหลือ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>รับเข้าล่าสุด</TableHead>
                <TableHead>Movement ล่าสุด</TableHead>
                <TableHead>ค้าง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stagnantRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    ไม่มีเครื่องค้างเกิน 30 วัน
                  </TableCell>
                </TableRow>
              ) : (
                stagnantRows.slice(0, 30).map((i) => (
                  <TableRow key={`stagnant-${i.id}`}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{i.name}</p>
                      {i.serial ? <p className="text-xs text-gray-500 font-mono">SN: {i.serial}</p> : null}
                    </TableCell>
                    <TableCell className="text-center">{i.qty}</TableCell>
                    <TableCell className="text-xs text-gray-600">{i.status}</TableCell>
                    <TableCell className="text-xs text-gray-600">{i.stockedAt ? formatThDateFromYMD(i.stockedAt) : "—"}</TableCell>
                    <TableCell className="text-xs text-gray-600">{i.lastMoveAt ? formatThDateFromYMD(i.lastMoveAt) : "—"}</TableCell>
                    <TableCell className="text-xs font-semibold text-red-600">{i.idleDays} วัน</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
