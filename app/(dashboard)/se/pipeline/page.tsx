"use client"

import { useEffect, useState } from "react"
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
import { readSESettings } from "@/lib/mock/as-store"

interface Deal {
  id: string
  deal_no: string
  customer_name: string
  title: string
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
  value: number
  probability: number
  expected_close_date: string
  owner: string
}

const MOCK_DEALS: Deal[] = [
  { id: "1", deal_no: "DEAL-001", customer_name: "โรงพยาบาลกรุงเทพ", title: "MRI 3T ใหม่", stage: "negotiation", value: 25000000, probability: 70, expected_close_date: "2024-04-30", owner: "คุณอนันต์" },
  { id: "2", deal_no: "DEAL-002", customer_name: "โรงพยาบาลรามาธิบดี", title: "CT Scan 128 Slice", stage: "proposal", value: 15000000, probability: 50, expected_close_date: "2024-05-15", owner: "คุณนภา" },
  { id: "3", deal_no: "DEAL-003", customer_name: "โรงพยาบาลมหาราชนครเชียงใหม่", title: "Ultrasound High-end", stage: "qualified", value: 8000000, probability: 30, expected_close_date: "2024-06-01", owner: "คุณอนันต์" },
  { id: "4", deal_no: "DEAL-004", customer_name: "คลินิกสุขภาพดี", title: "X-Ray Digital", stage: "lead", value: 3500000, probability: 20, expected_close_date: "2024-07-01", owner: "คุณรัตนา" },
  { id: "5", deal_no: "DEAL-005", customer_name: "โรงพยาบาลสมิติเวช", title: "Mammography", stage: "won", value: 12000000, probability: 100, expected_close_date: "2024-03-01", owner: "คุณนภา" },
  { id: "6", deal_no: "DEAL-006", customer_name: "โรงพยาบาลสมิติเวช", title: "Endoscopy System", stage: "lead", value: 5000000, probability: 20, expected_close_date: "2024-08-01", owner: "คุณรัตนา" },
]

const STAGES = [
  { key: "lead" as const, label: "Lead", color: "bg-gray-50 border-gray-200" },
  { key: "qualified" as const, label: "Qualified", color: "bg-blue-50 border-blue-200" },
  { key: "proposal" as const, label: "Proposal", color: "bg-purple-50 border-purple-200" },
  { key: "negotiation" as const, label: "Negotiation", color: "bg-orange-50 border-orange-200" },
  { key: "won" as const, label: "Won", color: "bg-green-50 border-green-200" },
]

const dealSchema = z.object({
  customer_name: z.string().min(1),
  title: z.string().min(1),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]),
  value: z.number().min(0),
  probability: z.number().min(0).max(100),
  expected_close_date: z.string(),
  owner: z.string().optional(),
})

type DealForm = z.infer<typeof dealSchema>

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [seSettings, setSESettings] = useState(readSESettings())
  const { toast } = useToast()

  useEffect(() => {
    const sync = () => setSESettings(readSESettings())
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { stage: "lead", probability: 20, value: 0 },
  })

  const totalValue = deals.filter(d => d.stage !== "lost").reduce((sum, d) => sum + d.value * d.probability / 100, 0)
  const wonValue = deals.filter(d => d.stage === "won").reduce((sum, d) => sum + d.value, 0)

  function onSubmit(data: DealForm) {
    const newDeal: Deal = {
      ...data,
      id: Date.now().toString(),
      deal_no: `DEAL-${String(deals.length + 1).padStart(3, "0")}`,
      owner: data.owner ?? "",
    }
    setDeals(prev => [newDeal, ...prev])
    toast({ title: "สร้างดีลสำเร็จ", description: `${newDeal.deal_no}: ${data.title}` })
    setDialogOpen(false)
    reset()
  }

  function moveStage(dealId: string, newStage: Deal["stage"]) {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
  }

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        description="ติดตามดีลแบบ Kanban"
        icon={GitBranch}
        action={{ label: "เพิ่มดีล", onClick: () => { reset({ stage: "lead", probability: 20, value: 0 }); setDialogOpen(true) }, icon: Plus }}
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Weighted Pipeline</p><p className="text-2xl font-bold text-primary">{formatCurrency(totalValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Won ทั้งหมด</p><p className="text-2xl font-bold text-green-600">{formatCurrency(wonValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">ดีลทั้งหมด (ไม่รวม Lost)</p><p className="text-2xl font-bold">{deals.filter(d => d.stage !== "lost").length} รายการ</p></CardContent></Card>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key)
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0)
          return (
            <div key={stage.key} className={`rounded-xl border-2 ${stage.color} p-3 min-w-[220px] flex-1`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{stage.label}</h3>
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
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-sm font-medium text-primary">{formatCurrency(d.value)}</span>
                        <Badge variant="outline" className="text-xs">{d.probability}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">ปิดภายใน: {d.expected_close_date}</p>
                      {/* Quick move */}
                      <Select onValueChange={v => moveStage(d.id, v as Deal["stage"])} value={d.stage}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["lead", "qualified", "proposal", "negotiation", "won", "lost"].map(s => (
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
                <Select onValueChange={v => setValue("customer_name", v)}>
                  <SelectTrigger><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
                  <SelectContent>{seSettings.se_customers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select onValueChange={v => setValue("stage", v as any)} defaultValue="lead">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["lead", "qualified", "proposal", "negotiation"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Label>วันที่คาดปิด</Label>
                <Input type="date" {...register("expected_close_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>ผู้รับผิดชอบ</Label>
                <Select onValueChange={v => setValue("owner", v)}>
                  <SelectTrigger><SelectValue placeholder="เลือก SE" /></SelectTrigger>
                  <SelectContent>{seSettings.se_owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
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
