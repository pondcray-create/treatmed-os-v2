"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Search, Globe2, Timer, RefreshCcw, CheckCircle2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ServiceStatusBadge, PriorityBadge } from "@/components/ui/status-badge"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/utils"
import {
  AS_STORE_KEYS,
  readCommissioningClaimCases,
  readJobs,
  type ASCommissioningClaimCase,
  type ASServiceJob,
} from "@/lib/mock/as-store"

interface ServiceRequest {
  id: string
  ticket_no: string
  customer_name: string
  equipment_name: string
  serial_no: string
  issue_description: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "in_progress" | "completed" | "cancelled"
  assigned_to: string
  created_at: string
  updated_at: string
}

function mapJobStatusToMonitor(status: ASServiceJob["status"]): ServiceRequest["status"] {
  if (status === "ปิดงาน") return "completed"
  if (status === "ยกเลิก") return "cancelled"
  if (["กำลังประเมิน", "ในคิว", "กำลังซ่อม", "รออะไหล่", "QC", "รอส่งคืน"].includes(status)) return "in_progress"
  return "pending"
}

function mapJobPriorityToMonitor(priority: ASServiceJob["priority"]): ServiceRequest["priority"] {
  if (priority === "normal") return "low"
  return priority
}

const STATUS_COLUMNS = [
  { key: "pending" as const, label: "รอดำเนินการ", color: "bg-yellow-50 border-yellow-200" },
  { key: "in_progress" as const, label: "กำลังดำเนินการ", color: "bg-blue-50 border-blue-200" },
  { key: "completed" as const, label: "เสร็จสิ้น", color: "bg-green-50 border-green-200" },
  { key: "cancelled" as const, label: "ยกเลิก", color: "bg-gray-50 border-gray-200" },
]

