"use client"

import { useEffect, useMemo, useState } from "react"
import { Handshake, Plus, Search, Pencil, Phone, Mail, Calendar } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DealStageBadge } from "@/components/ui/status-badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import { readSESettings } from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"

interface Deal {
  id: string
  deal_no: string
  customer_name: string
  title: string
  stage: string
  value: number
  probability: number
  expected_close_date: string
  owner: string
}

interface Activity {
  id: string
  deal_id: string
  type: "call" | "email" | "meeting" | "demo"
  subject: string
  note: string
  date: string
}

const MOCK_DEALS: Deal[] = [
  { id: "1", deal_no: "DEAL-001", customer_name: "โรงพยาบาลกรุงเทพ", title: "MRI 3T ใหม่", stage: "negotiation", value: 25000000, probability: 70, expected_close_date: "2024-04-30", owner: "คุณอนันต์" },
  { id: "2", deal_no: "DEAL-002", customer_name: "โรงพยาบาลรามาธิบดี", title: "CT Scan 128 Slice", stage: "proposal", value: 15000000, probability: 50, expected_close_date: "2024-05-15", owner: "คุณนภา" },
  { id: "3", deal_no: "DEAL-003", customer_name: "โรงพยาบาลมหาราชนครเชียงใหม่", title: "Ultrasound High-end", stage: "qualified", value: 8000000, probability: 30, expected_close_date: "2024-06-01", owner: "คุณอนันต์" },
  { id: "4", deal_no: "DEAL-004", customer_name: "คลินิกสุขภาพดี", title: "X-Ray Digital", stage: "lead", value: 3500000, probability: 20, expected_close_date: "2024-07-01", owner: "คุณรัตนา" },
  { id: "5", deal_no: "DEAL-005", customer_name: "โรงพยาบาลสมิติเวช", title: "Mammography", stage: "won", value: 12000000, probability: 100, expected_close_date: "2024-03-01", owner: "คุณนภา" },
]

const MOCK_ACTIVITIES: Activity[] = [
  { id: "1", deal_id: "1", type: "meeting", subject: "ประชุมนำเสนอสเปค", note: "ลูกค้าสนใจ รอใบเสนอราคา", date: "2024-03-15" },
  { id: "2", deal_id: "1", type: "call", subject: "โทรติดตาม", note: "ลูกค้าต้องการเวลาพิจารณา 2 สัปดาห์", date: "2024-03-18" },
  { id: "3", deal_id: "2", type: "demo", subject: "Demo สินค้า", note: "ประทับใจ ขอใบเสนอราคา", date: "2024-03-10" },
]

const ACTIVITY_ICONS = { call: Phone, email: Mail, meeting: Calendar, demo: Calendar }
const ACTIVITY_LABELS = { call: "โทร", email: "อีเมล", meeting: "ประชุม", demo: "Demo" }

const activitySchema = z.object({
  deal_id: z.string().min(1),
  type: z.enum(["call", "email", "meeting", "demo"]),
  subject: z.string().min(1, "กรุณากรอกหัวข้อ"),
  note: z.string().optional(),
  date: z.string(),
})

type ActivityForm = z.infer<typeof activitySchema>

