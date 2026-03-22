"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Search, Plus, ChevronRight, X, Wrench, FlaskConical, Clock, CheckCircle2, Copy, Check, Building2, User, Hash, FileText, Trash2, Bell, Inbox, Users, ClipboardCheck } from "lucide-react"
import {
  readASWorkflowSettings,
  readIncomingSERequests,
  readJobs,
  readRepairToCalRequests,
  readOrganizations,
  readStockDispatches,
  appendStockDispatchHistory,
  appendRepairToCalRequest,
  removeIncomingSERequest,
  removeRepairToCalRequest,
  upsertOrganizationByName,
  writeJobs,
  writeOrganizations,
  writeStockDispatches,
  type ASServiceJob as ServiceJob,
  type ASStockDispatch as StockDispatch,
  type ASRepairToCalRequest as RepairToCalRequest,
  type ASIncomingSERequest,
  type ASOrganization,
} from "@/lib/mock/as-store"
import { STATUS_FLOW, getSlaState, getTransitionBlockReason, getCalibrationAlertLevel } from "@/lib/mock/as-logic"
import { formatThDateTime } from "@/lib/format-th-datetime"

type JobType = "repair" | "calibration" | "commissioning"
type Priority = "urgent" | "high" | "normal"
type Routing = "in_country" | "overseas"
type MainTab = "jobs" | "commissioning" | "from_stock" | "from_se" | "from_repair_cal"
/** งาน Commissioning Test (รับเข้า / ตรวจเช็คก่อนเข้า Stock) — ไม่ใช่ Calibration ทั่วไป */
const COMMISSIONING_STATUS_FLOW: ServiceJob["status"][] = ["รอประเมิน", "QC", "รอส่งคืน", "ปิดงาน"]

function isCommissioningTestJob(job: ServiceJob): boolean {
  if (job.job_type === "commissioning") return true
  if (job.source === "stock" && job.job_type === "calibration") {
    const s = job.symptom_reported
    return s.includes("QC ก่อนเข้า Stock") || s.includes("Commissioning Test")
  }
  return false
}

// Store-backed types are imported from lib/mock/as-store

// ── Service request originated by SE team ────────────────────────────────────
type SERequest = ASIncomingSERequest

function CancelJobDialog({
  job,
  reason,
  actionPlan,
  onReasonChange,
  onActionPlanChange,
  onClose,
  onConfirm,
}: {
  job: ServiceJob
  reason: string
  actionPlan: string
  onReasonChange: (value: string) => void
  onActionPlanChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-red-700">ยกเลิกงาน</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 p-3 rounded-xl border border-red-100 bg-red-50">
          <p className="text-xs text-red-600">Job</p>
          <p className="text-sm font-semibold text-gray-900">{job.job_no} · {job.model}</p>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">เหตุผลการยกเลิก *</label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          className={`${inp} resize-none`}
          placeholder="ระบุเหตุผล เช่น ลูกค้ายกเลิก, ข้อมูลผิดพลาด, รวมงานกับใบงานอื่น"
        />
        <label className="block text-sm font-medium text-gray-700 mb-1.5 mt-3">Action Plan การแก้ไข / ขั้นตอนถัดไป *</label>
        <p className="text-xs text-gray-500 mb-1.5">ระบุว่าจะดำเนินการอย่างไรต่อ เช่น แจ้งลูกค้า, ส่งคืน Stock, เปิดงานใหม่, ติดตามอะไหล่</p>
        <textarea
          value={actionPlan}
          onChange={(e) => onActionPlanChange(e.target.value)}
          rows={3}
          className={`${inp} resize-none`}
          placeholder="เช่น แจ้ง SE ปิดใบงาน · คืนเครื่องเข้า Stock แถว X · นัดลูกค้าใหม่วันที่ ..."
        />
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
            ปิด
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!reason.trim() || !actionPlan.trim()}
            className="flex-1 py-2.5 rounded-xl bg-red-500 disabled:bg-gray-300 text-white text-sm font-bold hover:bg-red-600"
          >
            ยืนยันยกเลิกงาน
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Seed organizations (fallback only) ─────────────────────────────────────────
const MOCK_ORGS = [
  "โรงพยาบาลศิริราช",
  "โรงพยาบาลกรุงเทพ",
  "โรงพยาบาลมหาราชนครเชียงใหม่",
  "โรงพยาบาลขอนแก่น",
  "โรงพยาบาลสมิติเวช",
  "โรงพยาบาลบำรุงราษฎร์",
  "โรงพยาบาลรามาธิบดี",
  "โรงพยาบาลจุฬาลงกรณ์",
  "โรงพยาบาลพระมงกุฎเกล้า",
  "โรงพยาบาลนครพิงค์",
]

function addOneYear(date: string) {
  if (!date) return ""
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split("T")[0]
}

const STATUS_COLORS: Record<ServiceJob["status"], string> = {
  "รอประเมิน": "bg-gray-100 text-gray-600",
  "กำลังประเมิน": "bg-blue-100 text-blue-700",
  "รอ Quotation Approve": "bg-purple-100 text-purple-700",
  "รอ PO": "bg-orange-100 text-orange-700",
  "ในคิว": "bg-yellow-100 text-yellow-700",
  "กำลังซ่อม": "bg-blue-100 text-blue-700",
  "รออะไหล่": "bg-red-100 text-red-700",
  "QC": "bg-teal-100 text-teal-700",
  "รอส่งคืน": "bg-indigo-100 text-indigo-700",
  "ปิดงาน": "bg-green-100 text-green-700",
  "ยกเลิก": "bg-gray-200 text-gray-700",
}

const MOCK_JOBS: ServiceJob[] = [
  { id:"1", job_no:"JOB-2024-001", job_type:"repair", status:"กำลังซ่อม", priority:"urgent",
    serial_number:"PS8-2023-00451", manufacturer:"Fluke Biomedical", model:"ProSim 8",
    received_date:"2024-03-10", tracking_in:"TH123456789", receive_channel:"ขนส่งเอกชน",
    customer_name:"นายประสิทธิ์ แก้วมณี", customer_org:"โรงพยาบาลกรุงเทพ",
    routing:"in_country", symptom_reported:"เครื่องไม่ติด กดเปิดแล้วหน้าจอดับ",
    symptom_actual:"แบตเตอรี่เสื่อม และ IC Power ชำรุด", fix_method:"เปลี่ยนแบตเตอรี่และ IC",
    requires_approval:true, quotation_approved:true, po_number:"PO-BKH-2024-112",
    technician:"ช่างสมชาย", created_at:"2024-03-10" },
  { id:"2", job_no:"JOB-2024-002", job_type:"calibration", status:"รอ PO", priority:"high",
    serial_number:"IDA6-2022-00891", manufacturer:"Fluke Biomedical", model:"IDA 6 (4ch)",
    received_date:"2024-03-12", tracking_in:"TH987654321", receive_channel:"พนักงาน",
    customer_name:"นางสมศรี ใจดี", customer_org:"โรงพยาบาลมหาราชนครเชียงใหม่",
    routing:"in_country", lab_name:"สถาบันมาตรวิทยาแห่งชาติ (NIMT)",
    symptom_reported:"ครบรอบสอบเทียบประจำปี",
    requires_approval:true, quotation_approved:false,
    technician:"ช่างวิทยา", created_at:"2024-03-12" },
  { id:"3", job_no:"JOB-2024-003", job_type:"repair", status:"รอประเมิน", priority:"normal",
    serial_number:"ESA-2021-00234", manufacturer:"Fluke Biomedical", model:"ESA 615",
    received_date:"2024-03-15", tracking_in:"TH555666777", receive_channel:"ขนส่งเอกชน",
    customer_name:"นพ.ธีรพล รักดี", customer_org:"โรงพยาบาลขอนแก่น",
    routing:"overseas", rma_code:"RMA-FBC-2024-089",
    symptom_reported:"ค่าที่วัดได้ไม่ตรง Spec ผิดพลาดเกิน 10%",
    requires_approval:true, created_at:"2024-03-15" },
  { id:"4", job_no:"JOB-2024-004", job_type:"calibration", status:"ปิดงาน", priority:"normal",
    serial_number:"X2-2020-00156", manufacturer:"RaySafe", model:"X2 Sensor",
    received_date:"2024-02-20", tracking_in:"TH111222333", receive_channel:"พนักงาน",
    customer_name:"นพ.วีระชัย สมิทธ์", customer_org:"โรงพยาบาลศิริราช",
    routing:"overseas", rma_code:"RMA-RS-2024-045",
    symptom_reported:"สอบเทียบรายปี ส่ง RaySafe สวีเดน",
    requires_approval:false, quotation_approved:true, po_number:"PO-SIR-2024-078",
    tracking_out:"TH444555666", invoice_no:"INV-2024-156", warranty_days:"365",
    calibration_date:"2024-03-20", due_date:"2025-03-20",
    technician:"ช่างสมชาย", created_at:"2024-02-20" },
  { id:"5", job_no:"JOB-2024-005", job_type:"repair", status:"รออะไหล่", priority:"high",
    serial_number:"PS4-2019-00712", manufacturer:"Fluke Biomedical", model:"ProSim 4",
    received_date:"2024-03-08", tracking_in:"TH777888999", receive_channel:"ขนส่งเอกชน",
    customer_name:"นางสาวพรรณี วงศ์ดี", customer_org:"โรงพยาบาลศิริราช",
    routing:"in_country", symptom_reported:"Display แสดงผลผิดพลาด บางส่วนไม่แสดง",
    symptom_actual:"LCD module เสีย ต้องเปลี่ยน",
    requires_approval:true, quotation_approved:true, po_number:"PO-SIR-2024-095",
    technician:"ช่างวิทยา", created_at:"2024-03-08" },
]

// ── Mock dispatched jobs from Stock ───────────────────────────────────────────
const MOCK_STOCK_DISPATCHES: StockDispatch[] = [
  {
    id: "sd1",
    item_name: "ProSim 8 + SPOT Module",
    serial_number: "PS8-2024-NEW-001",
    customer_org: "โรงพยาบาลรามาธิบดี",
    customer_contact: "นายสมชาย วงศ์ดี",
    symptom: "เครื่องรับมาจาก Sales พบว่า Firmware ล้าสมัย ต้องอัปเดตและทดสอบ",
    job_type: "repair",
    dispatched_by: "Stock สมชาย",
    dispatched_at: "2024-03-18",
  },
  {
    id: "sd2",
    item_name: "RaySafe X2 Solo",
    serial_number: "X2S-2024-001",
    customer_org: "โรงพยาบาลสมิติเวช",
    customer_contact: "นางสาวพิมลพรรณ รักดี",
    symptom: "ส่งสอบเทียบประจำปี ก่อนส่งมอบให้ลูกค้า",
    job_type: "calibration",
    dispatched_by: "Stock สมชาย",
    dispatched_at: "2024-03-19",
  },
]

// ── Mock SE requests ──────────────────────────────────────────────────────────
const MOCK_SE_REQUESTS: SERequest[] = [
  {
    id: "se1",
    customer_org: "โรงพยาบาลบำรุงราษฎร์",
    equipment: "ESA 615 — SN: ESA615-DEMO-001",
    issue_description: "ลูกค้าแจ้งว่าเครื่อง Demo ที่ยืมไปมีปัญหาการวัดค่า Leakage current ผิดพลาด ต้องการให้ทีมช่างตรวจสอบก่อนจะตัดสินใจซื้อ",
    requested_by: "คุณวิภาพร (SE)",
    requested_at: "2024-03-17",
    priority: "high",
  },
  {
    id: "se2",
    customer_org: "โรงพยาบาลจุฬาลงกรณ์",
    equipment: "ProSim 4 — SN: PS4-DEMO-002",
    issue_description: "ลูกค้าต้องการสอบเทียบ ProSim 4 ตัว Demo ที่ทางโรงพยาบาลใช้อยู่ เพื่อนำผลสอบเทียบไปใช้ประกอบการขอ Budget",
    requested_by: "คุณธนากร (SE)",
    requested_at: "2024-03-20",
    priority: "normal",
  },
]

const LABS = ["สถาบันมาตรวิทยาแห่งชาติ (NIMT)","สถาบันเทคโนโลยีไทย-ญี่ปุ่น (TNI)","มจธ. ศูนย์บริการวิทยาศาสตร์","อื่นๆ"]
const MANUFACTURERS = ["Fluke Biomedical","RaySafe","Fluke General","IMT Analytics","Omega","Testo","Other"]

// ── Pill ────────────────────────────────────────────────────────────────────
function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

// ── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, selected, onClick }: { job: ServiceJob; selected: boolean; onClick: () => void }) {
  const priorityColor = job.priority === "urgent" ? "bg-red-100 text-red-700" : job.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
  const ct = isCommissioningTestJob(job)
  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-2xl border transition-all backdrop-blur ${selected ? "bg-blue-50/85 border-blue-300 shadow-sm" : "bg-white/75 border-white/70 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(59,130,246,0.15)]"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`p-1 rounded-lg ${ct ? "bg-amber-100" : job.job_type === "repair" ? "bg-blue-100" : "bg-teal-100"}`}>
            {ct ? <ClipboardCheck className="h-3 w-3 text-amber-700" /> : job.job_type === "repair" ? <Wrench className="h-3 w-3 text-blue-600" /> : <FlaskConical className="h-3 w-3 text-teal-600" />}
          </span>
          <span className="text-xs font-mono text-gray-500">{job.job_no}</span>
        </div>
        <Pill label={job.priority === "urgent" ? "เร่งด่วน" : job.priority === "high" ? "สำคัญ" : "ปกติ"} color={priorityColor} />
      </div>
      <p className="font-bold text-sm text-gray-900 mb-0.5">{job.model}</p>
      <p className="text-xs text-gray-500 font-mono mb-2">SN: {job.serial_number}</p>
      <p className="text-xs text-gray-500 truncate mb-2">{job.customer_org}</p>
      <div className="flex items-center justify-between">
        <Pill label={job.status} color={STATUS_COLORS[job.status]} />
        <span className="text-xs text-gray-400">{job.received_date}</span>
      </div>
    </button>
  )
}

