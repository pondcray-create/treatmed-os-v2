"use client"

import { useState } from "react"
import { Search, Plus, ChevronRight, X, Wrench, FlaskConical, Clock, CheckCircle2, Copy, Check, Building2, User, Hash, FileText, Trash2, Bell, Inbox, Users, PackageCheck, PackageX, ClipboardCheck } from "lucide-react"
import { setNotificationCounts, getNotificationCounts, decrementServiceRequest, decrementInspection } from "@/lib/notificationStore"

type JobType = "repair" | "calibration"
type JobStatus = "รอประเมิน" | "กำลังประเมิน" | "รอ Quotation Approve" | "รอ PO" | "ในคิว" | "กำลังซ่อม" | "รออะไหล่" | "QC" | "รอส่งคืน" | "ปิดงาน"
type Priority = "urgent" | "high" | "normal"
type Routing = "in_country" | "overseas"
type MainTab = "jobs" | "inspection" | "from_stock" | "from_se"
type InspectionStatus = "pending" | "inspecting" | "approved" | "rejected"

interface ServiceJob {
  id: string; job_no: string; job_type: JobType; status: JobStatus; priority: Priority
  serial_number: string; manufacturer: string; model: string
  received_date: string; tracking_in: string; receive_channel: "พนักงาน" | "ขนส่งเอกชน"
  customer_name: string; customer_org: string
  routing: Routing; rma_code?: string; lab_name?: string
  symptom_reported: string; symptom_actual?: string; fix_method?: string
  requires_approval: boolean; quotation_approved?: boolean; po_number?: string
  tracking_out?: string; invoice_no?: string; warranty_days?: string
  technician?: string; created_at: string
}

interface StockDispatch {
  id: string; item_name: string; serial_number: string
  customer_org: string; customer_contact: string; symptom: string
  job_type: "repair" | "calibration"; dispatched_by: string; dispatched_at: string
}

interface SERequest {
  id: string; customer_org: string; equipment: string
  issue_description: string; requested_by: string; requested_at: string; priority: Priority
}

// ── New: Inspection Request from Stock (New Machine) ─────────────────────────
interface NewMachineInspection {
  id: string
  item_name: string
  model: string
  serial_number: string
  po_number: string
  supplier: string
  sent_by: string        // Stock staff name
  sent_at: string
  has_al_case: boolean
  parent_sn?: string     // Parent SN if child (e.g. IDA6 module)
  notes?: string
  status: InspectionStatus
  result_notes?: string
}

const MOCK_ORGS = [
  "โรงพยาบาลศิริราช","โรงพยาบาลกรุงเทพ","โรงพยาบาลมหาราชนครเชียงใหม่",
  "โรงพยาบาลขอนแก่น","โรงพยาบาลสมิติเวช","โรงพยาบาลบำรุงราษฎร์",
  "โรงพยาบาลรามาธิบดี","โรงพยาบาลจุฬาลงกรณ์","โรงพยาบาลพระมงกุฎเกล้า","โรงพยาบาลนครพิงค์",
]

const STATUS_FLOW: JobStatus[] = ["รอประเมิน","กำลังประเมิน","รอ Quotation Approve","รอ PO","ในคิว","กำลังซ่อม","รออะไหล่","QC","รอส่งคืน","ปิดงาน"]

