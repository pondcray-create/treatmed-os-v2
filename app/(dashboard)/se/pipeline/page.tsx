"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useWatch, useForm } from "react-hook-form"
import { GitBranch, Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AS_STORE_KEYS,
  appendSEDealActivity,
  readOrganizations,
  readProductCatalog,
  DEFAULT_PRODUCT_CATALOG,
  initialSESettingsForSSR,
  readSEDeals,
  readSESettings,
  readStockBookingsLedger,
  writeOrganizations,
  writeSEDeals,
  writeStockBookingsLedger,
  type ASOrganization,
  type ProductCatalogGroup,
  type SESettings,
  type SEDeal as Deal,
} from "@/lib/mock/as-store"
import { newId } from "@/lib/new-id"
import { mergeCustomerIntoRegister } from "@/lib/se/se-org-sync"
import { useAuth } from "@/hooks/useAuth"
import { thDateInputBeHint } from "@/lib/format-th-datetime"
import { PROVINCES, getProvinceInfo } from "@/lib/data/geography"
import { formatHealthDistrictLabel, resolvePublicHospitalProvince } from "@/lib/data/th-public-hospitals"
import {
  ECD_RECONFIRM_MIN_PROBABILITY,
  getSEStageNames,
  minClosingProbabilityForStage,
  shouldReconfirmEcdOnStageChange,
  suggestedProbabilityFromSettings,
} from "@/lib/se/se-pipeline-stages"
import { isTerminalClosedDealStage } from "@/lib/se/se-lost-analytics"
import { EBIDDING_MONITORING_MIN_VALUE_THB, isEbiddingValueEligible } from "@/lib/se/se-ebidding"
import {
  isBelowStageForecastFloor,
  needsBelowStageProbNote,
} from "@/lib/se/se-forecast-integrity"
import {
  CUSTOMER_ORG_NAMING_HINT_EN,
  CUSTOMER_ORG_NAMING_HINT_TH,
  inferGeographySegmentFromMarketLabel,
} from "@/lib/se/se-customer-naming"

const PROVINCE_NAMES_SORTED = Array.from(new Set(PROVINCES.map((p) => p.name))).sort((a, b) => a.localeCompare(b, "th"))

type StockBookingRequest = {
  id: string
  item_id: string
  item_name: string
  serial_number?: string
  sales_name: string
  customer_name: string
  booked_date: string
  note?: string
  source?: "stock_manual" | "se_deal"
  se_deal_id?: string
  request_status?: "pending" | "approved" | "rejected"
  stock_feedback?: string
  decided_at?: string
}

const dealSchema = z.object({
  customer_name: z.string().optional(),
  customer_name_new: z.string().optional(),
  customer_segment: z.enum(["public_hospital", "other"]).optional(),
  /** จาก Settings → se_customer_segments หรือพิมพ์เองเมื่อรายการว่าง */
  market_segment: z.string().optional(),
  customer_name_english: z.string().optional(),
  province: z.string().optional(),
  title: z.string().min(1),
  product_model: z.string().min(1),
  manufacturer: z.string().optional(),
  stage: z.string().min(1),
  value: z.number().min(0),
  probability: z.number().min(0).max(100),
  expected_close_date: z.string(),
  owner: z.string().optional(),
})

type DealForm = z.infer<typeof dealSchema>

