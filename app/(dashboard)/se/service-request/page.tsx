"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Plus, Search } from "lucide-react"
import { useForm } from "react-hook-form"
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
  appendStockDispatch,
  readJobs,
  readSESettings,
  readStockDispatches,
  type ASServiceJob,
  type ASStockDispatch,
} from "@/lib/mock/as-store"

interface SEServiceRequest {
  id: string
  ref_no: string
  customer_name: string
  deal_title: string
  request_type: "installation" | "training" | "maintenance" | "consultation"
  description: string
  status: "pending" | "scheduled" | "completed" | "cancelled"
  scheduled_date: string
  owner: string
  created_at: string
}

const MOCK_SR: SEServiceRequest[] = [
  { id: "1", ref_no: "SESR-001", customer_name: "โรงพยาบาลสมิติเวช", deal_title: "Mammography", request_type: "installation", description: "ติดตั้งเครื่องหลังส่งมอบ", status: "scheduled", scheduled_date: "2024-03-25", owner: "คุณนภา", created_at: "2024-03-18" },
  { id: "2", ref_no: "SESR-002", customer_name: "โรงพยาบาลกรุงเทพ", deal_title: "MRI 3T ใหม่", request_type: "consultation", description: "ให้คำปรึกษาสเปคและการติดตั้ง", status: "pending", scheduled_date: "", owner: "คุณอนันต์", created_at: "2024-03-20" },
  { id: "3", ref_no: "SESR-003", customer_name: "โรงพยาบาลรามาธิบดี", deal_title: "CT Scan 128 Slice", request_type: "training", description: "อบรมการใช้งาน CT Scan รุ่นใหม่", status: "completed", scheduled_date: "2024-03-10", owner: "คุณนภา", created_at: "2024-03-05" },
]

const REQUEST_TYPE_LABELS = {
  installation: "ติดตั้ง",
  training: "อบรม",
  maintenance: "บำรุงรักษา",
  consultation: "ให้คำปรึกษา",
}

const srSchema = z.object({
  customer_name: z.string().min(1),
  deal_title: z.string().optional(),
  request_type: z.enum(["installation", "training", "maintenance", "consultation"]),
  description: z.string().min(1),
  status: z.enum(["pending", "scheduled", "completed", "cancelled"]),
  scheduled_date: z.string().optional(),
  owner: z.string().min(1),
})

type SRForm = z.infer<typeof srSchema>

const DEFAULT_CUSTOMERS = ["โรงพยาบาลกรุงเทพ", "โรงพยาบาลรามาธิบดี", "โรงพยาบาลศิริราช", "โรงพยาบาลสมิติเวช", "โรงพยาบาลมหาราชนครเชียงใหม่"]
const DEFAULT_OWNERS = ["คุณอนันต์", "คุณนภา", "คุณรัตนา"]

function seRefTag(id: string) {
  return `[SE_REQ:${id}]`
}

export default function SEServiceRequestPage() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<SEServiceRequest[]>(MOCK_SR)
  const [serviceJobs, setServiceJobs] = useState<ASServiceJob[]>([])
  const [stockDispatches, setStockDispatches] = useState<ASStockDispatch[]>([])
  const [seCustomers, setSeCustomers] = useState<string[]>(DEFAULT_CUSTOMERS)
  const [seOwners, setSeOwners] = useState<string[]>(DEFAULT_OWNERS)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SEServiceRequest | null>(null)
  const { toast } = useToast()

  const { register, handleSubmit, setValue, reset } = useForm<SRForm>({
    resolver: zodResolver(srSchema),
    defaultValues: { request_type: "consultation", status: "pending" },
  })

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
      const se = readSESettings()
      setSeCustomers(se.se_customers.length > 0 ? se.se_customers : DEFAULT_CUSTOMERS)
      setSeOwners(se.se_owners.length > 0 ? se.se_owners : DEFAULT_OWNERS)
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
    reset({ request_type: "consultation", status: "pending", owner: isAdmin ? "" : ownerName })
    setDialogOpen(true)
  }

  function openEdit(r: SEServiceRequest) {
    setEditTarget(r)
    reset(r)
    setDialogOpen(true)
  }

  function onSubmit(data: SRForm) {
    if (editTarget) {
      setRequests(prev => prev.map(r => r.id === editTarget.id ? { ...r, ...data } : r))
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
        job_type: "repair",
        routing: "in_country",
        dispatched_by: "SE",
        dispatched_at: new Date().toISOString(),
      })
      setRequests(prev => [{
        ...data,
        owner,
        id: requestId,
        ref_no: `SESR-${String(requests.length + 1).padStart(3, "0")}`,
        deal_title: data.deal_title ?? "",
        scheduled_date: data.scheduled_date ?? "",
        created_at: createdDate,
      }, ...prev])
      toast({ title: "สร้าง Service Request สำเร็จ" })
    }
    setDialogOpen(false)
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
                  <TableCell><Badge variant="outline">{REQUEST_TYPE_LABELS[r.request_type]}</Badge></TableCell>
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
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <Label>ลูกค้า *</Label>
                <Select onValueChange={v => setValue("customer_name", v)} defaultValue={editTarget?.customer_name}>
                  <SelectTrigger><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
                  <SelectContent>{seCustomers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ดีล / โครงการ</Label>
                <Input placeholder="ชื่อดีล..." {...register("deal_title")} />
              </div>
              <div className="space-y-1.5">
                <Label>ประเภทคำขอ</Label>
                <Select onValueChange={v => setValue("request_type", v as any)} defaultValue={editTarget?.request_type ?? "consultation"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="installation">ติดตั้ง</SelectItem>
                    <SelectItem value="training">อบรม</SelectItem>
                    <SelectItem value="maintenance">บำรุงรักษา</SelectItem>
                    <SelectItem value="consultation">ให้คำปรึกษา</SelectItem>
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