const STATUS_COLORS: Record<JobStatus, string> = {
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

const MOCK_STOCK_DISPATCHES: StockDispatch[] = [
  { id:"sd1", item_name:"ProSim 8 + SPOT Module", serial_number:"PS8-2024-NEW-001",
    customer_org:"โรงพยาบาลรามาธิบดี", customer_contact:"นายสมชาย วงศ์ดี",
    symptom:"เครื่องรับมาจาก Sales พบว่า Firmware ล้าสมัย ต้องอัปเดตและทดสอบ",
    job_type:"repair", dispatched_by:"Stock สมชาย", dispatched_at:"2024-03-18" },
  { id:"sd2", item_name:"RaySafe X2 Solo", serial_number:"X2S-2024-001",
    customer_org:"โรงพยาบาลสมิติเวช", customer_contact:"นางสาวพิมลพรรณ รักดี",
    symptom:"ส่งสอบเทียบประจำปี ก่อนส่งมอบให้ลูกค้า",
    job_type:"calibration", dispatched_by:"Stock สมชาย", dispatched_at:"2024-03-19" },
]

const MOCK_SE_REQUESTS: SERequest[] = [
  { id:"se1", customer_org:"โรงพยาบาลบำรุงราษฎร์",
    equipment:"ESA 615 — SN: ESA615-DEMO-001",
    issue_description:"ลูกค้าแจ้งว่าเครื่อง Demo ที่ยืมไปมีปัญหาการวัดค่า Leakage current ผิดพลาด ต้องการให้ทีมช่างตรวจสอบก่อนจะตัดสินใจซื้อ",
    requested_by:"คุณวิภาพร (SE)", requested_at:"2024-03-17", priority:"high" },
  { id:"se2", customer_org:"โรงพยาบาลจุฬาลงกรณ์",
    equipment:"ProSim 4 — SN: PS4-DEMO-002",
    issue_description:"ลูกค้าต้องการสอบเทียบ ProSim 4 ตัว Demo ที่ทางโรงพยาบาลใช้อยู่ เพื่อนำผลสอบเทียบไปใช้ประกอบการขอ Budget",
    requested_by:"คุณธนากร (SE)", requested_at:"2024-03-20", priority:"normal" },
]

// ── Mock: New machine inspection requests from Stock ──────────────────────────
const MOCK_INSPECTIONS: NewMachineInspection[] = [
  { id:"insp1", item_name:"ProSim 8 (สต็อกใหม่)", model:"ProSim 8", serial_number:"PS8-2024-STOCK-003",
    po_number:"PO-2024-112", supplier:"Fluke Biomedical Asia",
    sent_by:"Stock วิชัย", sent_at:"2024-03-19",
    has_al_case:true, status:"pending",
    notes:"เครื่องมาพร้อมกล่อง Al และสายเชื่อมต่อ รบกวนตรวจ Functional test ก่อนตัดเข้า Stock" },
  { id:"insp2", item_name:"IDA 6 (4ch) ใหม่", model:"IDA 6 (4ch)", serial_number:"IDA6-2024-NEW-002",
    po_number:"PO-2024-098", supplier:"Fluke Biomedical Singapore",
    sent_by:"Stock วิชัย", sent_at:"2024-03-20",
    has_al_case:false, status:"inspecting",
    parent_sn:"IDA6-DISPLAY-2024-001",
    notes:"IDA6 module ใหม่ ผูกกับ Display SN: IDA6-DISPLAY-2024-001" },
]

const LABS = ["สถาบันมาตรวิทยาแห่งชาติ (NIMT)","สถาบันเทคโนโลยีไทย-ญี่ปุ่น (TNI)","มจธ. ศูนย์บริการวิทยาศาสตร์","อื่นๆ"]
const MANUFACTURERS = ["Fluke Biomedical","RaySafe","Fluke General","IMT Analytics","Omega","Testo","Other"]

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

function JobCard({ job, selected, onClick }: { job: ServiceJob; selected: boolean; onClick: () => void }) {
  const priorityColor = job.priority === "urgent" ? "bg-red-100 text-red-700" : job.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-2xl border transition-all ${selected ? "bg-blue-50 border-blue-300 shadow-sm" : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`p-1 rounded-lg ${job.job_type === "repair" ? "bg-blue-100" : "bg-teal-100"}`}>
            {job.job_type === "repair" ? <Wrench className="h-3 w-3 text-blue-600" /> : <FlaskConical className="h-3 w-3 text-teal-600" />}
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

function OrgSelect({ value, onChange, required, className }: { value: string; onChange: (v: string) => void; required?: boolean; className?: string }) {
  const [custom, setCustom] = useState(!MOCK_ORGS.includes(value) && value !== "")
  return (
    <div className="space-y-2">
      <select value={custom ? "__custom__" : value} onChange={e => { if (e.target.value === "__custom__") { setCustom(true); onChange("") } else { setCustom(false); onChange(e.target.value) } }} className={className} required={!!required && !custom}>
        <option value="">-- เลือกหน่วยงาน --</option>
        {MOCK_ORGS.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__custom__">+ พิมพ์เอง...</option>
      </select>
      {custom && <input required={required} value={value} onChange={e => onChange(e.target.value)} placeholder="พิมพ์ชื่อหน่วยงาน" className={className} />}
    </div>
  )
}

function NewJobDialog({ onClose, onSave }: { onClose: () => void; onSave: (j: ServiceJob) => void }) {
  const [form, setForm] = useState({ job_type: "repair" as JobType, priority: "normal" as Priority, routing: "in_country" as Routing, receive_channel: "ขนส่งเอกชน" as "พนักงาน"|"ขนส่งเอกชน", manufacturer: "Fluke Biomedical", model: "", serial_number: "", received_date: new Date().toISOString().split("T")[0], tracking_in: "", customer_name: "", customer_org: "", symptom_reported: "", rma_code: "", lab_name: "", requires_approval: true })
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>ประเภทงาน</label>
              <div className="flex gap-2">
                {(["repair","calibration"] as JobType[]).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f=>({...f,job_type:t}))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.job_type===t ? t==="repair" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-500"}`}>
                    {t==="repair" ? "🔧 Repair" : "📐 Calibration"}
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
          <div className="p-4 rounded-2xl bg-gray-50 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">ข้อมูลเครื่อง</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Manufacturer</label><select value={form.manufacturer} onChange={e=>setForm(f=>({...f,manufacturer:e.target.value}))} className={inp}>{MANUFACTURERS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div><label className={lbl}>Model *</label><input required value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} className={inp} placeholder="เช่น ProSim 8, IDA 6" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Serial Number *</label><input required value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN ของเครื่อง" /></div>
              <div><label className={lbl}>วันที่รับเครื่อง</label><input type="date" value={form.received_date} onChange={e=>setForm(f=>({...f,received_date:e.target.value}))} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Tracking No. (ขาเข้า)</label><input value={form.tracking_in} onChange={e=>setForm(f=>({...f,tracking_in:e.target.value}))} className={inp} placeholder="EMS / Kerry tracking" /></div>
              <div>
                <label className={lbl}>ช่องทางรับ</label>
                <div className="flex gap-2 mt-1">
                  {(["พนักงาน","ขนส่งเอกชน"] as const).map(c=>(
                    <button key={c} type="button" onClick={()=>setForm(f=>({...f,receive_channel:c}))} className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all ${form.receive_channel===c ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400"}`}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">การส่งซ่อม / สอบเทียบ</p>
            <div className="flex gap-3">
              {([["in_country","🇹🇭 ในประเทศ"],["overseas","✈️ ต่างประเทศ"]] as [Routing,string][]).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,routing:v}))} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.routing===v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>{l}</button>
              ))}
            </div>
            {form.routing==="overseas" && <div><label className={lbl}>RMA Code *</label><input required value={form.rma_code} onChange={e=>setForm(f=>({...f,rma_code:e.target.value}))} className={inp} placeholder="RMA-FBC-2024-XXX" /></div>}
            {form.job_type==="calibration" && form.routing==="in_country" && <div><label className={lbl}>Lab ที่ส่ง</label><select value={form.lab_name} onChange={e=>setForm(f=>({...f,lab_name:e.target.value}))} className={inp}><option value="">-- เลือก Lab --</option>{LABS.map(l=><option key={l}>{l}</option>)}</select></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>หน่วยงาน *</label><OrgSelect value={form.customer_org} onChange={v => setForm(f => ({ ...f, customer_org: v }))} required className={inp} /></div>
            <div><label className={lbl}>ผู้ติดต่อ</label><input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} className={inp} placeholder="ชื่อผู้ติดต่อ" /></div>
          </div>
          <div><label className={lbl}>อาการที่ลูกค้าแจ้ง *</label><textarea required value={form.symptom_reported} onChange={e=>setForm(f=>({...f,symptom_reported:e.target.value}))} className={`${inp} resize-none`} rows={3} placeholder="อาการเสีย หรือเหตุผลที่ส่งมา" /></div>
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

interface QuoteLine { id: string; description: string; amount: number }
function QuotationDraftDialog({ job, onClose }: { job: ServiceJob; onClose: () => void }) {
  const [quoteName, setQuoteName] = useState(`ใบเสนอราคา${job.job_type==="repair"?"ซ่อม":"สอบเทียบ"} ${job.model}`)
  const [customerName, setCustomerName] = useState(job.customer_org)
  const [lines, setLines] = useState<QuoteLine[]>([
    { id:"1", description:`ค่าแรง${job.job_type==="repair"?"ซ่อม":"สอบเทียบ"} ${job.model}`, amount:0 },
    { id:"2", description:"ค่าอะไหล่", amount:0 },
  ])
  const [costInternal, setCostInternal] = useState(0)
  const [copied, setCopied] = useState(false)
  const total = lines.reduce((s,l)=>s+l.amount,0)
  function addLine(){setLines(p=>[...p,{id:Date.now().toString(),description:"",amount:0}])}
  function removeLine(id:string){setLines(p=>p.filter(l=>l.id!==id))}
  function updateLine(id:string,field:"description"|"amount",val:string|number){setLines(p=>p.map(l=>l.id===id?{...l,[field]:val}:l))}
  function copyDraft(){
    const lineText=lines.map(l=>`  - ${l.description}: ${l.amount.toLocaleString("th-TH")} บาท`).join("\n")
    const text=[`เรียน ${customerName}`,`เรื่อง ${quoteName}`,``,`รายละเอียดงาน:`,`  Model: ${job.model}`,`  SN: ${job.serial_number}`,`  อาการ: ${job.symptom_reported}`,``,`รายการค่าใช้จ่าย:`,lineText,``,`รวมทั้งสิ้น: ${total.toLocaleString("th-TH")} บาท`,``,`กรุณาส่ง PO กลับมาที่ฝ่ายบริการ`,`ขอบคุณครับ`].join("\n")
    navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
  }
  const inp="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-purple-500"/>Draft Quotation</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">1. ชื่อลูกค้า</label><input value={customerName} onChange={e=>setCustomerName(e.target.value)} className={inp}/></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">2. ชื่อใบเสนอราคา</label><input value={quoteName} onChange={e=>setQuoteName(e.target.value)} className={inp}/></div>
          <div className="p-3 bg-gray-50 rounded-2xl text-sm text-gray-600"><span className="font-semibold">{job.model}</span><span className="font-mono text-xs text-blue-600 ml-2">SN: {job.serial_number}</span></div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">3. รายการ</label>
            <div className="space-y-2">
              {lines.map(l=>(
                <div key={l.id} className="flex items-center gap-2">
                  <input value={l.description} onChange={e=>updateLine(l.id,"description",e.target.value)} className={`${inp} flex-1`} placeholder="รายการ"/>
                  <input type="number" min={0} value={l.amount||""} onChange={e=>updateLine(l.id,"amount",Number(e.target.value))} className="w-28 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none text-sm bg-white text-right" placeholder="บาท"/>
                  <button onClick={()=>removeLine(l.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 className="h-4 w-4"/></button>
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
            <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5">4. ราคาต้นทุนอะไหล่ (ภายใน)</label>
            <input type="number" min={0} value={costInternal||""} onChange={e=>setCostInternal(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none text-sm" placeholder="ต้นทุนอะไหล่ บาท"/>
            {costInternal>0&&total>0&&<p className="text-xs text-amber-600 mt-1.5">Margin: {(((total-costInternal)/total)*100).toFixed(1)}%</p>}
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">5. สถานะการ Approve</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${job.quotation_approved?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>
              {job.quotation_approved?<><CheckCircle2 className="h-4 w-4"/>Approved โดย Admin</>:<><Clock className="h-4 w-4"/>รอ Admin Approve</>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={copyDraft} className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${copied?"bg-green-500 text-white":"bg-gray-900 text-white hover:bg-gray-800"}`}>
            {copied?<><Check className="h-4 w-4"/>คัดลอกแล้ว — วางใน Email ได้เลย</>:<><Copy className="h-4 w-4"/>Copy Draft → วางใน Email</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inspection Result Dialog ──────────────────────────────────────────────────
function InspectionResultDialog({ item, result, onClose, onConfirm }: {
  item: NewMachineInspection; result: "approved" | "rejected";
  onClose: () => void; onConfirm: (notes: string) => void
}) {
  const [notes, setNotes] = useState("")
  const isApprove = result === "approved"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className={`flex items-center gap-3 mb-5 p-4 rounded-2xl ${isApprove ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          {isApprove
            ? <PackageCheck className="h-6 w-6 text-green-600 shrink-0"/>
            : <PackageX className="h-6 w-6 text-red-600 shrink-0"/>}
          <div>
            <p className={`font-bold ${isApprove ? "text-green-800" : "text-red-800"}`}>
              {isApprove ? "ผ่านการตรวจ — แจ้ง Stock ตัดเข้า" : "ไม่ผ่านการตรวจ — แจ้ง Stock / ส่งคืน"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{item.model} · SN: {item.serial_number}</p>
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isApprove ? "ผลการตรวจ (ถ้ามี)" : "เหตุผลที่ไม่ผ่าน *"}
          </label>
          <textarea
            required={!isApprove}
            value={notes}
            onChange={e=>setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white resize-none"
            placeholder={isApprove ? "เช่น Functional test ผ่าน, ครบชุด" : "เช่น พบรอยขีดข่วน, Firmware ไม่ตรง"}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
          <button
            onClick={() => { if (!isApprove && !notes.trim()) return; onConfirm(notes); onClose() }}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${isApprove ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {isApprove ? "✅ ยืนยัน — แจ้ง Stock" : "❌ ยืนยัน — แจ้ง Stock"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inspection Tab ────────────────────────────────────────────────────────────
function InspectionTab({ items, onUpdate }: {
  items: NewMachineInspection[]
  onUpdate: (id: string, status: InspectionStatus, notes?: string) => void
}) {
  const [resultDialog, setResultDialog] = useState<{ item: NewMachineInspection; result: "approved"|"rejected" } | null>(null)

  const INSP_COLORS: Record<InspectionStatus, string> = {
    pending:    "bg-yellow-100 text-yellow-700",
    inspecting: "bg-blue-100 text-blue-700",
    approved:   "bg-green-100 text-green-700",
    rejected:   "bg-red-100 text-red-700",
  }
  const INSP_LABELS: Record<InspectionStatus, string> = {
    pending: "รอตรวจ", inspecting: "กำลังตรวจ", approved: "ผ่านแล้ว ✅", rejected: "ไม่ผ่าน ❌"
  }

  const pending = items.filter(i => i.status === "pending" || i.status === "inspecting")
  const done = items.filter(i => i.status === "approved" || i.status === "rejected")

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
        <ClipboardCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-semibold text-blue-800">ตรวจเช็คเครื่องใหม่จาก Stock</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Stock ส่งเครื่องใหม่มาให้ตรวจก่อนตัดเข้า Stock หลัก · เมื่อตรวจเสร็จกด "ผ่าน" หรือ "ไม่ผ่าน" เพื่อแจ้งกลับไปยัง Stock
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3">รอตรวจ / กำลังตรวจ ({pending.length})</h3>
          <div className="space-y-4">
            {pending.map(item => (
              <div key={item.id} className="bg-white rounded-3xl border-2 border-blue-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-gray-900 text-base">{item.item_name}</p>
                    <p className="font-mono text-xs text-blue-600 mt-0.5">SN: {item.serial_number}</p>
                    {item.parent_sn && (
                      <p className="text-xs text-violet-600 mt-0.5">Parent SN: {item.parent_sn}</p>
                    )}
                  </div>
                  <Pill label={INSP_LABELS[item.status]} color={INSP_COLORS[item.status]}/>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">PO Number</p>
                    <p className="text-sm font-bold font-mono">{item.po_number}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">Supplier</p>
                    <p className="text-sm font-bold">{item.supplier}</p>
                  </div>
                  <div className={`p-3 rounded-2xl ${item.has_al_case ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
                    <p className="text-xs text-gray-400 mb-0.5">กล่อง Aluminium</p>
                    <p className={`text-sm font-bold ${item.has_al_case ? "text-amber-700" : "text-gray-500"}`}>
                      {item.has_al_case ? "✅ มีกล่อง" : "—ไม่มี"}
                    </p>
                  </div>
                </div>

                {item.notes && (
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                    <p className="text-xs text-blue-600 mb-0.5">หมายเหตุจาก Stock</p>
                    <p className="text-sm text-gray-800">{item.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    ส่งโดย <span className="font-semibold text-gray-600">{item.sent_by}</span> · {item.sent_at}
                  </p>
                  <div className="flex gap-2">
                    {item.status === "pending" && (
                      <button
                        onClick={() => onUpdate(item.id, "inspecting")}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        เริ่มตรวจ
                      </button>
                    )}
                    <button
                      onClick={() => setResultDialog({ item, result: "approved" })}
                      className="px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors flex items-center gap-1"
                    >
                      <PackageCheck className="h-3.5 w-3.5"/> ผ่าน
                    </button>
                    <button
                      onClick={() => setResultDialog({ item, result: "rejected" })}
                      className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                    >
                      <PackageX className="h-3.5 w-3.5"/> ไม่ผ่าน
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-500 mb-3 text-sm">ตรวจแล้ว ({done.length})</h3>
          <div className="space-y-2">
            {done.map(item => (
              <div key={item.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${item.status === "approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{item.item_name}</p>
                  <p className="font-mono text-xs text-gray-500">SN: {item.serial_number}</p>
                  {item.result_notes && <p className="text-xs text-gray-600 mt-1">{item.result_notes}</p>}
                </div>
                <Pill label={INSP_LABELS[item.status]} color={INSP_COLORS[item.status]}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <ClipboardCheck className="h-16 w-16 mb-3 opacity-30"/>
          <p className="text-sm">ไม่มีเครื่องรอตรวจ</p>
        </div>
      )}

      {resultDialog && (
        <InspectionResultDialog
          item={resultDialog.item}
          result={resultDialog.result}
          onClose={() => setResultDialog(null)}
          onConfirm={(notes) => {
            onUpdate(resultDialog.item.id, resultDialog.result, notes)
            decrementInspection()
          }}
        />
      )}
    </div>
  )
}

function FromStockTab({ dispatches, onAccept }: { dispatches: StockDispatch[]; onAccept: (d: StockDispatch) => void }) {
  if (dispatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-300">
        <Inbox className="h-16 w-16 mb-3 opacity-30"/>
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
                <span className={`p-1.5 rounded-lg ${d.job_type==="repair"?"bg-blue-100":"bg-teal-100"}`}>
                  {d.job_type==="repair"?<Wrench className="h-3.5 w-3.5 text-blue-600"/>:<FlaskConical className="h-3.5 w-3.5 text-teal-600"/>}
                </span>
                <p className="font-bold text-gray-900">{d.item_name}</p>
              </div>
              <p className="font-mono text-xs text-blue-600 ml-8">SN: {d.serial_number}</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">จาก Stock</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><Building2 className="h-3 w-3"/>หน่วยงาน</p>
              <p className="text-sm font-semibold text-gray-900">{d.customer_org}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><User className="h-3 w-3"/>ผู้ติดต่อ</p>
              <p className="text-sm font-semibold text-gray-900">{d.customer_contact||"—"}</p>
            </div>
          </div>
          <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 mb-4">
            <p className="text-xs text-orange-600 mb-1">อาการ / เหตุผล</p>
            <p className="text-sm text-gray-800">{d.symptom}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">ส่งโดย <span className="font-semibold text-gray-600">{d.dispatched_by}</span> · {d.dispatched_at}</div>
            <button onClick={()=>{onAccept(d);decrementServiceRequest()}} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors">
              <CheckCircle2 className="h-4 w-4"/>รับงาน
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function FromSETab({ requests, onAccept }: { requests: SERequest[]; onAccept: (r: SERequest) => void }) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-300">
        <Users className="h-16 w-16 mb-3 opacity-30"/>
        <p className="text-sm">ไม่มีคำขอจาก SE</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">คำขอบริการที่ทีม SE ส่งมาให้ฝ่ายบริการ กรุณากด "รับงาน" เพื่อเพิ่มเข้าคิวหลัก</p>
      {requests.map(r => {
        const priorityColor = r.priority==="urgent"?"bg-red-100 text-red-700":r.priority==="high"?"bg-orange-100 text-orange-700":"bg-gray-100 text-gray-500"
        const priorityLabel = r.priority==="urgent"?"เร่งด่วน":r.priority==="high"?"สำคัญ":"ปกติ"
        return (
          <div key={r.id} className="bg-white rounded-3xl border border-violet-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-violet-100"><Users className="h-3.5 w-3.5 text-violet-600"/></span>
                  <p className="font-bold text-gray-900">{r.customer_org}</p>
                </div>
                <p className="text-xs text-gray-500 ml-8">{r.equipment}</p>
              </div>
              <Pill label={priorityLabel} color={priorityColor}/>
            </div>
            <div className="p-3 bg-violet-50 rounded-2xl border border-violet-100 mb-4">
              <p className="text-xs text-violet-600 mb-1">รายละเอียดปัญหา</p>
              <p className="text-sm text-gray-800">{r.issue_description}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">ขอโดย <span className="font-semibold text-gray-600">{r.requested_by}</span> · {r.requested_at}</div>
              <button onClick={()=>{onAccept(r);decrementServiceRequest()}} className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-bold transition-colors">
                <CheckCircle2 className="h-4 w-4"/>รับงาน
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceRequestPage() {
  const [jobs, setJobs] = useState<ServiceJob[]>(MOCK_JOBS)
  const [selected, setSelected] = useState<ServiceJob|null>(MOCK_JOBS[0])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all"|JobType>("all")
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด")
  const [showNew, setShowNew] = useState(false)
  const [showQuoteDialog, setShowQuoteDialog] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>("jobs")
  const [stockDispatches, setStockDispatches] = useState<StockDispatch[]>(MOCK_STOCK_DISPATCHES)
  const [seRequests, setSERequests] = useState<SERequest[]>(MOCK_SE_REQUESTS)
  const [inspections, setInspections] = useState<NewMachineInspection[]>(MOCK_INSPECTIONS)

  const totalIncoming = stockDispatches.length + seRequests.length
  const pendingInspections = inspections.filter(i => i.status === "pending" || i.status === "inspecting").length

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    return (j.job_no.toLowerCase().includes(q)||j.model.toLowerCase().includes(q)||j.serial_number.toLowerCase().includes(q)||j.customer_org.toLowerCase().includes(q)) &&
      (filterType==="all"||j.job_type===filterType) &&
      (filterStatus==="ทั้งหมด"||j.status===filterStatus)
  })

  function advanceStatus(job: ServiceJob) {
    const idx = STATUS_FLOW.indexOf(job.status)
    if (idx < STATUS_FLOW.length - 1) {
      const next = STATUS_FLOW[idx+1]
      const skip = next==="รอ Quotation Approve" && !job.requires_approval
      const actualNext: JobStatus = skip ? (STATUS_FLOW[idx+2]??next) : next
      const updated: ServiceJob = {...job, status: actualNext}
      setJobs(prev=>prev.map(j=>j.id===job.id?updated:j))
      setSelected(updated)
    }
  }

  function acceptStockDispatch(d: StockDispatch) {
    const count = Math.floor(Math.random()*900)+100
    const newJob: ServiceJob = {
      id: Date.now().toString(), job_no:`JOB-2024-0${count}`, job_type:d.job_type,
      status:"รอประเมิน", priority:"normal", serial_number:d.serial_number,
      manufacturer:"—", model:d.item_name,
      received_date:new Date().toISOString().split("T")[0], tracking_in:"—",
      receive_channel:"พนักงาน", customer_name:d.customer_contact, customer_org:d.customer_org,
      routing:"in_country", symptom_reported:d.symptom, requires_approval:true,
      created_at:new Date().toISOString().split("T")[0],
    }
    setJobs(prev=>[newJob,...prev])
    setStockDispatches(prev=>prev.filter(x=>x.id!==d.id))
    setSelected(newJob); setMainTab("jobs")
  }

  function acceptSERequest(r: SERequest) {
    const count = Math.floor(Math.random()*900)+100
    const newJob: ServiceJob = {
      id: Date.now().toString(), job_no:`JOB-2024-0${count}`, job_type:"repair",
      status:"รอประเมิน", priority:r.priority,
      serial_number:r.equipment.includes("SN:")?r.equipment.split("SN:")[1].trim():"—",
      manufacturer:"—", model:r.equipment.split("—")[0].trim(),
      received_date:new Date().toISOString().split("T")[0], tracking_in:"—",
      receive_channel:"พนักงาน", customer_name:r.requested_by, customer_org:r.customer_org,
      routing:"in_country", symptom_reported:r.issue_description, requires_approval:true,
      created_at:new Date().toISOString().split("T")[0],
    }
    setJobs(prev=>[newJob,...prev])
    setSERequests(prev=>prev.filter(x=>x.id!==r.id))
    setSelected(newJob); setMainTab("jobs")
  }

  function updateInspection(id: string, status: InspectionStatus, notes?: string) {
    setInspections(prev => prev.map(i => i.id===id ? {...i, status, result_notes: notes} : i))
  }

  const sel = selected

  const MAIN_TABS: { id: MainTab; label: string; badge?: number }[] = [
    { id:"jobs", label:"งานทั้งหมด" },
    { id:"inspection", label:"ตรวจเช็คเครื่องใหม่", badge: pendingInspections },
    { id:"from_stock", label:"รับงานจาก Stock", badge: stockDispatches.length },
    { id:"from_se", label:"คำขอจาก SE", badge: seRequests.length },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">งาน Repair & Calibration</h1>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} งานทั้งหมด · {jobs.filter(j=>j.status!=="ปิดงาน").length} งานที่ยังเปิดอยู่</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-sm transition-colors">
          <Plus className="h-4 w-4"/>สร้างงานใหม่
        </button>
      </div>

      {/* Notification Banner */}
      {(totalIncoming > 0 || pendingInspections > 0) && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4">
          <Bell className="h-5 w-5 text-amber-500 shrink-0"/>
          <p className="text-sm text-amber-800 font-semibold flex-1">
            {pendingInspections > 0 && <span className="text-blue-600">{pendingInspections} เครื่องใหม่รอตรวจ </span>}
            {totalIncoming > 0 && stockDispatches.length > 0 && <span className="text-orange-600">{stockDispatches.length} งานจาก Stock </span>}
            {seRequests.length > 0 && <span className="text-violet-600">{seRequests.length} คำขอจาก SE</span>}
          </p>
          <div className="flex gap-2 shrink-0">
            {pendingInspections > 0 && <button onClick={()=>setMainTab("inspection")} className="px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600">ตรวจเครื่อง</button>}
            {stockDispatches.length > 0 && <button onClick={()=>setMainTab("from_stock")} className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600">งาน Stock</button>}
            {seRequests.length > 0 && <button onClick={()=>setMainTab("from_se")} className="px-3 py-1.5 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600">คำขอ SE</button>}
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-5 w-fit">
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={()=>setMainTab(t.id)}
            className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mainTab===t.id?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
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
      {mainTab==="jobs" && (
        <div className="flex gap-5 flex-1 min-h-0">
          <div className="w-80 shrink-0 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" placeholder="ค้นหา job / model / SN"/>
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {([["all","ทั้งหมด"],["repair","Repair"],["calibration","Cal"]] as ["all"|JobType,string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setFilterType(v)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType===v?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>{l}</button>
              ))}
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>ทั้งหมด</option>
              {STATUS_FLOW.map(s=><option key={s}>{s}</option>)}
            </select>
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {filtered.length===0
                ?<p className="text-center text-sm text-gray-400 py-10">ไม่พบงาน</p>
                :filtered.map(j=><JobCard key={j.id} job={j} selected={sel?.id===j.id} onClick={()=>setSelected(j)}/>)
              }
            </div>
          </div>
          {sel?(
            <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
              <div className="bg-white rounded-3xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${sel.job_type==="repair"?"bg-blue-100 text-blue-700":"bg-teal-100 text-teal-700"}`}>
                        {sel.job_type==="repair"?<Wrench className="h-3.5 w-3.5"/>:<FlaskConical className="h-3.5 w-3.5"/>}
                        {sel.job_type==="repair"?"Repair":"Calibration"}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${sel.priority==="urgent"?"bg-red-100 text-red-700":sel.priority==="high"?"bg-orange-100 text-orange-700":"bg-gray-100 text-gray-600"}`}>
                        {sel.priority==="urgent"?"⚡ เร่งด่วน":sel.priority==="high"?"↑ สำคัญ":"ปกติ"}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-500 mb-1">{sel.job_no}</p>
                    <span className={`inline-flex px-3 py-1.5 rounded-2xl text-sm font-bold ${STATUS_COLORS[sel.status]}`}>{sel.status}</span>
                  </div>
                  {sel.status!=="ปิดงาน"&&(
                    <button onClick={()=>advanceStatus(sel)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-semibold transition-colors">
                      เปลี่ยนสถานะ<ChevronRight className="h-4 w-4"/>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {STATUS_FLOW.map((s,i)=>{
                    const cur=STATUS_FLOW.indexOf(sel.status)
                    return<div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i<=cur?"bg-blue-500":"bg-gray-200"}`} title={s}/>
                  })}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">เริ่ม</span>
                  <span className="text-xs text-gray-400">ปิดงาน</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-3xl border border-gray-200 p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Equipment</p>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200"><Wrench className="h-6 w-6 text-gray-500"/></div>
                  <div>
                    <p className="text-xl font-black text-gray-900">{sel.model}</p>
                    <p className="text-sm text-gray-500">{sel.manufacturer}</p>
                    <p className="font-mono text-sm font-bold text-blue-600 mt-1">SN: {sel.serial_number}</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${sel.routing==="overseas"?"bg-orange-100 text-orange-700":"bg-green-100 text-green-700"}`}>
                      {sel.routing==="overseas"?"✈️ ต่างประเทศ":"🇹🇭 ในประเทศ"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-2xl"><p className="text-xs text-gray-400 mb-0.5">วันที่รับ</p><p className="text-sm font-bold">{sel.received_date}</p></div>
                  <div className="bg-white p-3 rounded-2xl"><p className="text-xs text-gray-400 mb-0.5">ช่องทาง</p><p className="text-sm font-bold">{sel.receive_channel}</p></div>
                  <div className="bg-white p-3 rounded-2xl"><p className="text-xs text-gray-400 mb-0.5">Tracking (เข้า)</p><p className="text-sm font-bold font-mono">{sel.tracking_in||"—"}</p></div>
                </div>
                {sel.routing==="overseas"&&sel.rma_code&&(
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-2xl flex items-center gap-2">
                    <Hash className="h-4 w-4 text-orange-500"/>
                    <div><p className="text-xs text-orange-600">RMA Code</p><p className="font-bold font-mono text-orange-800">{sel.rma_code}</p></div>
                  </div>
                )}
                {sel.job_type==="calibration"&&sel.routing==="in_country"&&sel.lab_name&&(
                  <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-teal-500"/>
                    <div><p className="text-xs text-teal-600">ส่ง Lab</p><p className="font-bold text-teal-800">{sel.lab_name}</p></div>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-3xl border border-gray-200 p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">ลูกค้า</p>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><Building2 className="h-4 w-4 text-blue-600"/></div>
                  <div><p className="font-bold text-gray-900">{sel.customer_org}</p>{sel.customer_name&&<p className="text-sm text-gray-500">{sel.customer_name}</p>}</div>
                </div>
              </div>
              <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">อาการ & การแก้ไข</p>
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100"><p className="text-xs text-red-500 mb-1">อาการที่ลูกค้าแจ้ง</p><p className="text-sm text-gray-900">{sel.symptom_reported}</p></div>
                <div className={`p-4 rounded-2xl border ${sel.symptom_actual?"bg-amber-50 border-amber-100":"bg-gray-50 border-gray-200"}`}>
                  <p className="text-xs text-gray-500 mb-1">ผลการวิเคราะห์</p>
                  {sel.symptom_actual?<p className="text-sm text-gray-900">{sel.symptom_actual}</p>:<p className="text-sm text-gray-400 italic">ยังไม่ได้วิเคราะห์</p>}
                </div>
                {sel.fix_method&&<div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-xs text-green-600 mb-1">วิธีแก้ไข</p><p className="text-sm text-gray-900">{sel.fix_method}</p></div>}
              </div>
              {STATUS_FLOW.indexOf(sel.status)>=STATUS_FLOW.indexOf("รอ Quotation Approve")&&(
                <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Quotation</p>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${sel.quotation_approved?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>
                      {sel.quotation_approved?"✓ Approved":"⏳ รอ Approve"}
                    </div>
                    {!sel.requires_approval&&<span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">ข้ามการ Approve</span>}
                  </div>
                  {sel.po_number&&<div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500"/><div><p className="text-xs text-blue-500">PO Number</p><p className="font-bold font-mono text-blue-800">{sel.po_number}</p></div></div>}
                  <button onClick={()=>setShowQuoteDialog(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold transition-all">
                    <FileText className="h-4 w-4"/>สร้าง Draft Quotation
                  </button>
                </div>
              )}
              {STATUS_FLOW.indexOf(sel.status)>=STATUS_FLOW.indexOf("รอส่งคืน")&&(
                <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">ปิดงาน</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 rounded-2xl"><p className="text-xs text-gray-400 mb-0.5">Tracking (ออก)</p><p className="text-sm font-bold font-mono">{sel.tracking_out||"—"}</p></div>
                    <div className="p-3 bg-gray-50 rounded-2xl"><p className="text-xs text-gray-400 mb-0.5">Invoice No.</p><p className="text-sm font-bold">{sel.invoice_no||"—"}</p></div>
                    <div className="p-3 bg-gray-50 rounded-2xl"><p className="text-xs text-gray-400 mb-0.5">Warranty</p><p className="text-sm font-bold">{sel.warranty_days?`${sel.warranty_days} วัน`:"—"}</p></div>
                  </div>
                  {sel.status==="ปิดงาน"&&<div className="flex items-center gap-2 p-3 bg-green-50 rounded-2xl border border-green-200"><CheckCircle2 className="h-5 w-5 text-green-600"/><p className="text-sm font-bold text-green-800">งานปิดแล้ว</p></div>}
                </div>
              )}
            </div>
          ):(
            <div className="flex-1 flex items-center justify-center text-gray-300">
              <div className="text-center"><Wrench className="h-16 w-16 mx-auto mb-3 opacity-20"/><p className="text-sm">เลือกงานเพื่อดูรายละเอียด</p></div>
            </div>
          )}
        </div>
      )}

      {mainTab==="inspection"&&<div className="flex-1 overflow-y-auto"><InspectionTab items={inspections} onUpdate={updateInspection}/></div>}
      {mainTab==="from_stock"&&<div className="flex-1 overflow-y-auto"><FromStockTab dispatches={stockDispatches} onAccept={acceptStockDispatch}/></div>}
      {mainTab==="from_se"&&<div className="flex-1 overflow-y-auto"><FromSETab requests={seRequests} onAccept={acceptSERequest}/></div>}

      {showNew&&<NewJobDialog onClose={()=>setShowNew(false)} onSave={j=>{setJobs(p=>[j,...p]);setSelected(j);setMainTab("jobs")}}/>}
      {showQuoteDialog&&sel&&<QuotationDraftDialog job={sel} onClose={()=>setShowQuoteDialog(false)}/>}
    </div>
  )
}
