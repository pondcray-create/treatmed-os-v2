"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Handshake,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  Package,
  BookOpen,
  ClipboardList,
  FileText,
  CircleDot,
  ShoppingCart,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DealStageBadge } from "@/components/ui/status-badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  AS_STORE_KEYS,
  appendSEDealActivity,
  initialSESettingsForSSR,
  readSEDealActivities,
  readSEDeals,
  readSESettings,
  writeSEDeals,
  type SEDeal,
  type SEDealActivityRecord,
  type SEDealActivityType,
} from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { getSEStageNames } from "@/lib/se/se-pipeline-stages"
import { isLostStage } from "@/lib/se/se-sales-planning"
import { CUSTOMER_ORG_NAMING_HINT_EN, CUSTOMER_ORG_NAMING_HINT_TH } from "@/lib/se/se-customer-naming"

/** ดีลที่เปิดอยู่ไม่มี Activity / ครบกำหนดติดตาม = stale */
const STALE_NO_TOUCH_DAYS = 14

function ymdToUtc(d: string): number {
  const [y, m, day] = d.split("-").map(Number)
  return Date.UTC(y, (m || 1) - 1, day || 1)
}

function daysBetweenYMD(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / 86400000)
}

function isClosedStage(stage: string): boolean {
  const s = (stage || "").toLowerCase()
  return s.includes("won") || s.includes("lost") || s.includes("ชนะ") || s.includes("แพ้")
}

function isDealStale(deal: SEDeal, allActivities: SEDealActivityRecord[], todayYmd: string): boolean {
  if (!todayYmd) return false
  if (isClosedStage(deal.stage)) return false
  const fu = deal.next_followup_on?.trim()
  if (fu) {
    return fu < todayYmd
  }
  const dates = allActivities.filter((x) => x.deal_id === deal.id).map((x) => x.occurred_on)
  if (dates.length === 0) return true
  const sorted = [...dates].sort()
  const last = sorted[sorted.length - 1]!
  return daysBetweenYMD(last, todayYmd) > STALE_NO_TOUCH_DAYS
}

function activityTypeMeta(t: SEDealActivityType): { Icon: LucideIcon; label: string } {
  const map: Partial<Record<SEDealActivityType, { Icon: LucideIcon; label: string }>> = {
    call: { Icon: Phone, label: "โทร" },
    email: { Icon: Mail, label: "อีเมล" },
    meeting: { Icon: Calendar, label: "ประชุม" },
    demo: { Icon: Calendar, label: "Demo" },
    demo_loan: { Icon: Package, label: "ยืมเครื่อง" },
    training_request: { Icon: BookOpen, label: "ขออบรม" },
    stock_booking: { Icon: ClipboardList, label: "จองสต็อก" },
    service_request: { Icon: FileText, label: "คำขอบริการ" },
    order_request: { Icon: ShoppingCart, label: "Order Request" },
    other: { Icon: CircleDot, label: "อื่นๆ" },
  }
  return map[t] ?? { Icon: CircleDot, label: t }
}

