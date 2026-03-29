"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  AS_STORE_KEYS,
  appendSEDealActivity,
  appendSEOrderRequest,
  readSEDeals,
  readSEOrderRequests,
  type SEDeal,
  type SEOrderRequest,
} from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { DealStageBadge } from "@/components/ui/status-badge"

function isWonDeal(d: SEDeal): boolean {
  return /won|ชนะ|closed\s*won/i.test((d.stage || "").trim())
}

export default function SEOrderRequestPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [deals, setDeals] = useState<SEDeal[]>(() => readSEDeals([]))
  const [orderRequests, setOrderRequests] = useState<SEOrderRequest[]>(() => readSEOrderRequests([]))
  const [dealId, setDealId] = useState("")
  const [customerPo, setCustomerPo] = useState("")
  const [adminQuote, setAdminQuote] = useState("")
  const [note, setNote] = useState("")

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleDeals = useMemo(
    () => (!isAdmin && ownerName ? deals.filter((d) => (d.owner || "").trim() === ownerName) : deals),
    [deals, isAdmin, ownerName],
  )
  const wonDeals = useMemo(() => visibleDeals.filter(isWonDeal), [visibleDeals])

  const selectedDeal = useMemo(() => wonDeals.find((d) => d.id === dealId) ?? null, [wonDeals, dealId])

  const hydrate = useCallback(() => {
    setDeals(readSEDeals([]))
    setOrderRequests(readSEOrderRequests([]))
  }, [])

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals || ev.key === AS_STORE_KEYS.seOrderRequests) hydrate()
    }
    const onStore = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seDeals || key === AS_STORE_KEYS.seOrderRequests) hydrate()
    }
    hydrate()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStore)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStore)
    }
  }, [hydrate])

  useEffect(() => {
    if (!selectedDeal) {
      setAdminQuote("")
      return
    }
    setAdminQuote((selectedDeal.admin_quote_no ?? "").trim())
  }, [selectedDeal?.id, selectedDeal?.admin_quote_no])

  const submitRequest = () => {
    if (!selectedDeal) {
      toast({ title: "เลือกดีลก่อน", description: "เฉพาะดีล Won เท่านั้น", variant: "destructive" })
      return
    }
    if (!customerPo.trim()) {
      toast({ title: "กรุณากรอกเลขที่ PO ลูกค้า", variant: "destructive" })
      return
    }
    if (!adminQuote.trim()) {
      toast({ title: "กรุณากรอกเลขใบเสนอราคาจาก Admin", variant: "destructive" })
      return
    }
    const owner = isAdmin ? selectedDeal.owner : ownerName || selectedDeal.owner
    const id = `or-${Date.now()}`
    const row: SEOrderRequest = {
      id,
      deal_id: selectedDeal.id,
      deal_no: selectedDeal.deal_no,
      customer_name: selectedDeal.customer_name,
      deal_title: selectedDeal.title,
      customer_po_no: customerPo.trim(),
      admin_quote_no: adminQuote.trim(),
      owner,
      created_at: new Date().toISOString(),
      note: note.trim() || undefined,
      stock_po_verified: false,
    }
    appendSEOrderRequest(row)
    appendSEDealActivity({
      deal_id: selectedDeal.id,
      activity_type: "order_request",
      source: "se_order_request",
      subject: `Order Request — PO ลูกค้า ${row.customer_po_no}`,
      note: `QT Admin: ${row.admin_quote_no}${row.note ? ` · ${row.note}` : ""}`,
      occurred_on: new Date().toISOString().slice(0, 10),
      actor_name: owner,
      meta: { ref_no: row.customer_po_no },
    })
    hydrate()
    setCustomerPo("")
    setNote("")
    toast({
      title: "ส่งคำขอออเดอร์แล้ว",
      description: "ฝ่าย Stock จะตรวจ PO กับอีเมลที่ได้รับ — ติ๊กยืนยันที่หน้า Stock",
    })
  }

  const myRecent = useMemo(() => {
    const mine = !isAdmin && ownerName ? orderRequests.filter((r) => (r.owner || "").trim() === ownerName) : orderRequests
    return mine.slice(0, 12)
  }, [orderRequests, isAdmin, ownerName])

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Order Request"
        description="เปิดคำขอออเดอร์ผูกดีล — เฉพาะดีล Won · ระบุ PO ลูกค้า + เลข QT จาก Admin (ออกออเดอร์จริงผ่านอีเมลภายนอก)"
        icon={ClipboardList}
      />
      {!isAdmin && (
        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
          My Data Only (enforced)
        </Badge>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-3xl border-slate-200/90 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">สร้างคำขอ</CardTitle>
            <p className="text-xs font-normal text-muted-foreground leading-relaxed">
              เลข QT บันทึกบนดีลได้ที่ Deal &amp; Activity — จะดึงมาเป็นค่าเริ่มต้นเมื่อเลือกดีล
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>ดีล (Won เท่านั้น)</Label>
              <Select value={dealId || undefined} onValueChange={setDealId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="เลือกดีลที่ปิดการขายแล้ว" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {wonDeals.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">ไม่มีดีล Won ในมุมมองของคุณ</div>
                  ) : (
                    wonDeals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="font-mono text-[11px] text-muted-foreground">{d.deal_no}</span> {d.title} ·{" "}
                        {d.customer_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedDeal ? (
              <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DealStageBadge stage={selectedDeal.stage} />
                  <span className="font-semibold">{selectedDeal.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatCurrency(selectedDeal.value)}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>เลขที่ PO ลูกค้า *</Label>
              <Input
                className="rounded-xl"
                value={customerPo}
                onChange={(e) => setCustomerPo(e.target.value)}
                placeholder="ตามเอกสารลูกค้า"
              />
            </div>
            <div className="space-y-2">
              <Label>เลขที่ใบเสนอราคาจาก Admin *</Label>
              <Input
                className="rounded-xl"
                value={adminQuote}
                onChange={(e) => setAdminQuote(e.target.value)}
                placeholder="QT ที่ได้จากฝ่ายจัดราคา"
              />
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Textarea className="rounded-xl min-h-[72px] text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button
              type="button"
              className="w-full rounded-2xl bg-violet-600 hover:bg-violet-700"
              disabled={!selectedDeal}
              onClick={submitRequest}
            >
              ส่งคำขอไป Stock
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/90 shadow-sm lg:sticky lg:top-4 h-fit">
          <CardHeader className="border-b border-slate-100 pb-2">
            <CardTitle className="text-sm">คำขอล่าสุดของคุณ</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto p-4">
            {myRecent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">ยังไม่มีคำขอ</p>
            ) : (
              myRecent.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs space-y-1">
                  <p className="font-mono text-[10px] text-muted-foreground">{r.deal_no}</p>
                  <p className="font-medium text-slate-800">{r.deal_title}</p>
                  <p>PO: {r.customer_po_no}</p>
                  <p>QT: {r.admin_quote_no}</p>
                  <div className="flex items-center gap-2 pt-1">
                    {r.stock_po_verified ? (
                      <Badge className="text-[10px] bg-emerald-600">Stock ยืนยัน PO ตรงอีเมลแล้ว</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-800">
                        รอ Stock ตรวจ
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{formatDate(r.created_at.slice(0, 10))}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