// ── Org Select Component ──────────────────────────────────────────────────────
function OrgSelect({
  value,
  onChange,
  required,
  className,
  orgNames,
}: {
  value: string
  onChange: (v: string) => void
  required?: boolean
  className?: string
  orgNames: string[]
}) {
  const [custom, setCustom] = useState(!orgNames.includes(value) && value !== "")
  useEffect(() => {
    setCustom(!orgNames.includes(value) && value !== "")
  }, [orgNames, value])
  return (
    <div className="space-y-2">
      <select
        value={custom ? "__custom__" : value}
        onChange={e => {
          if (e.target.value === "__custom__") { setCustom(true); onChange("") }
          else { setCustom(false); onChange(e.target.value) }
        }}
        className={className}
        required={!!required && !custom}
      >
        <option value="">-- เลือกหน่วยงาน --</option>
        {orgNames.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__custom__">+ พิมพ์เอง...</option>
      </select>
      {custom && (
        <input
          required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="พิมพ์ชื่อหน่วยงาน"
          className={className}
        />
      )}
    </div>
  )
}

// ── New Job Dialog ────────────────────────────────────────────────────────────
function NewJobDialog({
  onClose,
  onSave,
  orgNames,
}: {
  onClose: () => void
  onSave: (j: ServiceJob) => void
  orgNames: string[]
}) {
  const [form, setForm] = useState({
    job_type: "repair" as JobType,
    priority: "normal" as Priority,
    routing: "in_country" as Routing,
    receive_channel: "ขนส่งเอกชน" as "พนักงาน" | "ขนส่งเอกชน",
    manufacturer: "Fluke Biomedical",
    model: "",
    serial_number: "",
    received_date: new Date().toISOString().split("T")[0],
    tracking_in: "",
    customer_name: "",
    customer_org: "",
    symptom_reported: "",
    rma_code: "",
    lab_name: "",
    requires_approval: true,
  })
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const count = Math.floor(Math.random() * 900) + 100
    onSave({ id: Date.now().toString(), job_no: `JOB-2024-0${count}`, status: "รอประเมิน", created_at: new Date().toISOString().split("T")[0], ...form, rma_code: form.routing === "overseas" ? form.rma_code : undefined, lab_name: form.job_type === "calibration" && form.routing === "in_country" ? form.lab_name : undefined })
    onClose()
  }
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  const lbl = "block text-sm font-medium text-gray-700 mb-1.5"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <h2 className="font-bold text-lg">สร้างงานใหม่</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>ประเภทงาน</label>
              <div className="flex flex-wrap gap-2">
                {(["repair","calibration","commissioning"] as JobType[]).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f=>({...f,job_type:t}))}
                    className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                      form.job_type===t
                        ? t==="repair"
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : t==="calibration"
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-gray-200 text-gray-500"
                    }`}>
                    {t==="repair" ? "🔧 Repair" : t==="calibration" ? "📐 Cal" : "✅ Comm. Test"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <div className="flex gap-2">
                {([["urgent","เร่งด่วน"],["high","สำคัญ"],["normal","ปกติ"]] as [Priority,string][]).map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setForm(f=>({...f,priority:v}))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${form.priority===v ? v==="urgent" ? "border-red-400 bg-red-50 text-red-700" : v==="high" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-400 bg-gray-100 text-gray-700" : "border-gray-200 text-gray-400"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Equipment */}
          <div className="p-4 rounded-2xl bg-gray-50 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">ข้อมูลเครื่อง</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Manufacturer</label>
                <select value={form.manufacturer} onChange={e=>setForm(f=>({...f,manufacturer:e.target.value}))} className={inp}>
                  {MANUFACTURERS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Model *</label>
                <input required value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} className={inp} placeholder="เช่น ProSim 8, IDA 6" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Serial Number *</label>
                <input required value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN ของเครื่อง" />
              </div>
              <div>
                <label className={lbl}>วันที่รับเครื่อง</label>
                <input type="date" value={form.received_date} onChange={e=>setForm(f=>({...f,received_date:e.target.value}))} className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tracking No. (ขาเข้า)</label>
                <input value={form.tracking_in} onChange={e=>setForm(f=>({...f,tracking_in:e.target.value}))} className={inp} placeholder="EMS / Kerry tracking" />
              </div>
              <div>
                <label className={lbl}>ช่องทางรับ</label>
                <div className="flex gap-2 mt-1">
                  {(["พนักงาน","ขนส่งเอกชน"] as const).map(c=>(
                    <button key={c} type="button" onClick={()=>setForm(f=>({...f,receive_channel:c}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all ${form.receive_channel===c ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400"}`}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Routing */}
          <div className="p-4 rounded-2xl bg-gray-50 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">การส่งซ่อม / สอบเทียบ</p>
            <div className="flex gap-3">
              {([["in_country","🇹🇭 ในประเทศ"],["overseas","✈️ ต่างประเทศ"]] as [Routing,string][]).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,routing:v}))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.routing===v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>{l}</button>
              ))}
            </div>
            {form.routing==="overseas" && (
              <div>
                <label className={lbl}>RMA Code *</label>
                <input required value={form.rma_code} onChange={e=>setForm(f=>({...f,rma_code:e.target.value}))} className={inp} placeholder="RMA-FBC-2024-XXX" />
              </div>
            )}
            {form.job_type==="calibration" && form.routing==="in_country" && (
              <div>
                <label className={lbl}>Lab ที่ส่ง</label>
                <select value={form.lab_name} onChange={e=>setForm(f=>({...f,lab_name:e.target.value}))} className={inp}>
                  <option value="">-- เลือก Lab --</option>
                  {LABS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
            )}
          </div>
          {/* Customer — now uses OrgSelect dropdown */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>หน่วยงาน *</label>
              <OrgSelect
                value={form.customer_org}
                onChange={v => setForm(f => ({ ...f, customer_org: v }))}
                required
                orgNames={orgNames}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>ผู้ติดต่อ</label>
              <input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} className={inp} placeholder="ชื่อผู้ติดต่อ" />
            </div>
          </div>
          {/* Symptom */}
          <div>
            <label className={lbl}>อาการที่ลูกค้าแจ้ง *</label>
            <textarea required value={form.symptom_reported} onChange={e=>setForm(f=>({...f,symptom_reported:e.target.value}))} className={`${inp} resize-none`} rows={3} placeholder="อาการเสีย หรือเหตุผลที่ส่งมา" />
          </div>
          {/* Approval */}
          <button type="button" onClick={()=>setForm(f=>({...f,requires_approval:!f.requires_approval}))}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.requires_approval ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-gray-200"}`}>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${form.requires_approval ? "bg-purple-500" : "bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.requires_approval ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${form.requires_approval ? "text-purple-800" : "text-gray-700"}`}>ต้องรอ Approve Quotation</p>
              <p className={`text-xs ${form.requires_approval ? "text-purple-500" : "text-gray-400"}`}>ปิดเพื่อข้ามขั้นตอนนี้ (กรณีพิเศษ)</p>
            </div>
          </button>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">สร้างงาน</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Quotation Draft Dialog ────────────────────────────────────────────────────
interface QuoteLine { id: string; description: string; amount: number }

function QuotationDraftDialog({ job, onClose }: { job: ServiceJob; onClose: () => void }) {
  const quoteKind = isCommissioningTestJob(job)
    ? "Commissioning Test"
    : job.job_type === "repair"
      ? "ซ่อม"
      : "สอบเทียบ"
  const [quoteName, setQuoteName] = useState(`ใบเสนอราคา${quoteKind} ${job.model}`)
  const [customerName, setCustomerName] = useState(job.customer_org)
  const [lines, setLines] = useState<QuoteLine[]>([
    { id:"1", description:`ค่าแรง${quoteKind} ${job.model}`, amount:0 },
    { id:"2", description:"ค่าอะไหล่", amount:0 },
  ])
  const [costInternal, setCostInternal] = useState(0)
  const [copied, setCopied] = useState(false)

  const total = lines.reduce((s, l) => s + l.amount, 0)

  function addLine() {
    setLines(p => [...p, { id: Date.now().toString(), description:"", amount:0 }])
  }
  function removeLine(id: string) {
    setLines(p => p.filter(l => l.id !== id))
  }
  function updateLine(id: string, field: "description"|"amount", val: string|number) {
    setLines(p => p.map(l => l.id === id ? { ...l, [field]: val } : l))
  }

  function copyDraft() {
    const lineText = lines.map(l => `  - ${l.description}: ${l.amount.toLocaleString("th-TH")} บาท`).join("\n")
    const text = [
      `เรียน ${customerName}`,
      `เรื่อง ${quoteName}`,
      ``,
      `รายละเอียดงาน:`,
      `  Model: ${job.model}`,
      `  SN: ${job.serial_number}`,
      `  อาการ: ${job.symptom_reported}`,
      ``,
      `รายการค่าใช้จ่าย:`,
      lineText,
      ``,
      `รวมทั้งสิ้น: ${total.toLocaleString("th-TH")} บาท`,
      ``,
      `กรุณาส่ง PO กลับมาที่ฝ่ายบริการ`,
      `ขอบคุณครับ`,
    ].join("\n")
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-purple-500" /> Draft Quotation</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">1. ชื่อลูกค้า</label>
            <input value={customerName} onChange={e=>setCustomerName(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">2. ชื่อใบเสนอราคา</label>
            <input value={quoteName} onChange={e=>setQuoteName(e.target.value)} className={inp} />
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl text-sm text-gray-600">
            <span className="font-semibold">{job.model}</span>
            <span className="font-mono text-xs text-blue-600 ml-2">SN: {job.serial_number}</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">3. รายการ</label>
            <div className="space-y-2">
              {lines.map(l => (
                <div key={l.id} className="flex items-center gap-2">
                  <input value={l.description} onChange={e=>updateLine(l.id,"description",e.target.value)} className={`${inp} flex-1`} placeholder="รายการ" />
                  <input type="number" min={0} value={l.amount||""} onChange={e=>updateLine(l.id,"amount",Number(e.target.value))} className="w-28 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white text-right" placeholder="บาท" />
                  <button onClick={()=>removeLine(l.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={addLine} className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs font-semibold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">+ เพิ่มรายการ</button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-700">รวม</span>
              <span className="text-lg font-black text-gray-900">{total.toLocaleString("th-TH")} บาท</span>
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5">4. ราคาต้นทุนอะไหล่ (ภายใน — ไม่ส่งลูกค้า)</label>
            <input type="number" min={0} value={costInternal||""} onChange={e=>setCostInternal(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" placeholder="ต้นทุนอะไหล่ บาท" />
            {costInternal > 0 && total > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">Margin: {(((total - costInternal) / total) * 100).toFixed(1)}%</p>
            )}
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">5. สถานะการ Approve</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${job.quotation_approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {job.quotation_approved ? <><CheckCircle2 className="h-4 w-4" /> Approved โดย Admin</> : <><Clock className="h-4 w-4" /> รอ Admin Approve</>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={copyDraft}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${copied ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
            {copied ? <><Check className="h-4 w-4" /> คัดลอกแล้ว — วางใน Email ได้เลย</> : <><Copy className="h-4 w-4" /> Copy Draft → วางใน Email</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── From Stock Tab ─────────────────────────────────────────────────────────────
function FromStockTab({
  dispatches,
  onAccept,
}: {
  dispatches: StockDispatch[]
  onAccept: (d: StockDispatch) => void
}) {
  if (dispatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-300">
        <Inbox className="h-16 w-16 mb-3 opacity-30" />
        <p className="text-sm">ไม่มีงานจาก Stock</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">งานที่ฝ่าย Stock ส่งมาให้ฝ่ายบริการดำเนินการ กรุณากด "รับงาน" เพื่อเพิ่มเข้าคิวหลัก</p>
      {dispatches.map(d => (
        <div key={d.id} className="bg-white rounded-3xl border border-orange-200 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${
                  d.job_type === "commissioning" ? "bg-amber-100" : d.job_type === "repair" ? "bg-blue-100" : "bg-teal-100"
                }`}>
                  {d.job_type === "commissioning" ? (
                    <ClipboardCheck className="h-3.5 w-3.5 text-amber-700" />
                  ) : d.job_type === "repair" ? (
                    <Wrench className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
                  )}
                </span>
                <p className="font-bold text-gray-900">{d.item_name}</p>
              </div>
              <p className="font-mono text-xs text-blue-600 ml-8">SN: {d.serial_number}</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">จาก Stock</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><Building2 className="h-3 w-3" /> หน่วยงาน</p>
              <p className="text-sm font-semibold text-gray-900">{d.customer_org}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><User className="h-3 w-3" /> ผู้ติดต่อ</p>
              <p className="text-sm font-semibold text-gray-900">{d.customer_contact || "—"}</p>
            </div>
          </div>
          <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 mb-4">
            <p className="text-xs text-orange-600 mb-1">อาการ / เหตุผล</p>
            <p className="text-sm text-gray-800">{d.symptom}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              ส่งโดย <span className="font-semibold text-gray-600">{d.dispatched_by}</span> · {d.dispatched_at}
            </div>
            <button
              onClick={() => onAccept(d)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> รับงาน
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Commissioning Test Tab (รับเข้า / ตรวจเช็ค — แยกจาก Calibration) ─────────
function CommissioningWorkTab({
  dispatches,
  jobs,
  onAcceptDispatch,
  onOpenJob,
}: {
  dispatches: StockDispatch[]
  jobs: ServiceJob[]
  onAcceptDispatch: (d: StockDispatch) => void
  onOpenJob: (j: ServiceJob) => void
}) {
  const pending = dispatches.filter((d) => d.job_type === "commissioning")
  const activeJobs = jobs
    .filter((j) => isCommissioningTestJob(j))
    .filter((j) => j.status !== "ปิดงาน" && j.status !== "ยกเลิก")

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-gray-900">รอรับจาก Stock — Commissioning Test</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          เครื่องที่รับเข้าเพื่อตรวจเช็คก่อนเข้าคลัง (ไม่ใช่งานสอบเทียบ Calibration) จะวิ่งมาที่แท็บนี้และ Service Request
        </p>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300 border border-dashed border-amber-200 rounded-3xl bg-amber-50/40">
            <Inbox className="h-12 w-12 mb-2 opacity-40" />
            <p className="text-sm text-gray-500">ไม่มีงาน Commissioning Test รอรับจาก Stock</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((d) => (
              <div key={d.id} className="bg-white rounded-3xl border border-amber-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="p-1.5 rounded-lg bg-amber-100">
                        <ClipboardCheck className="h-3.5 w-3.5 text-amber-700" />
                      </span>
                      <p className="font-bold text-gray-900">{d.item_name}</p>
                    </div>
                    <p className="font-mono text-xs text-amber-700 ml-8">SN: {d.serial_number}</p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">Commissioning Test</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><Building2 className="h-3 w-3" /> หน่วยงาน</p>
                    <p className="text-sm font-semibold text-gray-900">{d.customer_org}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><User className="h-3 w-3" /> ผู้ติดต่อ</p>
                    <p className="text-sm font-semibold text-gray-900">{d.customer_contact || "—"}</p>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 mb-4">
                  <p className="text-xs text-amber-800 mb-1 font-semibold">รายละเอียดการตรวจเช็ค</p>
                  <p className="text-sm text-gray-800">{d.symptom}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    ส่งโดย <span className="font-semibold text-gray-600">{d.dispatched_by}</span> · {d.dispatched_at}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAcceptDispatch(d)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" /> รับงาน
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-gray-900 mb-1">งาน Commissioning Test ที่กำลังดำเนินการ</h2>
        <p className="text-sm text-gray-500 mb-4">กดรายการเพื่อไปดูรายละเอียดในแท็บ &quot;งานทั้งหมด&quot;</p>
        {activeJobs.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center border border-gray-100 rounded-2xl">ไม่มีงานที่เปิดอยู่</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeJobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => onOpenJob(j)}
                className="text-left p-4 rounded-2xl border border-amber-100 bg-white hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-mono text-gray-500">{j.job_no}</p>
                <p className="font-bold text-sm text-gray-900 mt-1">{j.model}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">SN: {j.serial_number}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Pill label={j.status} color={STATUS_COLORS[j.status]} />
                  <span className="text-xs text-gray-400">{j.customer_org}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── From SE Tab ────────────────────────────────────────────────────────────────
function FromSETab({
  requests,
  onAccept,
}: {
  requests: SERequest[]
  onAccept: (r: SERequest) => void
}) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-300">
        <Users className="h-16 w-16 mb-3 opacity-30" />
        <p className="text-sm">ไม่มีคำขอจาก SE</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">คำขอบริการที่ทีม SE (Sales Engineering) ส่งมาให้ฝ่ายบริการ กรุณากด "รับงาน" เพื่อเพิ่มเข้าคิวหลัก</p>
      {requests.map(r => {
        const priorityColor = r.priority === "urgent" ? "bg-red-100 text-red-700" : r.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
        const priorityLabel = r.priority === "urgent" ? "เร่งด่วน" : r.priority === "high" ? "สำคัญ" : "ปกติ"
        return (
          <div key={r.id} className="bg-white rounded-3xl border border-violet-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-violet-100">
                    <Users className="h-3.5 w-3.5 text-violet-600" />
                  </span>
                  <p className="font-bold text-gray-900">{r.customer_org}</p>
                </div>
                <p className="text-xs text-gray-500 ml-8">{r.equipment}</p>
              </div>
              <Pill label={priorityLabel} color={priorityColor} />
            </div>
            <div className="p-3 bg-violet-50 rounded-2xl border border-violet-100 mb-4">
              <p className="text-xs text-violet-600 mb-1">รายละเอียดปัญหา</p>
              <p className="text-sm text-gray-800">{r.issue_description}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                ขอโดย <span className="font-semibold text-gray-600">{r.requested_by}</span> · {r.requested_at}
              </div>
              <button
                onClick={() => onAccept(r)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" /> รับงาน
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── From Repair Tab (Repair -> Cal requests) ───────────────────────────────
function FromRepairCalTab({
  requests,
  onAccept,
}: {
  requests: RepairToCalRequest[]
  onAccept: (r: RepairToCalRequest) => void
}) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-300">
        <FlaskConical className="h-16 w-16 mb-3 opacity-30" />
        <p className="text-sm">ไม่มีคำขอ Cal จากงานซ่อม</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        คำขอสอบเทียบที่ฝ่ายซ่อมส่งมา กรุณากด &quot;รับงาน&quot; เพื่อสร้าง Calibration job แยกต่างหาก
      </p>
      {requests.map((r) => (
        <div key={r.id} className="bg-white rounded-3xl border border-emerald-200 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 rounded-lg bg-emerald-100">
                  <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                </span>
                <p className="font-bold text-gray-900">{r.customer_org}</p>
              </div>
              <p className="text-xs text-gray-500 ml-8">
                Job ซ่อม: {r.source_job_no}
              </p>
            </div>
            <Pill
              label={r.priority === "urgent" ? "เร่งด่วน" : r.priority === "high" ? "สำคัญ" : "ปกติ"}
              color={
                r.priority === "urgent"
                  ? "bg-red-100 text-red-700"
                  : r.priority === "high"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-500"
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 mb-0.5">Equipment</p>
              <p className="text-sm font-semibold text-gray-900">{r.model}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">SN: {r.serial_number}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 mb-0.5">Routing</p>
              <p className="text-sm font-semibold text-gray-900">
                {r.routing === "overseas" ? "ต่างประเทศ" : "ในประเทศ"}
              </p>
              <p className="text-xs text-gray-500 mt-1">ผู้ติดต่อ: {r.customer_name}</p>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 mb-4">
            <p className="text-xs text-emerald-600 mb-1">อาการ/เหตุผลจาก Repair</p>
            <p className="text-sm text-gray-800">{r.symptom_reported}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              ขอเมื่อ <span className="font-semibold text-gray-600">{r.requested_at}</span>
            </div>
            <button
              onClick={() => onAccept(r)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> รับงาน
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceRequestPage() {
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [selected, setSelected] = useState<ServiceJob | null>(MOCK_JOBS[0])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all"|JobType>("all")
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด")
  const [showNew, setShowNew] = useState(false)
  const [showQuoteDialog, setShowQuoteDialog] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>("jobs")

  // Stock dispatches state
  const [stockDispatches, setStockDispatches] = useState<StockDispatch[]>([])
  // SE requests state
  const [seRequests, setSERequests] = useState<SERequest[]>([])
  // Calibration requests coming from Repair
  const [repairToCalRequests, setRepairToCalRequests] = useState<RepairToCalRequest[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [orgNames, setOrgNames] = useState<string[]>(MOCK_ORGS)
  const [statusFlow, setStatusFlow] = useState<ServiceJob["status"][]>(STATUS_FLOW)
  const [cancelDialogJob, setCancelDialogJob] = useState<ServiceJob | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelActionPlan, setCancelActionPlan] = useState("")

  useEffect(() => {
    const loadedJobs = readJobs(MOCK_JOBS)
    const loadedDispatches = readStockDispatches(MOCK_STOCK_DISPATCHES)
    setJobs(loadedJobs)
    setStockDispatches(loadedDispatches)
    setRepairToCalRequests(readRepairToCalRequests([]))
    setSERequests(readIncomingSERequests(MOCK_SE_REQUESTS))
    setSelected(loadedJobs[0] ?? null)
    setHydrated(true)

    const fallbackOrgs: ASOrganization[] = MOCK_ORGS.map((n, idx) => ({
      id: `seed-${idx}`,
      name: n,
      org_type: "New",
      org_format: "",
      province: "",
      region: "",
      health_district: 0,
      one_qa: false,
      contacts: [],
      created_at: new Date().toISOString(),
    }))
    const loadedOrgs = readOrganizations(fallbackOrgs)
    setOrgNames(loadedOrgs.map((o) => o.name))
    setStatusFlow(readASWorkflowSettings().service_statuses)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeJobs(jobs)
  }, [jobs, hydrated])

  useEffect(() => {
    if (!hydrated) return
    writeStockDispatches(stockDispatches)
  }, [stockDispatches, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const sync = () => {
      setStockDispatches(readStockDispatches([]))
      setJobs(readJobs([]))
      setRepairToCalRequests(readRepairToCalRequests([]))
      setSERequests(readIncomingSERequests(MOCK_SE_REQUESTS))
      setStatusFlow(readASWorkflowSettings().service_statuses)
    }
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    const timer = window.setInterval(sync, 1200)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
      window.clearInterval(timer)
    }
  }, [hydrated])

  const commissioningTabBadge = useMemo(() => {
    const pending = stockDispatches.filter((d) => d.job_type === "commissioning").length
    const open = jobs.filter(
      (j) => isCommissioningTestJob(j) && j.status !== "ปิดงาน" && j.status !== "ยกเลิก",
    ).length
    return pending + open
  }, [stockDispatches, jobs])

  const totalIncoming = stockDispatches.length + seRequests.length + repairToCalRequests.length

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    return (j.job_no.toLowerCase().includes(q) || j.model.toLowerCase().includes(q) || j.serial_number.toLowerCase().includes(q) || j.customer_org.toLowerCase().includes(q)) &&
      (filterType === "all" || j.job_type === filterType) &&
      (filterStatus === "ทั้งหมด" || j.status === filterStatus)
  })
  const overdueCount = useMemo(() => jobs.filter((j) => getSlaState(j) === "overdue").length, [jobs])
  const warningCount = useMemo(() => jobs.filter((j) => getSlaState(j) === "warning").length, [jobs])
  const calibrationAlertCount = useMemo(
    () => jobs.filter((j) => getCalibrationAlertLevel(j) !== "none").length,
    [jobs],
  )

  function updateSelected(patch: Partial<ServiceJob>) {
    if (!selected) return
    const updated = { ...selected, ...patch }
    setJobs((prev) => prev.map((j) => (j.id === selected.id ? updated : j)))
    setSelected(updated)
  }

  function cancelJob(job: ServiceJob, reason: string, actionPlan: string) {
    if (!reason?.trim() || !actionPlan?.trim()) return
    const updated: ServiceJob = {
      ...job,
      status: "ยกเลิก",
      cancellation_reason: reason.trim(),
      cancellation_action_plan: actionPlan.trim(),
      status_logs: [
        ...(job.status_logs || []),
        {
          at: new Date().toISOString(),
          from: job.status,
          to: "ยกเลิก",
          reason: `${reason.trim()} | Action Plan: ${actionPlan.trim()}`,
        },
      ],
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)))
    setSelected(updated)
  }

  function canAdvance(job: ServiceJob) {
    if (isCommissioningTestJob(job)) return job.status !== "ปิดงาน" && job.status !== "ยกเลิก"
    return !getTransitionBlockReason(job)
  }

  function getJobFlow(job: ServiceJob) {
    if (isCommissioningTestJob(job)) return COMMISSIONING_STATUS_FLOW
    return statusFlow.length > 0 ? statusFlow : STATUS_FLOW
  }

  function advanceStatus(job: ServiceJob) {
    if (!canAdvance(job)) return
    const flow = getJobFlow(job)
    const idx = flow.indexOf(job.status)
    if (idx < flow.length - 1) {
      const next = flow[idx + 1]
      const skip = !isCommissioningTestJob(job) && next === "รอ Quotation Approve" && !job.requires_approval
      const actualNext: ServiceJob["status"] = skip ? (flow[idx + 2] ?? next) : next
      const stockCloseExtras: Partial<ServiceJob> =
        actualNext === "ปิดงาน" && job.source === "stock"
          ? { stock_return_pending: true }
          : {}
      const updated: ServiceJob = {
        ...job,
        ...stockCloseExtras,
        status: actualNext,
        status_logs: [
          ...(job.status_logs || []),
          {
            at: new Date().toISOString(),
            from: job.status,
            to: actualNext,
            ...(actualNext === "ปิดงาน" && job.source === "stock"
              ? { reason: "ปิดงานโดย Service — รอ Stock รับเข้าคลัง" }
              : {}),
          },
        ],
      }
      setJobs(prev => prev.map(j => j.id === job.id ? updated : j))
      setSelected(updated)
    }
  }

  // Accept dispatched job from Stock → create a new ServiceJob
  function acceptStockDispatch(d: StockDispatch) {
    const liveDispatches = readStockDispatches([])
    const stillPending = liveDispatches.some((x) => x.id === d.id)
    if (!stillPending) return
    const liveJobs = readJobs([])
    const alreadyAccepted = liveJobs.some(
      (j) => j.source === "stock" && j.source_dispatch_id === d.id,
    )
    if (alreadyAccepted) {
      writeStockDispatches(liveDispatches.filter((x) => x.id !== d.id))
      setStockDispatches((prev) => prev.filter((x) => x.id !== d.id))
      return
    }

    const count = Math.floor(Math.random() * 900) + 100
    const newJob: ServiceJob = {
      id: Date.now().toString(),
      job_no: `JOB-2024-0${count}`,
      job_type: d.job_type,
      status: "รอประเมิน",
      priority: "normal",
      serial_number: d.serial_number,
      manufacturer: d.manufacturer || "—",
      model: d.model || d.item_name,
      received_date: new Date().toISOString().split("T")[0],
      tracking_in: "—",
      receive_channel: "พนักงาน",
      customer_name: d.customer_contact,
      customer_org: d.customer_org,
      routing: (d.routing || "in_country") as Routing,
      symptom_reported: d.symptom,
      requires_approval: true,
      source: "stock",
      source_dispatch_id: d.id,
      stock_item_id: d.stock_item_id,
      due_date: d.due_date,
      status_logs: [{ at: new Date().toISOString(), to: "รอประเมิน", reason: `Accepted from Stock (${d.id})` }],
      created_at: new Date().toISOString().split("T")[0],
    }
    const nextJobs = [newJob, ...jobs]
    const nextDispatches = stockDispatches.filter((x) => x.id !== d.id)
    const nowIso = new Date().toISOString()
    appendStockDispatchHistory({
      dispatch_id: d.id,
      stock_item_id: d.stock_item_id,
      item_name: d.item_name,
      manufacturer: d.manufacturer,
      model: d.model,
      serial_number: d.serial_number,
      customer_org: d.customer_org,
      customer_contact: d.customer_contact,
      symptom: d.symptom,
      job_type: d.job_type,
      routing: d.routing,
      due_date: d.due_date,
      dispatched_by: d.dispatched_by,
      dispatched_at: d.dispatched_at,
      accepted_at: nowIso,
      service_job_id: newJob.id,
      service_job_no: newJob.job_no,
    })
    // Persist both sides immediately to avoid race with polling/event sync.
    writeJobs(nextJobs)
    writeStockDispatches(nextDispatches)
    setJobs(nextJobs)
    setStockDispatches(nextDispatches)
    setSearch("")
    setFilterType("all")
    setFilterStatus("ทั้งหมด")
    setSelected(newJob)
    setMainTab("jobs")
    const orgs = readOrganizations([])
    writeOrganizations(upsertOrganizationByName(orgs, d.customer_org, d.customer_contact))
  }

  // Accept SE request → create a new ServiceJob
  function acceptSERequest(r: SERequest) {
    const liveJobs = readJobs([])
    const alreadyAccepted = liveJobs.some(
      (j) => j.source === "se" && j.source_dispatch_id === r.id,
    )
    if (alreadyAccepted) {
      setSERequests((prev) => prev.filter((x) => x.id !== r.id))
      removeIncomingSERequest(r.id)
      return
    }

    const count = Math.floor(Math.random() * 900) + 100
    const newJob: ServiceJob = {
      id: Date.now().toString(),
      job_no: `JOB-2024-0${count}`,
      job_type: "repair",
      status: "รอประเมิน",
      priority: r.priority,
      serial_number: r.equipment.includes("SN:") ? r.equipment.split("SN:")[1].trim() : "—",
      manufacturer: "—",
      model: r.equipment.split("—")[0].trim(),
      received_date: new Date().toISOString().split("T")[0],
      tracking_in: "—",
      receive_channel: "พนักงาน",
      customer_name: r.requested_by,
      customer_org: r.customer_org,
      routing: "in_country",
      symptom_reported: r.issue_description,
      requires_approval: true,
      source: "se",
      source_dispatch_id: r.id,
      created_at: new Date().toISOString().split("T")[0],
    }
    const nextJobs = [newJob, ...jobs]
    writeJobs(nextJobs)
    setJobs(nextJobs)
    setSERequests(prev => prev.filter(x => x.id !== r.id))
    removeIncomingSERequest(r.id)
    setSearch("")
    setFilterType("all")
    setFilterStatus("ทั้งหมด")
    setSelected(newJob)
    setMainTab("jobs")
    const orgs = readOrganizations([])
    writeOrganizations(upsertOrganizationByName(orgs, r.customer_org, r.requested_by))
  }

  // When a Repair job finishes and wants to send to Calibration (Cal team),
  // create an intermediate request inbox (no Calibration job is created yet).
  function requestCalibrationFromRepair(job: ServiceJob) {
    const today = new Date().toISOString().split("T")[0]
    const existing = readRepairToCalRequests([]).find((r) => r.source_job_id === job.id)
    if (existing) return

    const req: RepairToCalRequest = {
      id: `rc-${Date.now()}`,
      source_job_id: job.id,
      source_job_no: job.job_no,
      serial_number: job.serial_number,
      manufacturer: job.manufacturer,
      model: job.model,
      customer_org: job.customer_org,
      customer_name: job.customer_name,
      routing: job.routing,
      priority: job.priority,
      symptom_reported: job.symptom_reported,
      requested_at: today,
      created_at: new Date().toISOString(),
    }

    appendRepairToCalRequest(req)
    setRepairToCalRequests((prev) => [req, ...prev])
  }

  function acceptRepairToCalRequest(req: RepairToCalRequest) {
    const liveJobs = readJobs([])
    const alreadyAccepted = liveJobs.some(
      (j) => j.job_type === "calibration" && j.source_dispatch_id === req.id,
    )
    if (alreadyAccepted) {
      setRepairToCalRequests((prev) => prev.filter((r) => r.id !== req.id))
      removeRepairToCalRequest(req.id)
      return
    }

    const today = new Date().toISOString().split("T")[0]
    const count = Math.floor(Math.random() * 900) + 100
    const newJob: ServiceJob = {
      id: Date.now().toString(),
      job_no: `JOB-2024-0${count}`,
      job_type: "calibration",
      status: "รอประเมิน",
      priority: req.priority,
      serial_number: req.serial_number,
      manufacturer: req.manufacturer,
      model: req.model,
      received_date: today,
      tracking_in: "—",
      receive_channel: "พนักงาน",
      customer_name: req.customer_name,
      customer_org: req.customer_org,
      routing: req.routing,
      symptom_reported: `จากงานซ่อม ${req.source_job_no}: ${req.symptom_reported}`,
      requires_approval: true,
      source: "manual",
      source_dispatch_id: req.id,
      created_at: new Date().toISOString().split("T")[0],
    }

    const nextJobs = [newJob, ...jobs]
    writeJobs(nextJobs)
    setJobs(nextJobs)
    setRepairToCalRequests((prev) => prev.filter((r) => r.id !== req.id))
    removeRepairToCalRequest(req.id)
    setSearch("")
    setFilterType("all")
    setFilterStatus("ทั้งหมด")
    setSelected(newJob)
    setMainTab("jobs")
  }

  const sel = selected
  const selectedFlow = sel ? getJobFlow(sel) : (statusFlow.length > 0 ? statusFlow : STATUS_FLOW)
  const proactiveId = searchParams.get("proactive_id")

  useEffect(() => {
    if (!proactiveId || jobs.length === 0) return
    const target = jobs.find((j) => j.source === "proactive" && j.source_dispatch_id === proactiveId)
    if (!target) return
    setSelected(target)
    setMainTab("jobs")
  }, [proactiveId, jobs])

  const MAIN_TABS: { id: MainTab; label: string; badge?: number }[] = [
    { id: "jobs", label: "งานทั้งหมด" },
    { id: "commissioning", label: "Commissioning Test", badge: commissioningTabBadge },
    { id: "from_stock", label: "รับงานจาก Stock", badge: stockDispatches.length },
    { id: "from_se", label: "คำขอจาก SE", badge: seRequests.length },
    { id: "from_repair_cal", label: "คำขอ Cal จาก Repair", badge: repairToCalRequests.length },
  ]

  return (
    <div className="h-full flex flex-col relative z-10 p-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">งาน Repair, Calibration & Commissioning Test</h1>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} งานทั้งหมด · {jobs.filter(j=>j.status!=="ปิดงาน").length} งานที่ยังเปิดอยู่</p>
        </div>
        <button onClick={() => setShowNew(true)} className="modern-button-primary premium-glow rounded-2xl">
          <Plus className="h-4 w-4" /> สร้างงานใหม่
        </button>
      </div>

      {/* Notification Banner */}
      {(totalIncoming > 0 || commissioningTabBadge > 0 || overdueCount > 0 || warningCount > 0 || calibrationAlertCount > 0) && (
        <div className="glass-panel flex items-center gap-3 p-4 rounded-2xl mb-4">
          <Bell className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 font-semibold flex-1">
            {totalIncoming > 0 && (
              <>
                มีงานใหม่รอรับ:
                {stockDispatches.length > 0 && <span className="text-orange-600">{stockDispatches.length} งานจาก Stock</span>}
                {stockDispatches.length > 0 && seRequests.length > 0 && " · "}
                {seRequests.length > 0 && <span className="text-violet-600">{seRequests.length} คำขอจาก SE</span>}
                {(stockDispatches.length > 0 || seRequests.length > 0) && repairToCalRequests.length > 0 && " · "}
                {repairToCalRequests.length > 0 && <span className="text-emerald-600">{repairToCalRequests.length} คำขอ Cal จาก Repair</span>}
              </>
            )}
            {commissioningTabBadge > 0 && (
              <>
                {totalIncoming > 0 && " · "}
                <span className="text-amber-800">{commissioningTabBadge} Commissioning Test (รับเข้า/ดำเนินการ)</span>
              </>
            )}
            {(totalIncoming > 0 || commissioningTabBadge > 0) && (overdueCount > 0 || warningCount > 0 || calibrationAlertCount > 0) && " · "}
            {overdueCount > 0 && <span className="text-red-600">{overdueCount} งานเกิน SLA</span>}
            {overdueCount > 0 && warningCount > 0 && " · "}
            {warningCount > 0 && <span className="text-orange-600">{warningCount} งานใกล้ชน SLA</span>}
            {(overdueCount > 0 || warningCount > 0) && calibrationAlertCount > 0 && " · "}
            {calibrationAlertCount > 0 && <span className="text-teal-600">{calibrationAlertCount} Calibration แจ้งเตือน</span>}
          </p>
          <div className="flex gap-2 shrink-0">
            {stockDispatches.length > 0 && (
              <button onClick={() => setMainTab("from_stock")} className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors">
                ดูงาน Stock
              </button>
            )}
            {seRequests.length > 0 && (
              <button onClick={() => setMainTab("from_se")} className="px-3 py-1.5 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600 transition-colors">
                ดูคำขอ SE
              </button>
            )}
            {repairToCalRequests.length > 0 && (
              <button
                onClick={() => setMainTab("from_repair_cal")}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
              >
                ดูคำขอ Cal
              </button>
            )}
            {commissioningTabBadge > 0 && (
              <button
                type="button"
                onClick={() => setMainTab("commissioning")}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors"
              >
                Commissioning Test
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-1 p-1 glass-panel rounded-2xl mb-5 w-fit">
        {MAIN_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id)}
            data-active={mainTab === t.id}
            className={`tab-premium relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mainTab === t.id ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Jobs ── */}
      {mainTab === "jobs" && (
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Left */}
          <div className="w-80 shrink-0 flex flex-col gap-3 glass-panel rounded-3xl p-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-white/70 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-white/70 backdrop-blur" placeholder="ค้นหา job / model / SN" />
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {([["all","ทั้งหมด"],["repair","Repair"],["calibration","Cal"],["commissioning","Comm. Test"]] as ["all"|JobType, string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setFilterType(v)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType===v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{l}</button>
              ))}
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>ทั้งหมด</option>
              {statusFlow.map(s=><option key={s}>{s}</option>)}
            </select>
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {filtered.length === 0
                ? (
                  <div className="py-10 space-y-2">
                    <div className="skeleton-premium h-4 w-3/4 mx-auto" />
                    <div className="skeleton-premium h-4 w-2/3 mx-auto" />
                    <p className="text-center text-sm text-gray-400 pt-2">ไม่พบงาน</p>
                  </div>
                )
                : filtered.map(j=><JobCard key={j.id} job={j} selected={sel?.id===j.id} onClick={()=>setSelected(j)} />)
              }
            </div>
          </div>

          {/* Right — Detail */}
          {sel ? (
            <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
              {/* Header */}
              <div className="glass-card rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                        isCommissioningTestJob(sel)
                          ? "bg-amber-100 text-amber-900"
                          : sel.job_type==="repair"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-teal-100 text-teal-700"
                      }`}>
                        {isCommissioningTestJob(sel) ? (
                          <><ClipboardCheck className="h-3.5 w-3.5" /> Commissioning Test</>
                        ) : sel.job_type==="repair" ? (
                          <><Wrench className="h-3.5 w-3.5" /> Repair</>
                        ) : (
                          <><FlaskConical className="h-3.5 w-3.5" /> Calibration</>
                        )}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${sel.priority==="urgent" ? "bg-red-100 text-red-700" : sel.priority==="high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                        {sel.priority==="urgent" ? "⚡ เร่งด่วน" : sel.priority==="high" ? "↑ สำคัญ" : "ปกติ"}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-500 mb-1">{sel.job_no}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-3 py-1.5 rounded-2xl text-sm font-bold ${STATUS_COLORS[sel.status]}`}>{sel.status}</span>
                      <span className={`inline-flex px-2.5 py-1 rounded-xl text-xs font-semibold ${
                        getSlaState(sel) === "overdue"
                          ? "bg-red-100 text-red-700"
                          : getSlaState(sel) === "warning"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}>
                        SLA: {getSlaState(sel) === "overdue" ? "Overdue" : getSlaState(sel) === "warning" ? "Warning" : "On Track"}
                      </span>
                    </div>
                  </div>
                  {sel.status !== "ปิดงาน" && sel.status !== "ยกเลิก" && (
                    <div className="space-y-1 flex flex-col items-end">
                      <button
                        onClick={()=>advanceStatus(sel)}
                        disabled={!canAdvance(sel)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 enabled:hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-2xl text-sm font-semibold transition-colors"
                      >
                        เปลี่ยนสถานะ <ChevronRight className="h-4 w-4" />
                      </button>
                      {!canAdvance(sel) && !isCommissioningTestJob(sel) && (
                        <p className="text-xs text-red-500 text-right">{getTransitionBlockReason(sel)}</p>
                      )}
                      <button
                        onClick={() => {
                          setCancelReason(sel.cancellation_reason || "")
                          setCancelActionPlan(sel.cancellation_action_plan || "")
                          setCancelDialogJob(sel)
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                      >
                        ยกเลิกงาน
                      </button>
                    </div>
                  )}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-1">
                  {selectedFlow.map((s,i) => {
                    const cur = selectedFlow.indexOf(sel.status)
                    return <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i <= cur ? "bg-gradient-to-r from-sky-500 to-violet-500 premium-pulse" : "bg-gray-200"}`} title={s} />
                  })}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">เริ่ม</span>
                  <span className="text-xs text-gray-400">ปิดงาน</span>
                </div>
              </div>

              {/* Equipment Card */}
              <div className="glass-card rounded-3xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Equipment</p>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200">
                    <Wrench className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xl font-black text-gray-900">{sel.model}</p>
                    <p className="text-sm text-gray-500">{sel.manufacturer}</p>
                    <p className="font-mono text-sm font-bold text-blue-600 mt-1">SN: {sel.serial_number}</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${sel.routing==="overseas" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                      {sel.routing==="overseas" ? "✈️ ต่างประเทศ" : "🇹🇭 ในประเทศ"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">วันที่รับ</p>
                    <p className="text-sm font-bold">{sel.received_date}</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">ช่องทาง</p>
                    <p className="text-sm font-bold">{sel.receive_channel}</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">Tracking (เข้า)</p>
                    <p className="text-sm font-bold font-mono">{sel.tracking_in || "—"}</p>
                  </div>
                </div>
                {sel.routing==="overseas" && sel.rma_code && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-2xl flex items-center gap-2">
                    <Hash className="h-4 w-4 text-orange-500" />
                    <div><p className="text-xs text-orange-600">RMA Code</p><p className="font-bold font-mono text-orange-800">{sel.rma_code}</p></div>
                  </div>
                )}
                {sel.job_type==="calibration" && sel.routing==="in_country" && sel.lab_name && (
                  <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-teal-500" />
                    <div><p className="text-xs text-teal-600">ส่ง Lab</p><p className="font-bold text-teal-800">{sel.lab_name}</p></div>
                  </div>
                )}
              </div>

              {/* Customer */}
              <div className="glass-card rounded-3xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">ลูกค้า</p>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><Building2 className="h-4 w-4 text-blue-600" /></div>
                  <div>
                    <p className="font-bold text-gray-900">{sel.customer_org}</p>
                    {sel.customer_name && <p className="text-sm text-gray-500">{sel.customer_name}</p>}
                  </div>
                </div>
              </div>

              {/* Symptom & Fix */}
              <div className="glass-card rounded-3xl p-6 space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">อาการ & การแก้ไข</p>
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                  <p className="text-xs text-red-500 mb-1">อาการที่ลูกค้าแจ้ง</p>
                  <p className="text-sm text-gray-900">{sel.symptom_reported}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${sel.symptom_actual ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-200"}`}>
                  <p className="text-xs text-gray-500 mb-1">ผลการวิเคราะห์</p>
                  <textarea
                    value={sel.symptom_actual || ""}
                    onChange={(e) => updateSelected({ symptom_actual: e.target.value })}
                    rows={2}
                    placeholder="กรอกผลการวิเคราะห์"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  />
                </div>
                <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                  <p className="text-xs text-green-600 mb-1">วิธีแก้ไข</p>
                  <textarea
                    value={sel.fix_method || ""}
                    onChange={(e) => updateSelected({ fix_method: e.target.value })}
                    rows={2}
                    placeholder="กรอกวิธีแก้ไข"
                    className="w-full px-3 py-2 rounded-xl border border-green-200 text-sm bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={sel.technician || ""}
                    onChange={(e) => updateSelected({ technician: e.target.value })}
                    placeholder="ผู้รับผิดชอบ / Technician"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  />
                  <input
                    value={sel.customer_name || ""}
                    onChange={(e) => updateSelected({ customer_name: e.target.value })}
                    placeholder="ผู้ติดต่อลูกค้า"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  />
                </div>
              </div>
              {sel.cancellation_reason && (
                <div className="glass-card rounded-3xl p-6 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">ยกเลิกงาน</p>
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    เหตุผล: {sel.cancellation_reason}
                  </p>
                  {sel.cancellation_action_plan && (
                    <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      Action Plan: {sel.cancellation_action_plan}
                    </p>
                  )}
                </div>
              )}
              {sel.status_logs && sel.status_logs.length > 0 && (
                <div className="glass-card rounded-3xl p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Status Log</p>
                  <div className="space-y-2 max-h-[220px] overflow-auto">
                    {sel.status_logs.slice().reverse().map((log, idx) => (
                      <div key={`${log.at}-${idx}`} className="text-xs text-gray-600 border border-gray-100 rounded-xl px-3 py-2">
                        <span className="font-semibold">{formatThDateTime(log.at)}</span>
                        {" · "}
                        {log.from || "—"} {"->"} {log.to}
                        {log.reason ? ` · ${log.reason}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sel.job_type === "repair" && sel.status === "รอส่งคืน" && !repairToCalRequests.some((r) => r.source_job_id === sel.id) && (
                <div className="glass-card rounded-3xl p-6 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">ขอสอบเทียบเพิ่มเติม</p>
                  <p className="text-sm text-gray-600">
                    สร้างคำขอให้ฝ่าย Calibration (Cal team) รับงาน แล้วค่อยสร้าง job แยกต่างหาก
                  </p>
                  <button
                    onClick={() => requestCalibrationFromRepair(sel)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold transition-all"
                  >
                    <FlaskConical className="h-4 w-4" /> Request ไปฝ่าย Cal
                  </button>
                </div>
              )}

              {/* Quotation */}
              {!isCommissioningTestJob(sel) && STATUS_FLOW.indexOf(sel.status) >= STATUS_FLOW.indexOf("รอ Quotation Approve") && (
                <div className="glass-card rounded-3xl p-6 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Quotation</p>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${sel.quotation_approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {sel.quotation_approved ? "✓ Approved" : "⏳ รอ Approve"}
                    </div>
                    {!sel.requires_approval && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">ข้ามการ Approve</span>}
                  </div>
                  {sel.po_number && (
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <div><p className="text-xs text-blue-500">PO Number</p><p className="font-bold font-mono text-blue-800">{sel.po_number}</p></div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateSelected({ quotation_approved: !sel.quotation_approved })}
                      className={`py-2.5 rounded-xl text-sm font-semibold border ${
                        sel.quotation_approved ? "bg-green-50 border-green-200 text-green-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"
                      }`}
                    >
                      {sel.quotation_approved ? "Approved แล้ว" : "รออนุมัติ"}
                    </button>
                    <input
                      value={sel.po_number || ""}
                      onChange={(e) => updateSelected({ po_number: e.target.value })}
                      placeholder="กรอก PO Number"
                      className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                    />
                  </div>
                  <button onClick={()=>setShowQuoteDialog(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold transition-all">
                    <FileText className="h-4 w-4" /> สร้าง Draft Quotation
                  </button>
                </div>
              )}

              {sel.job_type === "calibration" && !isCommissioningTestJob(sel) && (
                <div className="glass-card rounded-3xl p-6 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Calibration Certificate</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={sel.calibration_date || ""}
                      onChange={(e) => updateSelected({ calibration_date: e.target.value, due_date: addOneYear(e.target.value) })}
                      className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                    />
                    <input
                      value={sel.due_date || ""}
                      readOnly
                      placeholder="Due date (+1 ปี)"
                      className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Close */}
              {selectedFlow.indexOf(sel.status) >= selectedFlow.indexOf("รอส่งคืน") && (
                <div className="glass-card rounded-3xl p-6 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">ปิดงาน</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 rounded-2xl space-y-1">
                      <p className="text-xs text-gray-400 mb-0.5">Tracking (ออก)</p>
                      <input value={sel.tracking_out || ""} onChange={(e)=>updateSelected({ tracking_out: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono" />
                    </div>
                    <div className="p-3 bg-gray-50 rounded-2xl space-y-1">
                      <p className="text-xs text-gray-400 mb-0.5">Invoice No.</p>
                      <input value={sel.invoice_no || ""} onChange={(e)=>updateSelected({ invoice_no: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                    </div>
                    <div className="p-3 bg-gray-50 rounded-2xl space-y-1">
                      <p className="text-xs text-gray-400 mb-0.5">Warranty</p>
                      <input value={sel.warranty_days || ""} onChange={(e)=>updateSelected({ warranty_days: e.target.value })} placeholder="จำนวนวัน" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
                    </div>
                  </div>
                  {sel.status === "ปิดงาน" &&
                    (sel.source === "stock" && sel.stock_return_pending ? (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-200">
                        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900">รอ Stock รับเข้าคลัง</p>
                          <p className="text-xs text-amber-800 mt-1">
                            งานปิดทาง Service แล้ว — ฝ่ายคลังต้องกดยืนยันรับสินค้าเพื่อสถานะพร้อมจำหน่าย (หน้า Stock)
                          </p>
                        </div>
                      </div>
                    ) : sel.source === "stock" && sel.stock_return_received_at ? (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <p className="text-sm font-bold text-emerald-800">
                          Stock รับเข้าคลังแล้ว ({formatThDateTime(sel.stock_return_received_at)})
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-2xl border border-green-200">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <p className="text-sm font-bold text-green-800">งานปิดแล้ว</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-300">
              <div className="text-center"><Wrench className="h-16 w-16 mx-auto mb-3 opacity-20" /><p className="text-sm">เลือกงานเพื่อดูรายละเอียด</p></div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Commissioning Test ── */}
      {mainTab === "commissioning" && (
        <div className="flex-1 overflow-y-auto">
          <CommissioningWorkTab
            dispatches={stockDispatches}
            jobs={jobs}
            onAcceptDispatch={acceptStockDispatch}
            onOpenJob={(j) => {
              setSelected(j)
              setMainTab("jobs")
              setFilterType("commissioning")
              setSearch("")
              setFilterStatus("ทั้งหมด")
            }}
          />
        </div>
      )}

      {/* ── Tab: From Stock ── */}
      {mainTab === "from_stock" && (
        <div className="flex-1 overflow-y-auto">
          <FromStockTab dispatches={stockDispatches} onAccept={acceptStockDispatch} />
        </div>
      )}

      {/* ── Tab: From Repair ── */}
      {mainTab === "from_repair_cal" && (
        <div className="flex-1 overflow-y-auto">
          <FromRepairCalTab requests={repairToCalRequests} onAccept={acceptRepairToCalRequest} />
        </div>
      )}

      {/* ── Tab: From SE ── */}
      {mainTab === "from_se" && (
        <div className="flex-1 overflow-y-auto">
          <FromSETab requests={seRequests} onAccept={acceptSERequest} />
        </div>
      )}

      {showNew && <NewJobDialog orgNames={orgNames} onClose={()=>setShowNew(false)} onSave={j=>{
        setJobs(p=>[{ ...j, source: "manual" },...p]);setSelected(j);setMainTab("jobs")
        const orgs = readOrganizations([])
        writeOrganizations(upsertOrganizationByName(orgs, j.customer_org, j.customer_name))
      }} />}
      {showQuoteDialog && sel && <QuotationDraftDialog job={sel} onClose={()=>setShowQuoteDialog(false)} />}
      {cancelDialogJob && (
        <CancelJobDialog
          job={cancelDialogJob}
          reason={cancelReason}
          actionPlan={cancelActionPlan}
          onReasonChange={setCancelReason}
          onActionPlanChange={setCancelActionPlan}
          onClose={() => {
            setCancelDialogJob(null)
            setCancelActionPlan("")
          }}
          onConfirm={() => {
            cancelJob(cancelDialogJob, cancelReason, cancelActionPlan)
            setCancelDialogJob(null)
            setCancelActionPlan("")
          }}
        />
      )}
    </div>
  )
}