const SOURCE_LABELS: Record<SEDealActivityRecord["source"], string> = {
  manual: "บันทึกเอง",
  stock_loan: "Stock · Loan",
  pipeline_booking: "Pipeline · จอง",
  se_service_request: "SE · Request",
  se_order_request: "SE · Order",
}

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
  const [deals, setDeals] = useState<SEDeal[]>([])
  const [seSettings, setSESettings] = useState(() => initialSESettingsForSSR())
  const [activities, setActivities] = useState<SEDealActivityRecord[]>([])
  const [search, setSearch] = useState("")
  const [selectedDeal, setSelectedDeal] = useState<SEDeal | null>(null)
  const [actDialogOpen, setActDialogOpen] = useState(false)
  const [followupDraft, setFollowupDraft] = useState("")
  const [adminQuoteDraft, setAdminQuoteDraft] = useState("")
  const [lostReasonDraft, setLostReasonDraft] = useState("")
  const [lostNoteDraft, setLostNoteDraft] = useState("")
  const [marketSegmentDraft, setMarketSegmentDraft] = useState("")
  const [customerNameEnDraft, setCustomerNameEnDraft] = useState("")
  const { toast } = useToast()

  const [todayYmd, setTodayYmd] = useState("")
  useEffect(() => {
    setTodayYmd(new Date().toISOString().slice(0, 10))
  }, [])

  const hydrateActivities = useCallback(() => setActivities(readSEDealActivities([])), [])
  const hydrateDeals = useCallback(() => setDeals(readSEDeals([])), [])

  useEffect(() => {
    const hydrateSettings = () => setSESettings(readSESettings())
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) hydrateSettings()
      if (!ev.key || ev.key === AS_STORE_KEYS.seDealActivities) hydrateActivities()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (key === AS_STORE_KEYS.seSettings) hydrateSettings()
      if (key === AS_STORE_KEYS.seDealActivities) hydrateActivities()
    }
    hydrateDeals()
    hydrateActivities()
    hydrateSettings()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [hydrateActivities, hydrateDeals])

  useEffect(() => {
    if (selectedDeal) {
      const fresh = readSEDeals([]).find((d) => d.id === selectedDeal.id)
      setFollowupDraft(fresh?.next_followup_on ?? "")
      setAdminQuoteDraft(fresh?.admin_quote_no ?? "")
      setMarketSegmentDraft(fresh?.market_segment ?? "")
      setCustomerNameEnDraft(fresh?.customer_name_english ?? "")
    } else {
      setFollowupDraft("")
      setAdminQuoteDraft("")
      setMarketSegmentDraft("")
      setCustomerNameEnDraft("")
    }
  }, [
    selectedDeal?.id,
    selectedDeal?.next_followup_on,
    selectedDeal?.admin_quote_no,
    selectedDeal?.market_segment,
    selectedDeal?.customer_name_english,
  ])

  useEffect(() => {
    if (selectedDeal && isLostStage(selectedDeal.stage)) {
      setLostReasonDraft(selectedDeal.lost_reason ?? "")
      setLostNoteDraft(selectedDeal.lost_reason_note ?? "")
    } else {
      setLostReasonDraft("")
      setLostNoteDraft("")
    }
  }, [selectedDeal?.id, selectedDeal?.stage, selectedDeal?.lost_reason, selectedDeal?.lost_reason_note])

  const { register, handleSubmit, setValue, reset } = useForm<ActivityForm>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "call", date: "" },
  })

  useEffect(() => {
    setValue("date", new Date().toISOString().split("T")[0])
  }, [setValue])

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleDeals = !isAdmin && ownerName ? deals.filter((d) => (d.owner || "").trim() === ownerName) : deals

  const filtered = visibleDeals.filter((d) => {
    const q = search.trim()
    if (!q) return true
    const hay = [
      d.title,
      d.customer_name,
      d.deal_no,
      d.market_segment ?? "",
      d.customer_name_english ?? "",
    ]
      .join(" ")
      .toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const dealActivities = selectedDeal
    ? activities.filter((a) => a.deal_id === selectedDeal.id).sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1))
    : []

  const knownStages = useMemo(() => new Set(getSEStageNames(seSettings)), [seSettings.se_pipeline_stages])

  const segmentSelectOptions = useMemo(() => {
    const base = [...seSettings.se_customer_segments]
    const cur = marketSegmentDraft.trim()
    if (cur && !base.includes(cur)) return [cur, ...base]
    return base
  }, [seSettings.se_customer_segments, marketSegmentDraft])

  const activityCountByDeal = useMemo(() => {
    const m = new Map<string, number>()
    activities.forEach((a) => m.set(a.deal_id, (m.get(a.deal_id) ?? 0) + 1))
    return m
  }, [activities])

  function addActivity(data: ActivityForm) {
    const actor = ownerName || profile?.email?.trim() || "SE"
    appendSEDealActivity({
      deal_id: data.deal_id,
      activity_type: data.type,
      source: "manual",
      subject: data.subject,
      note: data.note ?? "",
      occurred_on: data.date,
      actor_name: actor,
    })
    hydrateActivities()
    toast({ title: "บันทึก Activity สำเร็จ" })
    setActDialogOpen(false)
    reset()
  }

  function saveNextFollowup() {
    if (!selectedDeal) return
    const v = followupDraft.trim()
    const all = readSEDeals([])
    const next = all.map((d) =>
      d.id === selectedDeal.id ? { ...d, next_followup_on: v || undefined } : d,
    )
    writeSEDeals(next)
    hydrateDeals()
    const updated = next.find((d) => d.id === selectedDeal.id) ?? null
    setSelectedDeal(updated)
    toast({ title: "บันทึกวันติดตามถัดไปแล้ว" })
  }

  function saveAdminQuoteNo() {
    if (!selectedDeal) return
    const v = adminQuoteDraft.trim()
    const all = readSEDeals([])
    const next = all.map((d) =>
      d.id === selectedDeal.id ? { ...d, admin_quote_no: v || undefined } : d,
    )
    writeSEDeals(next)
    hydrateDeals()
    const updated = next.find((d) => d.id === selectedDeal.id) ?? null
    setSelectedDeal(updated)
    toast({ title: "บันทึกเลขใบเสนอราคา Admin แล้ว" })
  }

  function saveMarketSegmentFields() {
    if (!selectedDeal) return
    const seg = marketSegmentDraft.trim()
    const en = customerNameEnDraft.trim()
    if (seSettings.se_customer_segments.length > 0 && !seg) {
      toast({ title: "เลือก Segment ลูกค้า", variant: "destructive" })
      return
    }
    const all = readSEDeals([])
    const next = all.map((d) =>
      d.id === selectedDeal.id
        ? { ...d, market_segment: seg || undefined, customer_name_english: en || undefined }
        : d,
    )
    writeSEDeals(next)
    hydrateDeals()
    setSelectedDeal(next.find((d) => d.id === selectedDeal.id) ?? null)
    toast({ title: "บันทึก Segment / ชื่ออังกฤษแล้ว" })
  }

  function saveLostReason() {
    if (!selectedDeal || !isLostStage(selectedDeal.stage)) return
    const reason = lostReasonDraft.trim()
    if (!reason) {
      toast({ title: "กรุณาระบุสาเหตุที่แพ้", variant: "destructive" })
      return
    }
    const note = lostNoteDraft.trim()
    const prevR = (selectedDeal.lost_reason ?? "").trim()
    const prevN = (selectedDeal.lost_reason_note ?? "").trim()
    if (reason === prevR && note === prevN) {
      toast({ title: "ไม่มีการเปลี่ยนแปลง" })
      return
    }
    const actor = ownerName || profile?.email?.trim() || "SE"
    const all = readSEDeals([])
    const next = all.map((d) =>
      d.id === selectedDeal.id ? { ...d, lost_reason: reason, lost_reason_note: note || undefined } : d,
    )
    writeSEDeals(next)
    appendSEDealActivity({
      deal_id: selectedDeal.id,
      activity_type: "other",
      source: "manual",
      subject: `แก้สาเหตุแพ้: ${reason}`,
      note: note || "",
      occurred_on: new Date().toISOString().slice(0, 10),
      actor_name: actor,
    })
    hydrateDeals()
    hydrateActivities()
    setSelectedDeal(next.find((d) => d.id === selectedDeal.id) ?? null)
    toast({ title: "บันทึกสาเหตุแพ้แล้ว" })
  }

  return (
    <div>
      <PageHeader
        title="Deal & Activity"
        description={`บันทึก Activity ถาวร · ระบบสร้างอัตโนมัติจากจอง / ยืม / Request · stale ถ้าเกิน ${STALE_NO_TOUCH_DAYS} วันไม่มีเหตุการณ์หรือเลยกำหนดติดตาม`}
        icon={Handshake}
      />
      {!isAdmin && (
        <div className="mb-4">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาดีล..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filtered.map((d) => {
            const stale = isDealStale(d, activities, todayYmd)
            const ac = activityCountByDeal.get(d.id) ?? 0
            return (
              <Card
                key={d.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedDeal?.id === d.id && "ring-2 ring-primary",
                )}
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
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{d.title}</p>
                    <DealStageBadge stage={d.stage} />
                  </div>
                  {!knownStages.has(d.stage) && (
                    <p className="text-[11px] font-medium text-amber-600">Stage นี้ไม่อยู่ใน Settings ล่าสุด</p>
                  )}
                  {stale && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-900">
                      ต้องติดตาม — ไม่มีเหตุการณ์หรือเลยกำหนด
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                  {d.market_segment && (
                    <p className="text-[10px] text-violet-800/90">{d.market_segment}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">{formatCurrency(d.value)}</span>
                    <span className="text-xs text-muted-foreground">{d.owner}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Activity ทั้งหมด {ac} ครั้ง</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="col-span-2">
          {!selectedDeal ? (
            <Card className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">เลือกดีลเพื่อดูรายละเอียด</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedDeal.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedDeal.deal_no} · {selectedDeal.customer_name}
                      </p>
                      {selectedDeal.customer_name_english && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{selectedDeal.customer_name_english}</p>
                      )}
                      {selectedDeal.market_segment && (
                        <p className="mt-0.5 text-xs font-medium text-violet-800/90">Segment: {selectedDeal.market_segment}</p>
                      )}
                      {selectedDeal.product_model && (
                        <p className="mt-1 text-xs text-muted-foreground">รุ่นหลัก: {selectedDeal.product_model}</p>
                      )}
                      {selectedDeal.product_lines && selectedDeal.product_lines.length > 0 && (
                        <ul className="mt-1 text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                          {selectedDeal.product_lines.map((pl, i) => (
                            <li key={i}>
                              {pl.product_model}
                              {pl.manufacturer ? ` · ${pl.manufacturer}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <DealStageBadge stage={selectedDeal.stage} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Segment · ชื่ออังกฤษ</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                      {CUSTOMER_ORG_NAMING_HINT_TH} {CUSTOMER_ORG_NAMING_HINT_EN}
                    </p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Segment</Label>
                        {seSettings.se_customer_segments.length > 0 ? (
                          <Select value={marketSegmentDraft || undefined} onValueChange={setMarketSegmentDraft}>
                            <SelectTrigger className="rounded-lg">
                              <SelectValue placeholder="เลือก Segment" />
                            </SelectTrigger>
                            <SelectContent>
                              {segmentSelectOptions.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="rounded-lg text-sm"
                            value={marketSegmentDraft}
                            onChange={(e) => setMarketSegmentDraft(e.target.value)}
                            placeholder="พิมพ์ segment หรือตั้งที่ Settings → SE"
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">ชื่ออังกฤษ (ถ้ามี)</Label>
                        <Input
                          className="rounded-lg text-sm"
                          value={customerNameEnDraft}
                          onChange={(e) => setCustomerNameEnDraft(e.target.value)}
                          placeholder="ชื่อจดทะเบียน / ชื่อทางการ EN"
                        />
                      </div>
                      <Button type="button" size="sm" variant="secondary" className="rounded-lg" onClick={saveMarketSegmentFields}>
                        บันทึก Segment / ชื่อ EN
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">มูลค่า</p>
                    <p className="font-semibold">{formatCurrency(selectedDeal.value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">โอกาส</p>
                    <p className="font-semibold">{selectedDeal.probability}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">วันที่คาดปิด</p>
                    <p className="font-semibold">{formatDate(selectedDeal.expected_close_date)}</p>
                  </div>
                </CardContent>
                {isLostStage(selectedDeal.stage) && (
                  <CardContent className="border-t border-rose-100 bg-rose-50/30 pt-4 space-y-3">
                    <p className="text-xs font-medium text-rose-900">สาเหตุที่แพ้ (สรุปบน SE Dashboard)</p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      รายการหลักตั้งที่ Settings → SE · ดีลเก่าที่ยังไม่มีสาเหตุจะไปกลุ่ม &quot;ยังไม่ระบุสาเหตุ&quot; บน Dashboard
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">สาเหตุหลัก</Label>
                      {seSettings.se_lost_reasons.length > 0 ? (
                        <Select value={lostReasonDraft || undefined} onValueChange={setLostReasonDraft}>
                          <SelectTrigger className="rounded-lg">
                            <SelectValue placeholder="เลือกสาเหตุ" />
                          </SelectTrigger>
                          <SelectContent>
                            {seSettings.se_lost_reasons.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="rounded-lg text-sm"
                          value={lostReasonDraft}
                          onChange={(e) => setLostReasonDraft(e.target.value)}
                          placeholder="ตั้งรายการที่ Settings → SE หรือพิมพ์ที่นี่"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">หมายเหตุ</Label>
                      <Textarea
                        value={lostNoteDraft}
                        onChange={(e) => setLostNoteDraft(e.target.value)}
                        placeholder="รายละเอียดเพิ่มเติม"
                        rows={2}
                        className="resize-none rounded-xl text-sm"
                      />
                    </div>
                    <Button type="button" size="sm" className="rounded-lg" onClick={saveLostReason}>
                      บันทึกสาเหตุแพ้
                    </Button>
                  </CardContent>
                )}
                <CardContent className="border-t border-slate-100 pt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">เลขที่ใบเสนอราคาจาก Admin</p>
                    <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                      ใช้ตอนเปิด Order Request (ดีล Won) และอ้างอิงภายใน
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        className="h-9 max-w-xs rounded-lg text-sm"
                        value={adminQuoteDraft}
                        onChange={(e) => setAdminQuoteDraft(e.target.value)}
                        placeholder="เช่น QT-2026-00123"
                      />
                      <Button type="button" size="sm" variant="secondary" className="rounded-lg" onClick={saveAdminQuoteNo}>
                        บันทึก QT
                      </Button>
                    </div>
                  </div>
                </CardContent>
                {!isClosedStage(selectedDeal.stage) && (
                  <CardContent className="border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ติดตามถัดไป (กัน stale)</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">วันที่ตั้งใจติดตาม</Label>
                        <Input
                          type="date"
                          className="h-9 w-[160px] rounded-lg text-sm"
                          value={followupDraft}
                          onChange={(e) => setFollowupDraft(e.target.value)}
                        />
                      </div>
                      <Button type="button" size="sm" className="rounded-lg" onClick={saveNextFollowup}>
                        บันทึก
                      </Button>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
                      ถ้าไม่ระบุ ระบบถือว่า stale เมื่อไม่มี Activity เลย หรือครบ {STALE_NO_TOUCH_DAYS} วันหลังเหตุการณ์ล่าสุด
                    </p>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Activity Log · {dealActivities.length} ครั้ง
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => {
                        setValue("deal_id", selectedDeal.id)
                        setActDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4" /> บันทึก Activity
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {dealActivities.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มี activity</p>
                  ) : (
                    <div className="space-y-3">
                      {dealActivities.map((a) => {
                        const { Icon, label } = activityTypeMeta(a.activity_type)
                        return (
                          <div key={a.id} className="flex gap-3 border-b pb-3 last:border-0">
                            <div className="h-fit rounded-lg bg-primary/10 p-2">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {label}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px]",
                                    a.source !== "manual" && "bg-violet-100 text-violet-800",
                                  )}
                                >
                                  {SOURCE_LABELS[a.source]}
                                </Badge>
                                <span className="text-sm font-medium">{a.subject}</span>
                              </div>
                              {a.note ? <p className="mt-1 text-xs text-muted-foreground">{a.note}</p> : null}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(a.occurred_on)}
                                {a.actor_name ? ` · ${a.actor_name}` : ""}
                              </p>
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

      <Dialog open={actDialogOpen} onOpenChange={setActDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึก Activity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(addActivity)}>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <Select onValueChange={(v) => setValue("type", v as ActivityForm["type"])} defaultValue="call">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <Button type="button" variant="outline" onClick={() => setActDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
