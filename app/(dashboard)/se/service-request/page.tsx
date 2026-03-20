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
import { appendIncomingSERequest, readJobs, type ASServiceJob } from "@/lib/mock/as-store"

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

const CUSTOMERS = ["โรงพยาบาลกรุงเทพ", "โรงพยาบาลรามาธิบดี", "โรงพยาบาลศิริราช", "โรงพยาบาลสมิติเวช", "โรงพยาบาลมหาราชนครเชียงใหม่"]
const OWNERS = ["คุณอนันต์", "คุณนภา", "คุณรัตนา"]

export default function SEServiceRequestPage() {
  const [requests, setRequests] = useState<SEServiceRequest[]>(MOCK_SR)
  const [serviceJobs, setServiceJobs] = useState<ASServiceJob[]>([])
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SEServiceRequest | null>(null)
  const { toast } = useToast()

  const { register, handleSubmit, setValue, reset } = useForm<SRForm>({
    resolver: zodResolver(srSchema),
    defaultValues: { request_type: "consultation", status: "pending" },
  })

  const filtered = requests.filter(r =>
    r.customer_name.includes(search) || r.ref_no.includes(search) || r.description.includes(search)
  )
  const serviceStatusBySourceId = useMemo(() => {
    const map = new Map<string, { status: ASServiceJob["status"]; updatedAt: string }>()
    serviceJobs
      .filter((j) => j.source === "se" && j.source_dispatch_id)
      .forEach((j) => {
        const lastLogAt = j.status_logs?.[j.status_logs.length - 1]?.at
        map.set(j.source_dispatch_id as string, {
          status: j.status,
          updatedAt: lastLogAt || j.created_at,
        })
      })
    return map
  }, [serviceJobs])

  const asStatusClass = (status: ASServiceJob["status"]) => {
    if (status === "ปิดงาน") return "bg-green-100 text-green-700 border-green-200"
    if (status === "ยกเลิก") return "bg-gray-100 text-gray-700 border-gray-200"
    if (status === "QC") return "bg-teal-100 text-teal-700 border-teal-200"
    if (status === "กำลังซ่อม" || status === "กำลังประเมิน") return "bg-blue-100 text-blue-700 border-blue-200"
    if (status === "รออะไหล่" || status === "รอ PO") return "bg-orange-100 text-orange-700 border-orange-200"
    return "bg-amber-100 text-amber-800 border-amber-200"
  }

  useEffect(() => {
    const sync = () => setServiceJobs(readJobs([]))
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    const timer = window.setInterval(sync, 1200)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
      window.clearInterval(timer)
    }
  }, [])

  function openAdd() {
    setEditTarget(null)
    reset({ request_type: "consultation", status: "pending" })
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
      const equipmentText = data.deal_title?.trim()
        ? `${data.deal_title.trim()}`
        : "SE Service Request"
      appendIncomingSERequest({
        id: requestId,
        customer_org: data.customer_name,
        equipment: equipmentText,
        issue_description: data.description,
        requested_by: data.owner,
        requested_at: createdDate,
        priority: "normal",
      })
      setRequests(prev => [{
        ...data,
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

      <div className="grid grid-cols-4 gap-4 mb-6">
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
                    {serviceStatusBySourceId.has(r.id) ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${asStatusClass(serviceStatusBySourceId.get(r.id)!.status)}`}>
                        {serviceStatusBySourceId.get(r.id)!.status}
                      </span>
                    ) : (
                      <Badge variant="outline">รอฝ่าย Service รับงาน</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {serviceStatusBySourceId.has(r.id)
                      ? formatDate(serviceStatusBySourceId.get(r.id)!.updatedAt)
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
                  <SelectContent>{CUSTOMERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                <Select onValueChange={v => setValue("owner", v)} defaultValue={editTarget?.owner}>
                  <SelectTrigger><SelectValue placeholder="เลือก SE" /></SelectTrigger>
                  <SelectContent>{OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
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