export default function DealsPage() {
  const { profile } = useAuth()
  const [deals] = useState<Deal[]>(MOCK_DEALS)
  const [seSettings, setSESettings] = useState(readSESettings())
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES)
  const [search, setSearch] = useState("")
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [actDialogOpen, setActDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const sync = () => setSESettings(readSESettings())
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [])

  const { register, handleSubmit, setValue, reset } = useForm<ActivityForm>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "call", date: new Date().toISOString().split("T")[0] },
  })

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleDeals = !isAdmin && ownerName ? deals.filter((d) => (d.owner || "").trim() === ownerName) : deals

  const filtered = visibleDeals.filter(d =>
    d.title.includes(search) || d.customer_name.includes(search) || d.deal_no.includes(search)
  )

  const dealActivities = selectedDeal ? activities.filter(a => a.deal_id === selectedDeal.id) : []
  const knownStages = useMemo(() => new Set(seSettings.se_stages), [seSettings.se_stages])

  function addActivity(data: ActivityForm) {
    setActivities(prev => [{
      ...data,
      id: Date.now().toString(),
      note: data.note ?? "",
    }, ...prev])
    toast({ title: "บันทึก Activity สำเร็จ" })
    setActDialogOpen(false)
    reset()
  }

  return (
    <div>
      <PageHeader title="Deal & Activity" description="จัดการดีลและ activity" icon={Handshake} />
      {!isAdmin && (
        <div className="mb-4">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deal List */}
        <div className="col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหาดีล..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(d => (
            <Card
              key={d.id}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedDeal?.id === d.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedDeal(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setSelectedDeal(d)
                }
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-tight">{d.title}</p>
                  <DealStageBadge stage={d.stage} />
                </div>
                {!knownStages.has(d.stage) && (
                  <p className="text-[11px] text-amber-600 font-medium">Stage นี้ไม่อยู่ใน Settings ล่าสุด</p>
                )}
                <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">{formatCurrency(d.value)}</span>
                  <span className="text-xs text-muted-foreground">{d.owner}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Deal Detail + Activities */}
        <div className="col-span-2">
          {!selectedDeal ? (
            <Card className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">เลือกดีลเพื่อดูรายละเอียด</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedDeal.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{selectedDeal.deal_no} · {selectedDeal.customer_name}</p>
                    </div>
                    <DealStageBadge stage={selectedDeal.stage} />
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><p className="text-xs text-muted-foreground">มูลค่า</p><p className="font-semibold">{formatCurrency(selectedDeal.value)}</p></div>
                  <div><p className="text-xs text-muted-foreground">โอกาส</p><p className="font-semibold">{selectedDeal.probability}%</p></div>
                  <div><p className="text-xs text-muted-foreground">วันที่คาดปิด</p><p className="font-semibold">{formatDate(selectedDeal.expected_close_date)}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Activity Log</CardTitle>
                    <Button size="sm" onClick={() => { setValue("deal_id", selectedDeal.id); setActDialogOpen(true) }}>
                      <Plus className="h-4 w-4" /> บันทึก Activity
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {dealActivities.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-6">ยังไม่มี activity</p>
                  ) : (
                    <div className="space-y-3">
                      {dealActivities.map(a => {
                        const Icon = ACTIVITY_ICONS[a.type]
                        return (
                          <div key={a.id} className="flex gap-3 pb-3 border-b last:border-0">
                            <div className="p-2 bg-primary/10 rounded-lg h-fit">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{ACTIVITY_LABELS[a.type]}</Badge>
                                <span className="font-medium text-sm">{a.subject}</span>
                              </div>
                              {a.note && <p className="text-xs text-muted-foreground mt-1">{a.note}</p>}
                              <p className="text-xs text-muted-foreground mt-1">{formatDate(a.date)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Activity Dialog */}
      <Dialog open={actDialogOpen} onOpenChange={setActDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>บันทึก Activity</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(addActivity)}>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <Select onValueChange={v => setValue("type", v as any)} defaultValue="call">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">โทรศัพท์</SelectItem>
                    <SelectItem value="email">อีเมล</SelectItem>
                    <SelectItem value="meeting">ประชุม</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>หัวข้อ *</Label>
                <Input placeholder="เช่น ประชุมนำเสนอ..." {...register("subject")} />
              </div>
              <div className="space-y-1.5">
                <Label>หมายเหตุ / ผลการพูดคุย</Label>
                <Input placeholder="บันทึกผลการติดต่อ..." {...register("note")} />
              </div>
              <div className="space-y-1.5">
                <Label>วันที่</Label>
                <Input type="date" {...register("date")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setActDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
