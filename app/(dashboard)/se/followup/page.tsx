"use client"

import { useEffect, useState } from "react"
import { Bell, Plus, Search, CheckCircle, Clock, XCircle } from "lucide-react"
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
import { FollowupStatusBadge } from "@/components/ui/status-badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import { AS_STORE_KEYS, readSESettings } from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { Badge } from "@/components/ui/badge"

interface Followup {
  id: string
  customer_name: string
  deal_title: string
  subject: string
  due_date: string
  status: "pending" | "done" | "cancelled"
  owner: string
  note: string
}

const followupSchema = z.object({
  customer_name: z.string().min(1),
  deal_title: z.string().min(1),
  subject: z.string().min(1, "กรุณากรอกสิ่งที่ต้องทำ"),
  due_date: z.string().min(1),
  owner: z.string().min(1),
  note: z.string().optional(),
  status: z.enum(["pending", "done", "cancelled"]),
})

type FollowupForm = z.infer<typeof followupSchema>

const today = new Date().toISOString().split("T")[0]

export default function FollowupPage() {
  const { profile } = useAuth()
  const [followups, setFollowups] = useState<Followup[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Followup | null>(null)
  const [seSettings, setSESettings] = useState(readSESettings())
  const { toast } = useToast()

  useEffect(() => {
    const sync = () => setSESettings(readSESettings())
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seSettings) sync()
    }
    sync()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const { register, handleSubmit, setValue, reset } = useForm<FollowupForm>({
    resolver: zodResolver(followupSchema),
    defaultValues: { status: "pending", due_date: today },
  })

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleFollowups = !isAdmin && ownerName ? followups.filter((f) => (f.owner || "").trim() === ownerName) : followups

  const filtered = visibleFollowups.filter(f => {
    const matchSearch = f.subject.includes(search) || f.customer_name.includes(search)
    const matchStatus = filterStatus === "all" || f.status === filterStatus
    return matchSearch && matchStatus
  })

  const overdue = visibleFollowups.filter(f => f.status === "pending" && f.due_date < today)
  const pending = visibleFollowups.filter(f => f.status === "pending" && f.due_date >= today)
  const done = visibleFollowups.filter(f => f.status === "done")

  function openAdd() {
    setEditTarget(null)
    reset({ status: "pending", due_date: today, owner: isAdmin ? "" : ownerName })
    setDialogOpen(true)
  }

  function openEdit(f: Followup) {
    setEditTarget(f)
    reset(f)
    setDialogOpen(true)
  }

  function markDone(id: string) {
    setFollowups(prev => prev.map(f => f.id === id ? { ...f, status: "done" } : f))
    toast({ title: "ทำเครื่องหมายเสร็จแล้ว" })
  }

  function onSubmit(data: FollowupForm) {
    const owner = isAdmin ? data.owner : (ownerName || data.owner)
    if (editTarget) {
      setFollowups(prev => prev.map(f => f.id === editTarget.id ? { ...f, ...data, owner } : f))
      toast({ title: "แก้ไขสำเร็จ" })
    } else {
      setFollowups(prev => [{ ...data, owner, id: Date.now().toString(), note: data.note ?? "" }, ...prev])
      toast({ title: "เพิ่ม Follow-up สำเร็จ" })
    }
    setDialogOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="ติดตามลูกค้า (Follow-up)"
        description="รายการสิ่งที่ต้องทำและติดตาม"
        icon={Bell}
        action={{ label: "เพิ่ม Follow-up", onClick: openAdd, icon: Plus }}
      />
      {!isAdmin && (
        <div className="mb-4">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className={overdue.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className={`h-8 w-8 ${overdue.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm text-muted-foreground">เกินกำหนด</p>
              <p className={`text-3xl font-bold ${overdue.length > 0 ? "text-destructive" : ""}`}>{overdue.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
              <p className="text-3xl font-bold text-yellow-600">{pending.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">เสร็จแล้ว</p>
              <p className="text-3xl font-bold text-green-600">{done.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหา..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="pending">รอดำเนินการ</SelectItem>
            <SelectItem value="done">เสร็จแล้ว</SelectItem>
            <SelectItem value="cancelled">ยกเลิก</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>สิ่งที่ต้องทำ</TableHead>
                <TableHead>ลูกค้า / ดีล</TableHead>
                <TableHead>กำหนดวันที่</TableHead>
                <TableHead>ผู้รับผิดชอบ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">ไม่พบข้อมูล</TableCell>
                </TableRow>
              ) : filtered.map(f => {
                const isOverdue = f.status === "pending" && f.due_date < today
                return (
                  <TableRow key={f.id} className={isOverdue ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <p className="font-medium">{f.subject}</p>
                      {f.note && <p className="text-xs text-muted-foreground">{f.note}</p>}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{f.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{f.deal_title}</p>
                    </TableCell>
                    <TableCell>
                      <span className={isOverdue ? "text-destructive font-medium" : ""}>{formatDate(f.due_date)}</span>
                      {isOverdue && <p className="text-xs text-destructive">เกินกำหนด</p>}
                    </TableCell>
                    <TableCell>{f.owner}</TableCell>
                    <TableCell><FollowupStatusBadge status={f.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {f.status === "pending" && (
                          <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" onClick={() => markDone(f.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? "แก้ไข Follow-up" : "เพิ่ม Follow-up ใหม่"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-1.5">
                <Label>สิ่งที่ต้องทำ *</Label>
                <Input placeholder="เช่น ส่งใบเสนอราคา, โทรติดตาม..." {...register("subject")} />
              </div>
              <div className="space-y-1.5">
                <Label>ลูกค้า *</Label>
                <Select onValueChange={v => setValue("customer_name", v)} defaultValue={editTarget?.customer_name}>
                  <SelectTrigger><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
                  <SelectContent>{seSettings.se_customers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ดีล / โครงการ</Label>
                <Input placeholder="ชื่อดีล..." {...register("deal_title")} />
              </div>
              <div className="space-y-1.5">
                <Label>กำหนดวันที่ *</Label>
                <Input type="date" {...register("due_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>ผู้รับผิดชอบ *</Label>
                <Select onValueChange={v => setValue("owner", v)} defaultValue={isAdmin ? editTarget?.owner : ownerName} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue placeholder="เลือก SE" /></SelectTrigger>
                  <SelectContent>{seSettings.se_owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                {!isAdmin && <p className="text-[11px] text-muted-foreground">SE staff ถูกล็อก owner เป็นบัญชีของตัวเอง</p>}
              </div>
              {editTarget && (
                <div className="space-y-1.5">
                  <Label>สถานะ</Label>
                  <Select onValueChange={v => setValue("status", v as any)} defaultValue={editTarget.status}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">รอดำเนินการ</SelectItem>
                      <SelectItem value="done">เสร็จแล้ว</SelectItem>
                      <SelectItem value="cancelled">ยกเลิก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label>หมายเหตุ</Label>
                <Input placeholder="หมายเหตุ..." {...register("note")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit">{editTarget ? "บันทึก" : "เพิ่ม"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
