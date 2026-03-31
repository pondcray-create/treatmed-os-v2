"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Plus, Search } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import {
  appendSEDealActivity,
  appendStockDispatch,
  readJobs,
  readSEDeals,
  readSEServiceRequests,
  readSESettings,
  readStockDispatches,
  writeSEServiceRequests,
  type ASServiceJob,
  type ASStockDispatch,
  type SEServiceRequestStored,
} from "@/lib/mock/as-store"
import { sortedOrgCustomerNames } from "@/lib/se/se-org-customers"

type SEServiceRequest = SEServiceRequestStored

const REQUEST_TYPE_LABELS = {
  repair: "Repair",
  calibration: "Calibrate",
  training: "อบรม",
}

const srSchema = z.object({
  customer_name: z.string().min(1),
  deal_title: z.string().optional(),
  deal_id: z.string().optional(),
  request_type: z.enum(["repair", "calibration", "training"]),
  description: z.string().min(1),
  status: z.enum(["pending", "scheduled", "completed", "cancelled"]),
  scheduled_date: z.string().optional(),
  owner: z.string().min(1),
})

type SRForm = z.infer<typeof srSchema>
type SRRequestType = SRForm["request_type"]

function seRefTag(id: string) {
  return `[SE_REQ:${id}]`
}

function normalizeRequestType(value?: string): SRRequestType {
  if (value === "calibration") return "calibration"
  if (value === "training") return "training"
  // Legacy mapping for stored data before request type refactor.
  if (value === "maintenance") return "repair"
  if (value === "installation") return "repair"
  if (value === "consultation") return "repair"
  return "repair"
}

function requestTypeLabel(value?: string): string {
  const normalized = normalizeRequestType(value)
  return REQUEST_TYPE_LABELS[normalized]
}