export default function ServiceMonitorPage() {
  const [search, setSearch] = useState("")
  const [filterTech, setFilterTech] = useState("all")
  const [jobs, setJobs] = useState<ASServiceJob[]>([])
  const [claimCases, setClaimCases] = useState<ASCommissioningClaimCase[]>([])

  useEffect(() => {
    const syncJobs = () => setJobs(readJobs([]))
    const syncClaims = () => setClaimCases(readCommissioningClaimCases([]))
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) {
        syncJobs()
        syncClaims()
        return
      }
      if (ev.key === AS_STORE_KEYS.jobs || ev.key === AS_STORE_KEYS.jobsVersion) syncJobs()
      if (ev.key === AS_STORE_KEYS.commissioningClaimCases) syncClaims()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.jobs || key === AS_STORE_KEYS.jobsVersion) syncJobs()
      if (key === AS_STORE_KEYS.commissioningClaimCases) syncClaims()
    }
    syncJobs()
    syncClaims()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const monitorRows = useMemo<ServiceRequest[]>(
    () =>
      jobs.map((j) => ({
        id: j.id,
        ticket_no: j.job_no,
        customer_name: j.customer_org || "-",
        equipment_name: j.model || "-",
        serial_no: j.serial_number || "-",
        issue_description: j.symptom_reported || "-",
        priority: mapJobPriorityToMonitor(j.priority),
        status: mapJobStatusToMonitor(j.status),
        assigned_to: j.technician || j.assigned_engineer || "",
        created_at: j.created_at,
        updated_at: j.stock_return_received_at || j.created_at,
      })),
    [jobs],
  )

  const filtered = monitorRows.filter(r => {
    const matchSearch = r.ticket_no.includes(search) || r.customer_name.includes(search) || r.equipment_name.includes(search)
    const matchTech = filterTech === "all" || r.assigned_to === filterTech
    return matchSearch && matchTech
  })

  const technicians = [...new Set(monitorRows.map(r => r.assigned_to).filter(Boolean))]
  const today = new Date().toISOString().slice(0, 10)
  const diffDays = (fromISO?: string, toISO?: string) => {
    if (!fromISO || !toISO) return 0
    const from = new Date(fromISO.slice(0, 10)).getTime()
    const to = new Date(toISO.slice(0, 10)).getTime()
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
    return Math.max(0, Math.floor((to - from) / 86400000))
  }
  const claimMetrics = useMemo(() => {
    const open = claimCases.filter((c) => c.status !== "closed")
    const closed = claimCases.filter((c) => c.status === "closed")
    const avgCloseDays = closed.length > 0
      ? Math.round(
          closed.reduce((sum, c) => sum + diffDays(c.failed_at, c.closed_at || c.failed_at), 0) / closed.length,
        )
      : 0
    const aging30 = open.filter((c) => diffDays(c.failed_at, today) >= 30).length
    const waitingReplacement = open.filter((c) => c.status === "sent_overseas").length
    const inReCommissioning = open.filter((c) => c.status === "replacement_commissioning").length
    return { open, closed, avgCloseDays, aging30, waitingReplacement, inReCommissioning }
  }, [claimCases, today])

  return (
    <div>
      <PageHeader
        title="ติดตามงานซ่อม (Service Monitor)"
        description="ดูสถานะงานซ่อมทั้งหมดแบบ Kanban"
        icon={Activity}
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหา ticket, ลูกค้า..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterTech} onValueChange={setFilterTech}>
          <SelectTrigger className="w-48"><SelectValue placeholder="ทุกช่าง" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกช่าง</SelectItem>
            {technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map(col => {
          const colItems = filtered.filter(r => r.status === col.key)
          return (
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <Badge variant="secondary">{colItems.length}</Badge>
              </div>
              <div className="space-y-3">
                {colItems.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-6">ไม่มีงาน</p>
                )}
                {colItems.map(r => (
                  <Card key={r.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-mono text-xs text-muted-foreground">{r.ticket_no}</span>
                        <PriorityBadge priority={r.priority} />
                      </div>
                      <p className="font-medium text-sm leading-tight">{r.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{r.equipment_name}</p>
                      <p className="text-xs text-foreground/70 line-clamp-2">{r.issue_description}</p>
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-xs text-muted-foreground">
                          {r.assigned_to || "ยังไม่มอบหมาย"}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Globe2 className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold">Claim Dashboard (Commissioning Fail {"->"} Overseas {"->"} Replacement)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="p-4 flex items-center gap-3">
              <Timer className="h-7 w-7 text-amber-700" />
              <div>
                <p className="text-xs text-muted-foreground">Open Claims</p>
                <p className="text-2xl font-bold text-amber-700">{claimMetrics.open.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="p-4 flex items-center gap-3">
              <RefreshCcw className="h-7 w-7 text-blue-700" />
              <div>
                <p className="text-xs text-muted-foreground">Waiting Replacement</p>
                <p className="text-2xl font-bold text-blue-700">{claimMetrics.waitingReplacement}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-indigo-50/40">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-7 w-7 text-indigo-700" />
              <div>
                <p className="text-xs text-muted-foreground">Re-Commissioning</p>
                <p className="text-2xl font-bold text-indigo-700">{claimMetrics.inReCommissioning}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-700" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Cycle Time</p>
                <p className="text-2xl font-bold text-emerald-700">{claimMetrics.avgCloseDays} วัน</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Claim Cases</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim Ref</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Old SN</TableHead>
                  <TableHead>Replacement SN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aging</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimMetrics.open.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-7 text-center text-sm text-muted-foreground">
                      ยังไม่มีเคส Claim ที่เปิดอยู่
                    </TableCell>
                  </TableRow>
                ) : (
                  claimMetrics.open
                    .sort((a, b) => diffDays(b.failed_at, today) - diffDays(a.failed_at, today))
                    .map((c) => {
                      const age = diffDays(c.failed_at, today)
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs font-mono">{c.claim_reference || "-"}</TableCell>
                          <TableCell className="text-sm">{c.customer_org}</TableCell>
                          <TableCell className="text-sm">{c.model}</TableCell>
                          <TableCell className="text-xs font-mono">{c.old_serial_number}</TableCell>
                          <TableCell className="text-xs font-mono">{c.replacement_serial_number || "-"}</TableCell>
                          <TableCell className="text-xs">{c.status}</TableCell>
                          <TableCell>
                            <Badge variant={age >= 30 ? "destructive" : age >= 14 ? "warning" : "secondary"}>{age} วัน</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {claimMetrics.aging30 > 0 && (
          <p className="text-xs text-rose-700 mt-2">มีเคสค้างมากกว่า 30 วัน: {claimMetrics.aging30} เคส</p>
        )}
      </div>
    </div>
  )
}