export default function PipelinePage() {
  const { profile } = useAuth()
  const [deals, setDeals] = useState<Deal[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [seSettings, setSESettings] = useState<SESettings>(() => initialSESettingsForSSR())
  const [bookingRequests, setBookingRequests] = useState<StockBookingRequest[]>([])
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing")
  const [extraProductLines, setExtraProductLines] = useState<Array<{ product_model: string; manufacturer: string }>>([])
  const [myDealsOnly, setMyDealsOnly] = useState(true)
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [pendingLost, setPendingLost] = useState<{
    dealId: string
    prevStage: string
    prevProbability: number
    prevDeclaredInHand?: boolean
    prevBelowStageProbNote?: string
  } | null>(null)
  const [lostDraftReason, setLostDraftReason] = useState("")
  const [lostDraftNote, setLostDraftNote] = useState("")
  const lostCloseOkRef = useRef(false)
  const [ecdDialogOpen, setEcdDialogOpen] = useState(false)
  const [pendingEcd, setPendingEcd] = useState<{
    dealId: string
    newStage: string
    prevStage: string
  } | null>(null)
  const [ecdDraftYmd, setEcdDraftYmd] = useState("")
  const ecdCloseOkRef = useRef(false)
  const skipFirstDealPersist = useRef(true)
  const { toast } = useToast()
  const [productCatalog, setProductCatalog] = useState<ProductCatalogGroup[]>(DEFAULT_PRODUCT_CATALOG)
  const modelOptions = useMemo(() => {
    const map = new Map<string, string>()
    productCatalog.forEach((g) => g.models.forEach((m) => map.set(m, g.manufacturer)))
    return Array.from(map.entries()).map(([model, manufacturer]) => ({ model, manufacturer }))
  }, [productCatalog])

  const defaultMarketSegment = useMemo(
    () => seSettings.se_customer_segments[0] ?? "",
    [seSettings.se_customer_segments],
  )

  useEffect(() => {
    const hydrateDeals = () => setDeals(readSEDeals([]))
    const hydrateSettings = () => setSESettings(readSESettings())
    const hydrateBookings = () =>
      setBookingRequests(readStockBookingsLedger<StockBookingRequest[]>([]).filter((b) => b.source === "se_deal"))
    const hydrateOrgs = () => setOrgs(readOrganizations([]))

    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) hydrateSettings()
      if (!ev.key || ev.key === AS_STORE_KEYS.stockBookings) hydrateBookings()
      if (!ev.key || ev.key === AS_STORE_KEYS.orgs) hydrateOrgs()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (key === AS_STORE_KEYS.seSettings) hydrateSettings()
      if (key === AS_STORE_KEYS.stockBookings) hydrateBookings()
      if (key === AS_STORE_KEYS.orgs) hydrateOrgs()
    }
    hydrateDeals()
    hydrateSettings()
    hydrateBookings()
    hydrateOrgs()
    setProductCatalog(readProductCatalog())
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  useEffect(() => {
    if (skipFirstDealPersist.current) {
      skipFirstDealPersist.current = false
      return
    }
    writeSEDeals(deals)
  }, [deals])

  const stages = useMemo(() => {
    const s = getSEStageNames(seSettings)
    return s.length > 0 ? s : ["lead", "qualified", "proposal", "forecast", "negotiation", "won", "lost"]
  }, [seSettings])

  const orgCustomerOptions = useMemo(() => {
    const names = orgs.map((o) => o.name.trim()).filter(Boolean)
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "th"))
  }, [orgs])

  const currentOwnerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  useEffect(() => {
    if (!isAdmin) setMyDealsOnly(true)
  }, [isAdmin])
  const visibleDeals = useMemo(
    () =>
      myDealsOnly && !isAdmin && currentOwnerName
        ? deals.filter(
            (d) => (d.owner || "").trim().toLowerCase() === currentOwnerName.trim().toLowerCase(),
          )
        : deals,
    [myDealsOnly, isAdmin, currentOwnerName, deals],
  )
  const stageColumns = useMemo(() => {
    const configured = [...stages]
    const configuredNorm = new Set(configured.map((s) => s.trim().toLowerCase()))
    const extras = Array.from(
      new Set(
        visibleDeals
          .map((d) => (d.stage || "").trim())
          .filter((s) => s && !configuredNorm.has(s.toLowerCase())),
      ),
    )
    return [...configured, ...extras]
  }, [stages, visibleDeals])

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      stage: stages[0] ?? "lead",
      probability: suggestedProbabilityFromSettings(seSettings, stages[0] ?? "lead"),
      value: 0,
      customer_segment: "public_hospital",
      market_segment: "",
      customer_name_english: "",
      province: "",
    },
  })

  const customerSegment = useWatch({ control, name: "customer_segment", defaultValue: "public_hospital" })
  const watchMarketSegment = useWatch({ control, name: "market_segment", defaultValue: "" })
  const marketSegmentSelectOptions = useMemo(() => {
    const base = [...seSettings.se_customer_segments]
    const cur = (watchMarketSegment || "").trim()
    if (cur && !base.includes(cur)) return [cur, ...base]
    return base
  }, [seSettings.se_customer_segments, watchMarketSegment])
  const watchStage = useWatch({ control, name: "stage", defaultValue: stages[0] ?? "lead" })
  const formClosingMin = minClosingProbabilityForStage(seSettings, watchStage || stages[0] || "lead")
  const watchProvince = useWatch({ control, name: "province", defaultValue: "" })
  const nameNew = useWatch({ control, name: "customer_name_new", defaultValue: "" })
  const watchCustomerExisting = useWatch({ control, name: "customer_name", defaultValue: "" })
  const provinceGeo = watchProvince ? getProvinceInfo(watchProvince) : undefined

  useEffect(() => {
    if (customerMode !== "existing") return
    const nm = (watchCustomerExisting || "").trim()
    if (!nm) return
    const o = orgs.find((x) => x.name.trim() === nm)
    if (o?.province) setValue("province", o.province)
  }, [customerMode, watchCustomerExisting, orgs, setValue])

  useEffect(() => {
    if (customerMode !== "new" || customerSegment !== "public_hospital") return
    const t = window.setTimeout(() => {
      const hit = resolvePublicHospitalProvince(nameNew || "")
      if (hit) setValue("province", hit)
    }, 400)
    return () => window.clearTimeout(t)
  }, [nameNew, customerMode, customerSegment, setValue])

  useEffect(() => {
    if (customerMode !== "new") return
    const inferred = inferGeographySegmentFromMarketLabel(watchMarketSegment || "")
    if (inferred) setValue("customer_segment", inferred)
  }, [customerMode, watchMarketSegment, setValue])

  const totalValue = visibleDeals.filter(d => d.stage !== "lost").reduce((sum, d) => sum + d.value * d.probability / 100, 0)
  const wonValue = visibleDeals.filter(d => d.stage === "won").reduce((sum, d) => sum + d.value, 0)

  function onSubmit(data: DealForm) {
    const existingCustomer = data.customer_name?.trim() || ""
    const newCustomer = data.customer_name_new?.trim() || ""
    const customerName = customerMode === "new" ? newCustomer : existingCustomer
    if (!customerName) {
      toast({ title: "กรุณาเลือกลูกค้าหรือกรอกลูกค้าใหม่", variant: "destructive" })
      return
    }
    const orgMatch = orgs.find((o) => o.name.trim() === customerName.trim())
    let provinceStr = ""
    let regionStr: string | undefined
    let healthNum: number | undefined

    if (customerMode === "new") {
      provinceStr = (data.province || "").trim()
      if (!provinceStr) {
        toast({
          title: "กรุณาเลือกจังหวัด",
          description: "ต้องมีจังหวัดและภูมิภาค (รพ.รัฐจะเติมจังหวัดอัตโนมัติเมื่อจับคีย์เวิร์ดได้)",
          variant: "destructive",
        })
        return
      }
      const g = getProvinceInfo(provinceStr)
      regionStr = g?.region
      healthNum = g?.healthDistrict
    } else {
      if (orgMatch?.province) {
        provinceStr = orgMatch.province.trim()
        regionStr = orgMatch.region
        healthNum = orgMatch.health_district
      } else {
        provinceStr = (data.province || "").trim()
        if (!provinceStr) {
          toast({
            title: "กรุณาเลือกจังหวัด",
            description: "ชื่อลูกค้าไม่ตรง Customer Register — เลือกจังหวัดและเขตจากรายการด้านล่าง",
            variant: "destructive",
          })
          return
        }
        const g = getProvinceInfo(provinceStr)
        regionStr = g?.region
        healthNum = g?.healthDistrict
      }
    }

    const marketSeg = (data.market_segment || "").trim()
    if (seSettings.se_customer_segments.length > 0 && !marketSeg) {
      toast({ title: "เลือก Segment ลูกค้า", variant: "destructive" })
      return
    }

    const additionalLines = extraProductLines
      .map((row) => ({
        product_model: row.product_model.trim(),
        manufacturer: row.manufacturer.trim() || undefined,
      }))
      .filter((row) => row.product_model)

    const selectedModel = modelOptions.find((m) => m.model === data.product_model)
    const createdAt = new Date().toISOString()
    const newDeal: Deal = {
      id: newId("deal"),
      deal_no: `DEAL-${String(deals.length + 1).padStart(3, "0")}`,
      title: data.title,
      customer_name: customerName,
      product_model: data.product_model,
      stage: data.stage,
      value: data.value,
      probability: data.probability,
      expected_close_date: data.expected_close_date,
      owner: isAdmin ? (data.owner ?? "") : (currentOwnerName || data.owner || ""),
      manufacturer: data.manufacturer?.trim() || selectedModel?.manufacturer || undefined,
      product_lines: additionalLines.length > 0 ? additionalLines : undefined,
      customer_segment: customerMode === "new" ? data.customer_segment : undefined,
      market_segment: marketSeg || undefined,
      customer_name_english: (data.customer_name_english || "").trim() || undefined,
      province: provinceStr,
      region: regionStr,
      health_district: healthNum,
      on_ebidding: false,
      created_at: createdAt,
    }
    const nextDeals = [newDeal, ...deals]
    // Persist ดีลก่อน แล้วค่อยแตะ se_settings — ไม่งั้น as-store-updated จาก settings จะ sync ดีล
    // จาก localStorage ก่อน useEffect จะเขียน ทำให้ดีลที่เพิ่งสร้างหายไป
    writeSEDeals(nextDeals)
    setDeals(nextDeals)
    const mergedOrgs = mergeCustomerIntoRegister(readOrganizations([]), {
      name: customerName,
      name_english: (data.customer_name_english || "").trim() || undefined,
      province: provinceStr,
      region: regionStr,
      health_district: healthNum,
    })
    writeOrganizations(mergedOrgs)
    setOrgs(mergedOrgs)
    const actor = currentOwnerName || profile?.full_name?.trim() || profile?.email?.trim() || "SE"
    appendSEDealActivity({
      deal_id: newDeal.id,
      activity_type: "other",
      source: "manual",
      subject: "สร้างดีล",
      note: additionalLines.length ? `สินค้า/เครื่อง ${1 + additionalLines.length} รายการใน 1 ดีล` : "",
      occurred_on: new Date().toISOString().slice(0, 10),
      actor_name: actor,
    })
    toast({ title: "สร้างดีลสำเร็จ", description: `${newDeal.deal_no}: ${data.title}` })
    setDialogOpen(false)
    setCustomerMode("existing")
    reset({
      stage: stages[0] ?? "lead",
      probability: suggestedProbabilityFromSettings(seSettings, stages[0] ?? "lead"),
      value: 0,
      customer_name: "",
      customer_name_new: "",
      product_model: "",
      customer_segment: "public_hospital",
      market_segment: defaultMarketSegment,
      customer_name_english: "",
      province: "",
    })
    setExtraProductLines([])
  }

  function cancelLostDialog() {
    if (!pendingLost) {
      setLostDialogOpen(false)
      return
    }
    const p = pendingLost
    setDeals((prev) =>
      prev.map((d) =>
        d.id === p.dealId
          ? {
              ...d,
              stage: p.prevStage,
              probability: p.prevProbability,
              lost_reason: undefined,
              lost_reason_note: undefined,
              declared_in_hand: p.prevDeclaredInHand,
              below_stage_prob_note: p.prevBelowStageProbNote,
            }
          : d,
      ),
    )
    setPendingLost(null)
    setLostDialogOpen(false)
    setLostDraftReason("")
    setLostDraftNote("")
  }

  function confirmLostReason() {
    if (!pendingLost) return
    const reason = lostDraftReason.trim()
    if (!reason) {
      toast({ title: "เลือกหรือกรอกสาเหตุที่แพ้", variant: "destructive" })
      return
    }
    const note = lostDraftNote.trim()
    const dealId = pendingLost.dealId
    const actor = profile?.full_name?.trim() || profile?.email?.trim() || "SE"
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, lost_reason: reason, lost_reason_note: note || undefined }
          : d,
      ),
    )
    appendSEDealActivity({
      deal_id: dealId,
      activity_type: "other",
      source: "manual",
      subject: `ปิดแพ้: ${reason}`,
      note: note || "",
      occurred_on: new Date().toISOString().slice(0, 10),
      actor_name: actor,
    })
    setPendingLost(null)
    lostCloseOkRef.current = true
    setLostDialogOpen(false)
    setLostDraftReason("")
    setLostDraftNote("")
    toast({ title: "บันทึกสาเหตุที่แพ้แล้ว" })
  }

  function applyStageChange(dealId: string, newStage: string, expectedCloseDate?: string) {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d
        const next: Deal = {
          ...d,
          stage: newStage,
          probability: suggestedProbabilityFromSettings(seSettings, newStage),
          ...(expectedCloseDate !== undefined ? { expected_close_date: expectedCloseDate } : {}),
        }
        if (!/lost|แพ้/i.test(newStage)) {
          next.lost_reason = undefined
          next.lost_reason_note = undefined
        }
        if (/won|ชนะ/i.test(newStage)) {
          next.declared_in_hand = undefined
          next.below_stage_prob_note = undefined
        }
        return next
      }),
    )
  }

  function cancelEcdDialog() {
    setPendingEcd(null)
    setEcdDraftYmd("")
    setEcdDialogOpen(false)
  }

  function confirmEcdDialog() {
    if (!pendingEcd) return
    const ymd = ecdDraftYmd.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      toast({ title: "เลือกวันที่ปิด (ECD)", description: "รูปแบบ YYYY-MM-DD", variant: "destructive" })
      return
    }
    const { dealId, newStage } = pendingEcd
    const actor = profile?.full_name?.trim() || profile?.email?.trim() || "SE"
    applyStageChange(dealId, newStage, ymd)
    appendSEDealActivity({
      deal_id: dealId,
      activity_type: "other",
      source: "manual",
      subject: `ย้าย stage → ${newStage} · ยืนยัน ECD`,
      note: ymd,
      occurred_on: new Date().toISOString().slice(0, 10),
      actor_name: actor,
    })
    setPendingEcd(null)
    setEcdDraftYmd("")
    ecdCloseOkRef.current = true
    setEcdDialogOpen(false)
    toast({ title: "บันทึก stage และ ECD แล้ว" })
  }

  function moveStage(dealId: string, newStage: string) {
    const prevDeal = deals.find((d) => d.id === dealId)
    if (!prevDeal) return
    if (prevDeal.stage === newStage) return
    const goingLost = /lost|แพ้/i.test(newStage)
    if (goingLost) {
      setPendingLost({
        dealId,
        prevStage: prevDeal.stage,
        prevProbability: prevDeal.probability,
        prevDeclaredInHand: prevDeal.declared_in_hand,
        prevBelowStageProbNote: prevDeal.below_stage_prob_note,
      })
      setLostDraftReason(prevDeal.lost_reason ?? "")
      setLostDraftNote(prevDeal.lost_reason_note ?? "")
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stage: newStage,
                probability: suggestedProbabilityFromSettings(seSettings, newStage),
                lost_reason: undefined,
                lost_reason_note: undefined,
                declared_in_hand: undefined,
                below_stage_prob_note: undefined,
              }
            : d,
        ),
      )
      setLostDialogOpen(true)
      return
    }
    const goingWon = /won|ชนะ/i.test(newStage)
    if (
      !goingWon &&
      shouldReconfirmEcdOnStageChange(prevDeal.stage, newStage, prevDeal.probability)
    ) {
      setPendingEcd({ dealId, newStage, prevStage: prevDeal.stage })
      setEcdDraftYmd((prevDeal.expected_close_date || "").trim())
      setEcdDialogOpen(true)
      return
    }
    applyStageChange(dealId, newStage)
  }

  function updateDealProbability(dealId: string, raw: number) {
    const p = Math.min(100, Math.max(0, Number.isFinite(raw) ? raw : 0))
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d
        const minP = minClosingProbabilityForStage(seSettings, d.stage)
        const next: Deal = { ...d, probability: p }
        if (p >= minP) next.below_stage_prob_note = undefined
        return next
      }),
    )
  }

  function updateBelowStageProbNote(dealId: string, note: string) {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, below_stage_prob_note: note || undefined } : d)))
  }

  function requestBookingForDeal(deal: Deal) {
    if (isTerminalClosedDealStage(deal.stage)) {
      toast({ title: "ขอ Booking ไม่ได้", description: "ดีลปิดแล้ว (Won/Lost)", variant: "destructive" })
      return
    }
    const minP = minClosingProbabilityForStage(seSettings, deal.stage)
    if (deal.probability < minP) {
      toast({
        title: "ยังขอ Booking ไม่ได้",
        description: `โอกาสปิดการขายต้อง ≥ ${minP}% สำหรับ stage นี้ (ปรับที่ Settings → SE Pipeline Stages)`,
        variant: "destructive",
      })
      return
    }
    const all = readStockBookingsLedger<StockBookingRequest[]>([])
    if (all.some((b) => b.source === "se_deal" && b.se_deal_id === deal.id && b.request_status === "pending")) {
      toast({ title: "มีคำขอค้างอยู่แล้ว", description: `${deal.deal_no} รอ Stock อนุมัติ` })
      return
    }
    const booking: StockBookingRequest = {
      id: `bk-se-${Date.now()}`,
      item_id: `se-deal-${deal.id}`,
      item_name: deal.product_model || deal.title,
      sales_name: deal.owner || "SE",
      customer_name: deal.customer_name,
      booked_date: new Date().toISOString().slice(0, 10),
      note: `From ${deal.deal_no} | ECD: ${deal.expected_close_date}`,
      source: "se_deal",
      se_deal_id: deal.id,
      request_status: "pending",
    }
    writeStockBookingsLedger([booking, ...all])
    setBookingRequests((prev) => [booking, ...prev])
    appendSEDealActivity({
      deal_id: deal.id,
      activity_type: "stock_booking",
      source: "pipeline_booking",
      subject: `ขอจองสต็อก: ${deal.product_model || deal.title}`,
      note: booking.note ?? "",
      occurred_on: booking.booked_date,
      actor_name: deal.owner || "SE",
      meta: { ref_no: deal.deal_no },
    })
    toast({ title: "ส่งคำขอ Booking ไป Stock แล้ว", description: `${deal.deal_no} (${deal.product_model || deal.title})` })
  }

  function getBookingStatus(dealId: string) {
    const rows = bookingRequests.filter((b) => b.se_deal_id === dealId)
    if (rows.length === 0) return null
    return rows.sort((a, b) => (a.booked_date < b.booked_date ? 1 : -1))[0]
  }

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        description="ติดตามดีลแบบ Kanban"
        icon={GitBranch}
        action={{
          label: "เพิ่มดีล",
          onClick: () => {
            reset({
              stage: stages[0] ?? "lead",
              probability: suggestedProbabilityFromSettings(seSettings, stages[0] ?? "lead"),
              value: 0,
              customer_name: "",
              customer_name_new: "",
              product_model: "",
              customer_segment: "public_hospital",
              market_segment: readSESettings().se_customer_segments[0] ?? "",
              customer_name_english: "",
              province: "",
            })
            setExtraProductLines([])
            setCustomerMode("existing")
            setDialogOpen(true)
          },
          icon: Plus,
        }}
      />
      {!isAdmin && (
        <div className="mb-3">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <Button variant={myDealsOnly ? "default" : "outline"} size="sm" onClick={() => setMyDealsOnly((v) => !v)} disabled={!isAdmin}>
          {myDealsOnly ? "แสดงเฉพาะดีลของฉัน" : "แสดงดีลทั้งหมด"}
        </Button>
        {!isAdmin && currentOwnerName && <p className="text-xs text-muted-foreground">Owner ปัจจุบัน: {currentOwnerName}</p>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Weighted Pipeline</p><p className="text-2xl font-bold text-primary">{formatCurrency(totalValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Won ทั้งหมด</p><p className="text-2xl font-bold text-green-600">{formatCurrency(wonValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">ดีลทั้งหมด (ไม่รวมปิดแล้ว)</p><p className="text-2xl font-bold">{visibleDeals.filter((d) => !isTerminalClosedDealStage(d.stage)).length} รายการ</p></CardContent></Card>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stageColumns.map((stage, idx) => {
          const stageNorm = stage.trim().toLowerCase()
          const stageDeals = visibleDeals.filter((d) => (d.stage || "").trim().toLowerCase() === stageNorm)
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0)
          const stageColor = idx % 2 === 0 ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200"
          return (
            <div key={stage} className={`rounded-xl border-2 ${stageColor} p-3 min-w-[220px] flex-1`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{stage}</h3>
                <Badge variant="secondary">{stageDeals.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{formatCurrency(stageValue)}</p>
              <div className="space-y-2">
                {stageDeals.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">ไม่มีดีล</p>}
                {stageDeals.map((d) => {
                  const cardClosingMin = minClosingProbabilityForStage(seSettings, d.stage)
                  return (
                  <Card key={d.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-xs text-muted-foreground font-mono">{d.deal_no}</p>
                      <p className="font-semibold text-sm leading-tight">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                      {d.customer_name_english && (
                        <p className="text-[10px] text-muted-foreground/90">{d.customer_name_english}</p>
                      )}
                      {d.market_segment && (
                        <p className="text-[10px] font-medium text-violet-800/90">Segment: {d.market_segment}</p>
                      )}
                      {d.product_model && <p className="text-xs text-muted-foreground">Model: {d.product_model}</p>}
                      {d.product_lines && d.product_lines.length > 0 && (
                        <p className="text-[10px] font-medium text-amber-800/90">
                          +{d.product_lines.length} รุ่น/เครื่องเพิ่มในโครงการ
                        </p>
                      )}
                      {(d.province || d.region || d.health_district != null) && (
                        <p className="text-[10px] text-violet-800/90 leading-snug">
                          {[d.region, d.province].filter(Boolean).join(" · ")}
                          {d.health_district != null ? ` · ${formatHealthDistrictLabel(d.health_district)}` : ""}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t gap-2">
                        <span className="text-sm font-medium text-primary">{formatCurrency(d.value)}</span>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <Label className="text-[10px] text-muted-foreground font-normal">โอกาส %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-7 w-16 text-xs text-right px-1.5"
                            value={d.probability}
                            onChange={(e) => updateDealProbability(d.id, Number(e.target.value))}
                            aria-label="โอกาสปิดการขาย"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        เปลี่ยน Stage แล้วระบบเติมโอกาสขั้นต่ำอัตโนมัติ (แก้เองได้)
                        {d.probability >= cardClosingMin ? (
                          <span className="text-emerald-700"> · ขอ Booking ได้ (โอกาสปิด ≥{cardClosingMin}%)</span>
                        ) : (
                          <span> · ต้องโอกาสปิด ≥{cardClosingMin}%</span>
                        )}
                      </p>
                      {!isTerminalClosedDealStage(d.stage) && (
                        <div className="space-y-1.5 pt-1 border-t border-violet-100/80">
                          {isBelowStageForecastFloor(d, seSettings) && (
                            <div className="rounded-lg border border-amber-200/90 bg-amber-50/60 px-2 py-1.5 space-y-1">
                              {needsBelowStageProbNote(d, seSettings) ? (
                                <p className="text-[10px] font-bold text-amber-900">
                                  โอกาสต่ำกว่าเกณฑ์ stage ({cardClosingMin}%) — กรุณาอธิบายเหตุผล
                                </p>
                              ) : (
                                <p className="text-[10px] font-medium text-amber-900/90">
                                  โอกาสต่ำกว่าเกณฑ์ stage — มีเหตุผลบันทึกแล้ว
                                </p>
                              )}
                              <Textarea
                                value={d.below_stage_prob_note ?? ""}
                                onChange={(e) => updateBelowStageProbNote(d.id, e.target.value)}
                                placeholder="เช่น ลูกค้ายังไม่เซ็น PO แต่มี MOU / รอ กบข. ฯลฯ"
                                rows={2}
                                className="resize-none rounded-lg text-[11px] min-h-0"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">ECD: {d.expected_close_date}</p>
                      {!isTerminalClosedDealStage(d.stage) && isEbiddingValueEligible(d.value) && (
                        <p className="text-[10px] text-amber-800 leading-snug rounded-lg border border-amber-200/70 bg-amber-50/40 px-2 py-1">
                          มูลค่า ≥ {formatCurrency(EBIDDING_MONITORING_MIN_VALUE_THB)} — แสดงใน SE Dashboard · ติ๊ก
                          &quot;ประมูลจริง&quot; ที่นั่นเมื่อเข้าประมูล
                        </p>
                      )}
                      {getBookingStatus(d.id) && (
                        <Badge
                          variant={getBookingStatus(d.id)?.request_status === "approved" ? "success" : getBookingStatus(d.id)?.request_status === "rejected" ? "destructive" : "warning"}
                          className="text-[10px]"
                        >
                          Booking: {getBookingStatus(d.id)?.request_status}
                        </Badge>
                      )}
                      {!isTerminalClosedDealStage(d.stage) && d.probability >= cardClosingMin && (
                        <button
                          type="button"
                          onClick={() => requestBookingForDeal(d)}
                          className="w-full mt-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold py-1.5 hover:bg-indigo-100"
                        >
                          ขอ Booking ไป Stock
                        </button>
                      )}
                      {isTerminalClosedDealStage(d.stage) && /lost|แพ้/i.test(d.stage) && (
                        <p className="text-[10px] text-muted-foreground">
                          {d.lost_reason ? (
                            <span className="text-rose-700 font-medium">แพ้: {d.lost_reason}</span>
                          ) : (
                            <span className="text-amber-700">ยังไม่ระบุสาเหตุ — เปิดดีลแล้วเลือก Lost อีกครั้งหรือแก้ที่ Deals</span>
                          )}
                          {d.lost_reason_note ? ` · ${d.lost_reason_note}` : ""}
                        </p>
                      )}
                      {/* Quick move — โอกาสจะถูกปรับตาม Stage แนะนำ (แก้ที่ช่องโอกาสได้) */}
                      {d.probability >= ECD_RECONFIRM_MIN_PROBABILITY && !isTerminalClosedDealStage(d.stage) && (
                        <p className="text-[10px] text-sky-800/90 leading-snug rounded-lg border border-sky-200/70 bg-sky-50/40 px-2 py-1">
                          โอกาส ≥ {ECD_RECONFIRM_MIN_PROBABILITY}% — ถ้าย้ายเข้า/ออก stage ชื่อมี Forecast / พยากรณ์ ระบบจะขอให้ยืนยัน ECD อีกครั้ง
                        </p>
                      )}
                      <Select onValueChange={v => moveStage(d.id, v)} value={d.stage}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stages.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Deal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>เพิ่มดีลใหม่</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-1.5">
                <Label>ชื่อดีล *</Label>
                <Input placeholder="เช่น MRI 3T สำหรับโรงพยาบาล..." {...register("title")} />
              </div>
              <div className="col-span-2 rounded-2xl border border-violet-100 bg-violet-50/15 p-4 space-y-4">
                <div>
                  <p className="text-xs font-bold text-violet-900 tracking-wide">ลูกค้า · Segment · ภูมิศาสตร์</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    บันทึกดีลแล้วระบบจะ <strong>ซิงก์ชื่อลูกค้าเข้า Customer Register (AS)</strong> — ชื่อเดิมจะเติมจังหวัด/เขตเมื่อ Register ยังว่าง
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={customerMode === "existing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCustomerMode("existing")
                      setValue("province", "")
                    }}
                  >
                    ลูกค้าเดิม
                  </Button>
                  <Button
                    type="button"
                    variant={customerMode === "new" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCustomerMode("new")
                      setValue("province", "")
                      setValue("customer_segment", "public_hospital")
                    }}
                  >
                    ลูกค้าใหม่
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>ชื่อลูกค้า (ไทย) *</Label>
                  {customerMode === "existing" ? (
                    <div className="space-y-1">
                      {orgCustomerOptions.length === 0 && (
                        <p className="text-[11px] text-amber-700 leading-snug">
                          ยังไม่มีใน Register — ใช้โหมดลูกค้าใหม่หรือเพิ่มที่ AS → Customers
                        </p>
                      )}
                      <Select onValueChange={(v) => setValue("customer_name", v)} disabled={orgCustomerOptions.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder={orgCustomerOptions.length === 0 ? "ไม่มีรายการ" : "เลือกลูกค้า"} />
                        </SelectTrigger>
                        <SelectContent>
                          {orgCustomerOptions.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input placeholder="พิมพ์ชื่อเต็มหน่วยงาน / โรงพยาบาล" {...register("customer_name_new")} />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        โหมด <strong>รพ.ภาครัฐ</strong>: ระบบจะจับคีย์เวิร์ดแล้วเติมจังหวัด (แก้ด้านล่างได้)
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-3 pt-2 border-t border-violet-100/80">
                  <div className="space-y-1.5">
                    <Label>Segment ลูกค้า{seSettings.se_customer_segments.length > 0 ? " *" : ""}</Label>
                    {seSettings.se_customer_segments.length > 0 ? (
                      <Select
                        value={(watchMarketSegment || "").trim() || undefined}
                        onValueChange={(v) => setValue("market_segment", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือก Segment" />
                        </SelectTrigger>
                        <SelectContent>
                          {marketSegmentSelectOptions.map((seg) => (
                            <SelectItem key={seg} value={seg}>
                              {seg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input placeholder="พิมพ์ segment หรือตั้งที่ Settings → SE" {...register("market_segment")} />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>ชื่อภาษาอังกฤษ (ถ้ามี)</Label>
                    <Input placeholder="ตามทะเบียน / เว็บทางการ" {...register("customer_name_english")} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{CUSTOMER_ORG_NAMING_HINT_TH}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{CUSTOMER_ORG_NAMING_HINT_EN}</p>
                </div>
                {customerMode === "new" && (
                  <div className="space-y-2 pt-2 border-t border-violet-100/80">
                    <Label className="text-xs">ประเภทลูกค้า (ลูกค้าใหม่)</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={customerSegment === "public_hospital" ? "default" : "outline"}
                        onClick={() => setValue("customer_segment", "public_hospital")}
                      >
                        โรงพยาบาลภาครัฐ
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={customerSegment === "other" ? "default" : "outline"}
                        onClick={() => setValue("customer_segment", "other")}
                      >
                        อื่นๆ (คลินิก / เอกชน / ฯลฯ)
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2 pt-2 border-t border-violet-100/80">
                  {customerMode === "existing" && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      ชื่อตรง Register จะเติมจังหวัด/เขตอัตโนมัติ — ถ้าไม่ตรงให้เลือกจังหวัดด้านล่าง
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label>จังหวัด *</Label>
                      <Select value={watchProvince || undefined} onValueChange={(v) => setValue("province", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกจังหวัด" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {PROVINCE_NAMES_SORTED.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>ภูมิภาค</Label>
                      <Input readOnly className="bg-muted/80 text-sm" value={provinceGeo?.region ?? "—"} placeholder="เลือกจังหวัด" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>เขตสุขภาพ</Label>
                      <Input
                        readOnly
                        className="bg-muted/80 text-sm"
                        value={provinceGeo ? formatHealthDistrictLabel(provinceGeo.healthDistrict) : "—"}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-800">สินค้า / เครื่อง (1 ดีลหลายรายการ)</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  รุ่นหลักแสดงบนการ์ดดีล · รายการเพิ่มเก็บใน <code className="text-[10px] bg-white px-1 rounded">product_lines</code>
                  · ทุกแถวเลือก model จากแคตตาล็อกเดียวกัน — เลือกแล้ว Manufacturer เติมอัตโนมัติ (แก้มือได้)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>รุ่นหลัก (Product Model) *</Label>
                    <Select
                      onValueChange={(v) => {
                        setValue("product_model", v)
                        const found = modelOptions.find((m) => m.model === v)
                        if (found) setValue("manufacturer", found.manufacturer)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือก model" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((m) => (
                          <SelectItem key={m.model} value={m.model}>
                            {m.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.product_model && (
                      <p className="text-xs text-red-600">{errors.product_model.message || "กรุณาเลือก Product Model"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Manufacturer (รุ่นหลัก)</Label>
                    <Input {...register("manufacturer")} placeholder="Auto จาก model (แก้ได้)" />
                  </div>
                </div>
                {extraProductLines.map((row, idx) => {
                  const rowModel = row.product_model.trim()
                  const rowModelInCatalog = modelOptions.some((m) => m.model === rowModel)
                  return (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">รุ่นเพิ่ม #{idx + 1}</Label>
                      <Select
                        value={rowModelInCatalog ? rowModel : undefined}
                        onValueChange={(v) => {
                          const found = modelOptions.find((m) => m.model === v)
                          setExtraProductLines((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? {
                                    product_model: v,
                                    manufacturer: found?.manufacturer ?? "",
                                  }
                                : r,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือก model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelOptions.map((m) => (
                            <SelectItem key={m.model} value={m.model}>
                              {m.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!rowModelInCatalog && rowModel ? (
                        <p className="text-[10px] text-amber-800/90 mt-1">
                          รุ่นนี้ไม่อยู่ในแคตตาล็อก: {rowModel} — เลือกจากรายการด้านบนเพื่อเติม Auto MFR
                        </p>
                      ) : null}
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Manufacturer</Label>
                      <Input
                        placeholder="Auto จาก model (แก้ได้)"
                        value={row.manufacturer}
                        onChange={(e) =>
                          setExtraProductLines((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, manufacturer: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 shrink-0 self-end sm:self-end"
                      onClick={() => setExtraProductLines((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ลบ
                    </Button>
                  </div>
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setExtraProductLines((prev) => [...prev, { product_model: "", manufacturer: "" }])}
                >
                  <Plus className="h-4 w-4 mr-1" /> เพิ่มเครื่อง / รุ่นในโครงการเดียวกัน
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select
                  value={(watchStage || stages[0]) ?? "lead"}
                  onValueChange={(v) => {
                    setValue("stage", v)
                    setValue("probability", suggestedProbabilityFromSettings(seSettings, v))
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  เปลี่ยน Stage จะเติมโอกาสให้เท่าค่า &quot;โอกาสปิดขั้นต่ำ&quot; ของ stage นั้นใน Settings — แก้ที่ช่องด้านล่างได้
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>มูลค่า (บาท)</Label>
                <Input type="number" min={0} {...register("value", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>โอกาส (%)</Label>
                <Input type="number" min={0} max={100} {...register("probability", { valueAsNumber: true })} />
                <p className="text-[11px] text-muted-foreground">
                  โอกาสปิดการขาย ≥ {formClosingMin}% ตาม stage — ใช้ทั้งขอ Booking และ Quote funnel
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>ECD</Label>
                <Input type="date" {...register("expected_close_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>ผู้รับผิดชอบ</Label>
                <Select onValueChange={v => setValue("owner", v)} defaultValue={!isAdmin ? currentOwnerName : undefined} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue placeholder="เลือก SE" /></SelectTrigger>
                  <SelectContent>{seSettings.se_owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                {!isAdmin && <p className="text-[11px] text-muted-foreground">SE staff ถูกล็อก owner เป็นบัญชีของตัวเอง</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit">สร้างดีล</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lostDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setLostDialogOpen(true)
            return
          }
          if (lostCloseOkRef.current) {
            lostCloseOkRef.current = false
            setLostDialogOpen(false)
            return
          }
          cancelLostDialog()
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => cancelLostDialog()}
        >
          <DialogHeader>
            <DialogTitle>สาเหตุที่แพ้ (Lost)</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal leading-snug pt-1">
              {pendingLost
                ? deals.find((x) => x.id === pendingLost.dealId)?.deal_no ?? ""
                : ""}{" "}
              · บันทึกเพื่อใช้สรุปบน Dashboard · ยกเลิก = ย้อนกลับไป stage เดิม
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>สาเหตุหลัก</Label>
              {seSettings.se_lost_reasons.length > 0 ? (
                <Select value={lostDraftReason || undefined} onValueChange={setLostDraftReason}>
                  <SelectTrigger>
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
                  value={lostDraftReason}
                  onChange={(e) => setLostDraftReason(e.target.value)}
                  placeholder="ตั้งรายการที่ Settings → SE หรือพิมพ์ที่นี่"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                value={lostDraftNote}
                onChange={(e) => setLostDraftNote(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม เช่น ชื่อคู่แข่ง / เหตุผลลูกค้า"
                rows={3}
                className="resize-none rounded-xl text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancelLostDialog}>
              ยกเลิก (ย้อน stage)
            </Button>
            <Button type="button" onClick={confirmLostReason}>
              บันทึก Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ecdDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setEcdDialogOpen(true)
            return
          }
          if (ecdCloseOkRef.current) {
            ecdCloseOkRef.current = false
            setEcdDialogOpen(false)
            return
          }
          cancelEcdDialog()
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => cancelEcdDialog()}
        >
          <DialogHeader>
            <DialogTitle>ยืนยันวันที่คาดปิด (ECD)</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal leading-snug pt-1">
              เมื่อโอกาสปิด ≥ {ECD_RECONFIRM_MIN_PROBABILITY}% และย้ายดีล{" "}
              <strong>เข้า/ออก</strong> stage ที่ชื่อมีคำว่า Forecast / พยากรณ์ — ต้องยืนยัน ECD อีกครั้ง · ยกเลิก = คง stage
              เดิม
            </p>
            {pendingEcd ? (
              <p className="text-[11px] text-violet-800 font-semibold pt-1">
                {deals.find((x) => x.id === pendingEcd.dealId)?.deal_no} · {pendingEcd.prevStage} →{" "}
                {pendingEcd.newStage}
              </p>
            ) : null}
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>ECD (วันที่คาดปิด)</Label>
              <Input type="date" value={ecdDraftYmd} onChange={(e) => setEcdDraftYmd(e.target.value)} />
              <p className="text-[10px] text-muted-foreground leading-snug">{thDateInputBeHint(ecdDraftYmd)}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancelEcdDialog}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={confirmEcdDialog}>
              บันทึก stage และ ECD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