export default function SEServiceRequestPage() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<SEServiceRequest[]>(() => readSEServiceRequests([]))
  const [serviceJobs, setServiceJobs] = useState<ASServiceJob[]>([])
  const [stockDispatches, setStockDispatches] = useState<ASStockDispatch[]>([])
  const [customerOptions, setCustomerOptions] = useState<string[]>(() => sortedOrgCustomerNames())
  const [seOwners, setSeOwners] = useState<string[]>(() => readSESettings().se_owners)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SEServiceRequest | null>(null)
  const { toast } = useToast()

  const { register, handleSubmit, setValue, reset, control } = useForm<SRForm>({
    resolver: zodResolver(srSchema),
    defaultValues: { request_type: "repair", status: "pending", deal_id: "" },
  })

  const watchCustomer = useWatch({ control, name: "customer_name" })
  const watchDealId = useWatch({ control, name: "deal_id" })

  const dealsForCustomer = useMemo(() => {
    const c = (watchCustomer || "").trim()
    if (!c) return []
    return readSEDeals([]).filter((d) => d.customer_name.trim() === c)
  }, [watchCustomer])

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleRequests = !isAdmin && ownerName ? requests.filter((r) => (r.owner || "").trim() === ownerName) : requests
  const filtered = visibleRequests.filter(r =>
    r.customer_name.includes(search) || r.ref_no.includes(search) || r.description.includes(search)
  )
  const progressByRequestId = useMemo(() => {
    const map = new Map<string, { label: string; updatedAt: string; level: "stock" | "service" | "done" | "cancelled" }>()
    stockDispatches.forEach((d) => {
      const m = (d.symptom || "").match(/\[SE_REQ:([^\]]+)\]/)
      const id = m?.[1]
      if (!id) return
      map.set(id, { label: "รอ Stock ส่งต่อ Service", updatedAt: d.dispatched_at, level: "stock" })
    })
    serviceJobs
      .filter((j) => j.source === "stock")
      .forEach((j) => {
        const m = (j.symptom_reported || "").match(/\[SE_REQ:([^\]]+)\]/)
        const id = m?.[1]
        if (!id) return
        const lastLogAt = j.status_logs?.[j.status_logs.length - 1]?.at
        map.set(id, {
          label: j.status,
          updatedAt: lastLogAt || j.created_at,
          level: j.status === "ปิดงาน" ? "done" : j.status === "ยกเลิก" ? "cancelled" : "service",
        })
      })
    return map
  }, [serviceJobs, stockDispatches])

  const asStatusClass = (p: { label: string; level: "stock" | "service" | "done" | "cancelled" }) => {
    if (p.level === "done") return "bg-green-100 text-green-700 border-green-200"
    if (p.level === "cancelled") return "bg-gray-100 text-gray-700 border-gray-200"
    if (p.level === "stock") return "bg-violet-100 text-violet-700 border-violet-200"
    if (p.label === "QC") return "bg-teal-100 text-teal-700 border-teal-200"
    if (p.label === "กำลังซ่อม" || p.label === "กำลังประเมิน") return "bg-blue-100 text-blue-700 border-blue-200"
    if (p.label === "รออะไหล่" || p.label === "รอ PO") return "bg-orange-100 text-orange-700 border-orange-200"
    return "bg-amber-100 text-amber-800 border-amber-200"
  }

  useEffect(() => {
    const sync = () => {
      setServiceJobs(readJobs([]))
      setStockDispatches(readStockDispatches([]))
      setCustomerOptions(sortedOrgCustomerNames())
      const se = readSESettings()
      setSeOwners(se.se_owners)
      setRequests(readSEServiceRequests([]))
    }
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [])

  function openAdd() {
    setEditTarget(null)
    reset({
      request_type: "repair",
      status: "pending",
      owner: isAdmin ? "" : ownerName,
      deal_id: "",
      customer_name: "",
      deal_title: "",
      description: "",
      scheduled_date: "",
    })
    setDialogOpen(true)
  }

  function openEdit(r: SEServiceRequest) {
    setEditTarget(r)
    reset({
      customer_name: r.customer_name,
      deal_title: r.deal_title ?? "",
      deal_id: r.deal_id ?? "",
      request_type: normalizeRequestType(r.request_type),
      description: r.description,
      status: r.status,
      scheduled_date: r.scheduled_date ?? "",
      owner: r.owner,
    })
    setDialogOpen(true)
  }

  function onSubmit(data: SRForm) {
    if (editTarget) {
      const next = requests.map((r) =>
        r.id === editTarget.id
          ? {
              ...r,
              ...data,
              deal_title: data.deal_title ?? "",
              deal_id: data.deal_id?.trim() || undefined,
              scheduled_date: data.scheduled_date ?? "",
            }
          : r,
      )
      setRequests(next)
      writeSEServiceRequests(next)
      toast({ title: "อัปเดตสำเร็จ" })
    } else {
      const createdDate = new Date().toISOString().split("T")[0]
      const requestId = `se-${Date.now()}`
      const modelText = data.deal_title?.trim()
        ? `${data.deal_title.trim()}`
        : "SE Service Request"
      const owner = isAdmin ? data.owner : (ownerName || data.owner)
      appendStockDispatch({
        id: `dp-se-${Date.now()}`,
        item_name: modelText,
        manufacturer: "—",
        model: modelText,
        serial_number: "—",
        customer_org: data.customer_name,
        customer_contact: owner,
        symptom: `${data.description}\n${seRefTag(requestId)}`,
        receive_channel: "พนักงาน",
        job_type: data.request_type === "calibration" ? "calibration" : "repair",
        routing: "in_country",
        dispatched_by: "SE",
        dispatched_at: new Date().toISOString(),
      })
      const existing = readSEServiceRequests([])
      const ref_no = `SESR-${String(existing.length + 1).padStart(3, "0")}`
      const row: SEServiceRequest = {
        ...data,
        owner,
        id: requestId,
        ref_no,
        deal_title: data.deal_title ?? "",
        deal_id: data.deal_id?.trim() || undefined,
        scheduled_date: data.scheduled_date ?? "",
        created_at: createdDate,
      }
      const merged = [row, ...existing]
      setRequests(merged)
      writeSEServiceRequests(merged)
      const did = data.deal_id?.trim()
      if (did) {
        const actType = data.request_type === "training" ? "training_request" : "service_request"
        appendSEDealActivity({
          deal_id: did,
          activity_type: actType,
          source: "se_service_request",
          subject: `คำขอ${requestTypeLabel(data.request_type)} — ${ref_no}`,
          note: data.description.slice(0, 800),
          occurred_on: createdDate,
          actor_name: owner,
          meta: { ref_no, request_type: data.request_type },
        })
      }
      toast({ title: "สร้าง Service Request สำเร็จ" })
    }
    setDialogOpen(false)
  }

  function onInvalidSubmit() {
    toast({ title: "ส่ง SR ไม่สำเร็จ", description: "กรอกข้อมูลที่มี * ให้ครบก่อนส่ง", variant: "destructive" })
  }

  const statusVariant = (s: string) =>
    s === "completed" ? "success" : s === "scheduled" ? "info" : s === "cancelled" ? "destructive" : "warning"
  const statusLabel = (s: string) =>
    s === "completed" ? "เสร็จสิ้น" : s === "scheduled" ? "นัดหมายแล้ว" : s === "cancelled" ? "ยกเลิก" : "รอดำเนินการ"

  return (
    <div>
      <PageHeader
        title="Service Request (SE)"
        description="คำขอบริการหลังการขาย"
        icon={FileText}
        action={{ label: "สร้าง SR", onClick: openAdd, icon: Plus }}
      />
      {!isAdmin && (
        <div className="mb-4">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {["pending", "scheduled", "completed", "cancelled"].map(s => (
          <Card key={s}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{statusLabel(s)}</p>
              <p className="text-3xl font-bold">{requests.filter(r => r.status === s).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ค้นหา..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref No.</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead>วันที่นัด</TableHead>
                <TableHead>ผู้รับผิดชอบ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>สถานะจาก AS</TableHead>
                <TableHead>อัปเดตล่าสุดจาก AS</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">ไม่พบข้อมูล</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.ref_no}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{r.customer_name}</p>
                    {r.deal_title && <p className="text-xs text-muted-foreground">{r.deal_title}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{requestTypeLabel(r.request_type)}</Badge></TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{r.description}</TableCell>
                  <TableCell className="text-sm">{r.scheduled_date ? formatDate(r.scheduled_date) : "-"}</TableCell>
                  <TableCell>{r.owner}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status) as any}>{statusLabel(r.status)}</Badge></TableCell>
                  <TableCell>
                    {progressByRequestId.has(r.id) ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${asStatusClass(progressByRequestId.get(r.id)!)} `}>
                        {progressByRequestId.get(r.id)!.label}
                      </span>
                    ) : (
                      <Badge variant="outline">รอส่งเข้า Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {progressByRequestId.has(r.id)
                      ? formatDate(progressByRequestId.get(r.id)!.updatedAt)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? `แก้ไข ${editTarget.ref_no}` : "สร้าง Service Request"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <Label>ลูกค้า *</Label>
                <Select
                  onValueChange={(v) => {
                    setValue("customer_name", v)
                    setValue("deal_id", "")
                  }}
                  defaultValue={editTarget?.customer_name}
                >
                  <SelectTrigger><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ดีล / โครงการ</Label>
                <Input placeholder="ชื่อดีล..." {...register("deal_title")} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>ผูกดีลในระบบ (ไม่บังคับ) — สำหรับ Activity</Label>
                <Select
                  value={watchDealId && watchDealId.trim() ? watchDealId : "_none"}
                  onValueChange={(v) => setValue("deal_id", v === "_none" ? "" : v)}
                  disabled={!watchCustomer}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={watchCustomer ? "เลือกดีล" : "เลือกลูกค้าก่อน"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">ไม่ผูกดีล</SelectItem>
                    {dealsForCustomer.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.deal_no} · {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {watchCustomer && dealsForCustomer.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    ไม่มีดีลที่ชื่อลูกค้าตรงกับรายชื่อนี้ใน Pipeline
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>ประเภทคำขอ</Label>
                <Select onValueChange={v => setValue("request_type", v as any)} defaultValue={editTarget?.request_type ?? "repair"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="calibration">Calibrate</SelectItem>
                    <SelectItem value="training">อบรม</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>สถานะ</Label>
                <Select onValueChange={v => setValue("status", v as any)} defaultValue={editTarget?.status ?? "pending"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอดำเนินการ</SelectItem>
                    <SelectItem value="scheduled">นัดหมายแล้ว</SelectItem>
                    <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                    <SelectItem value="cancelled">ยกเลิก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>วันที่นัดหมาย</Label>
                <Input type="date" {...register("scheduled_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>ผู้รับผิดชอบ *</Label>
                <Select onValueChange={v => setValue("owner", v)} defaultValue={isAdmin ? editTarget?.owner : ownerName} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue placeholder="เลือก SE" /></SelectTrigger>
                  <SelectContent>{seOwners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>รายละเอียด *</Label>
                <Textarea placeholder="อธิบายสิ่งที่ต้องการ..." {...register("description")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit">{editTarget ? "บันทึก" : "สร้าง SR"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
