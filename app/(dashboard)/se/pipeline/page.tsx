"use client"

import { useEffect, useMemo, useState } from "react"
import { GitBranch, Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DealStageBadge } from "@/components/ui/status-badge"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { AS_STORE_KEYS, readProductCatalog, readSEDeals, readSESettings, readStockBookingsLedger, writeSEDeals, writeSESettings, writeStockBookingsLedger, type SEDeal as Deal } from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"

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
  const [deals, setDeals] = useState<Deal[]>(() => readSEDeals([]))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [seSettings, setSESettings] = useState(readSESettings())
  const [bookingRequests, setBookingRequests] = useState<StockBookingRequest[]>([])
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing")
  const [myDealsOnly, setMyDealsOnly] = useState(true)
  const { toast } = useToast()
  const productCatalog = readProductCatalog()
  const modelOptions = useMemo(() => {
    const map = new Map<string, string>()
    productCatalog.forEach((g) => g.models.forEach((m) => map.set(m, g.manufacturer)))
    return Array.from(map.entries()).map(([model, manufacturer]) => ({ model, manufacturer }))
  }, [productCatalog])

  useEffect(() => {
    const hydrateDeals = () => setDeals(readSEDeals([]))
    const hydrateSettings = () => setSESettings(readSESettings())
    const hydrateBookings = () =>
      setBookingRequests(readStockBookingsLedger<StockBookingRequest[]>([]).filter((b) => b.source === "se_deal"))

    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) hydrateSettings()
      if (!ev.key || ev.key === AS_STORE_KEYS.stockBookings) hydrateBookings()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (key === AS_STORE_KEYS.seSettings) hydrateSettings()
      if (key === AS_STORE_KEYS.stockBookings) hydrateBookings()
    }
    hydrateDeals()
    hydrateSettings()
    hydrateBookings()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  useEffect(() => {
    writeSEDeals(deals)
  }, [deals])

  const stages = seSettings.se_stages.length > 0 ? seSettings.se_stages : ["lead", "qualified", "proposal", "negotiation", "won", "lost"]
  const currentOwnerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  useEffect(() => {
    if (!isAdmin) setMyDealsOnly(true)
  }, [isAdmin])
  const visibleDeals = useMemo(
    () =>
      myDealsOnly && !isAdmin && currentOwnerName
        ? deals.filter((d) => (d.owner || "").trim() === currentOwnerName)
        : deals,
    [myDealsOnly, isAdmin, currentOwnerName, deals],
  )

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { stage: stages[0] ?? "lead", probability: 20, value: 0 },
  })

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
    const selectedModel = modelOptions.find((m) => m.model === data.product_model)
    const newDeal: Deal = {
      id: Date.now().toString(),
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
    }
    const nextDeals = [newDeal, ...deals]
    // Persist ดีลก่อน แล้วค่อยแตะ se_settings — ไม่งั้น as-store-updated จาก settings จะ sync ดีล
    // จาก localStorage ก่อน useEffect จะเขียน ทำให้ดีลที่เพิ่งสร้างหายไป
    writeSEDeals(nextDeals)
    setDeals(nextDeals)
    if (!seSettings.se_customers.includes(customerName)) {
      writeSESettings({
        ...seSettings,
        se_customers: [...seSettings.se_customers, customerName],
      })
      setSESettings((prev) => ({ ...prev, se_customers: [...prev.se_customers, customerName] }))
    }
    toast({ title: "สร้างดีลสำเร็จ", description: `${newDeal.deal_no}: ${data.title}` })
    setDialogOpen(false)
    setCustomerMode("existing")
    reset({ stage: stages[0] ?? "lead", probability: 20, value: 0, customer_name: "", customer_name_new: "", product_model: "" })
  }

  function moveStage(dealId: string, newStage: string) {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
  }

  function requestBookingForDeal(deal: Deal) {
    if (deal.probability <= 7) {
      toast({ title: "ยังขอ Booking ไม่ได้", description: "ดีลต้องมีโอกาสมากกว่า 7%", variant: "destructive" })
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
        action={{ label: "เพิ่มดีล", onClick: () => { reset({ stage: stages[0] ?? "lead", probability: 20, value: 0, customer_name: "", customer_name_new: "", product_model: "" }); setDialogOpen(true) }, icon: Plus }}
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
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">ดีลทั้งหมด (ไม่รวม Lost)</p><p className="text-2xl font-bold">{visibleDeals.filter(d => d.stage !== "lost").length} รายการ</p></CardContent></Card>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage, idx) => {
          const stageDeals = visibleDeals.filter(d => d.stage === stage)
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
                {stageDeals.map(d => (
                  <Card key={d.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-xs text-muted-foreground font-mono">{d.deal_no}</p>
                      <p className="font-semibold text-sm leading-tight">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                      {d.product_model && <p className="text-xs text-muted-foreground">Model: {d.product_model}</p>}
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-sm font-medium text-primary">{formatCurrency(d.value)}</span>
                        <Badge variant="outline" className="text-xs">{d.probability}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">ECD: {d.expected_close_date}</p>
                      {getBookingStatus(d.id) && (
                        <Badge
                          variant={getBookingStatus(d.id)?.request_status === "approved" ? "success" : getBookingStatus(d.id)?.request_status === "rejected" ? "destructive" : "warning"}
                          className="text-[10px]"
                        >
                          Booking: {getBookingStatus(d.id)?.request_status}
                        </Badge>
                      )}
                      {d.probability > 7 && (
                        <button
                          type="button"
                          onClick={() => requestBookingForDeal(d)}
                          className="w-full mt-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold py-1.5 hover:bg-indigo-100"
                        >
                          ขอ Booking ไป Stock
                        </button>
                      )}
                      {/* Quick move */}
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
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Deal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>เพิ่มดีลใหม่</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-1.5">
                <Label>ชื่อดีล *</Label>
                <Input placeholder="เช่น MRI 3T สำหรับโรงพยาบาล..." {...register("title")} />
              </div>
              <div className="space-y-1.5">
                <Label>ลูกค้า *</Label>
                <div className="flex items-center gap-2 mb-1">
                  <Button type="button" variant={customerMode === "existing" ? "default" : "outline"} size="sm" onClick={() => setCustomerMode("existing")}>ลูกค้าเดิม</Button>
                  <Button type="button" variant={customerMode === "new" ? "default" : "outline"} size="sm" onClick={() => setCustomerMode("new")}>ลูกค้าใหม่</Button>
                </div>
                {customerMode === "existing" ? (
                  <Select onValueChange={v => setValue("customer_name", v)}>
                    <SelectTrigger><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
                    <SelectContent>{seSettings.se_customers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="พิมพ์ชื่อลูกค้าใหม่" {...register("customer_name_new")} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select onValueChange={v => setValue("stage", v as any)} defaultValue={stages[0] ?? "lead"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Product Model *</Label>
                <Select onValueChange={(v) => {
                  setValue("product_model", v)
                  const found = modelOptions.find((m) => m.model === v)
                  if (found) setValue("manufacturer", found.manufacturer)
                }}>
                  <SelectTrigger><SelectValue placeholder="เลือก model" /></SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((m) => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.product_model && (
                  <p className="text-xs text-red-600">{errors.product_model.message || "กรุณาเลือก Product Model"}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer</Label>
                <Input {...register("manufacturer")} placeholder="Auto จาก model (แก้ได้)" />
              </div>
              <div className="space-y-1.5">
                <Label>มูลค่า (บาท)</Label>
                <Input type="number" min={0} {...register("value", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>โอกาส (%)</Label>
                <Input type="number" min={0} max={100} {...register("probability", { valueAsNumber: true })} />
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
    </div>
  )
}
