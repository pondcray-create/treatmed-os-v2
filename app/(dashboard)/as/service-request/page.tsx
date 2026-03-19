"use client"

import { useState } from "react"
import { Search, Plus, ChevronRight, X, Wrench, FlaskConical, AlertTriangle, Clock, CheckCircle2, Copy, Check, Truck, Building2, User, Hash, Calendar, MapPin, FileText, Package, Trash2 } from "lucide-react"

type JobType = "repair" | "calibration"
type JobStatus = "รอประเมิน" | "กำลังประเมิน" | "รอ Quotation Approve" | "รอ PO" | "ในคิว" | "กำลังซ่อม" | "รออะไหล่" | "QC" | "รอส่งคืน" | "ปิดงาน"
type Priority = "urgent" | "high" | "normal"
type Routing = "in_country" | "overseas"

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

const LABS = ["สถาบันมาตรวิทยาแห่งชาติ (NIMT)","สถาบันเทคโนโลยีไทย-ญี่ปุ่น (TNI)","มจธ. ศูนย์บริการวิทยาศาสตร์","อื่นๆ"]
const MANUFACTURERS = ["Fluke Biomedical","RaySafe","Fluke General","IMT Analytics","Omega","Testo","Other"]

// ── Pill ────────────────────────────────────────────────────────────────────
function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

// ── Job Card ─────────────────────────────────────────────────────────────────
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

// ── New Job Dialog ────────────────────────────────────────────────────────────
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
          {/* Type + Priority */}
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
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>หน่วยงาน *</label>
              <input required value={form.customer_org} onChange={e=>setForm(f=>({...f,customer_org:e.target.value}))} className={inp} placeholder="ชื่อโรงพยาบาล" />
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
  const [quoteName, setQuoteName] = useState(`ใบเสนอราคา${job.job_type === "repair" ? "ซ่อม" : "สอบเทียบ"} ${job.model}`)
  const [customerName, setCustomerName] = useState(job.customer_org)
  const [lines, setLines] = useState<QuoteLine[]>([
    { id:"1", description:`ค่าแรง${job.job_type === "repair" ? "ซ่อม" : "สอบเทียบ"} ${job.model}`, amount:0 },
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
          {/* Customer */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">1. ชื่อลูกค้า</label>
            <input value={customerName} onChange={e=>setCustomerName(e.target.value)} className={inp} />
          </div>
          {/* Quote Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">2. ชื่อใบเสนอราคา</label>
            <input value={quoteName} onChange={e=>setQuoteName(e.target.value)} className={inp} />
          </div>
          {/* Equipment reference */}
          <div className="p-3 bg-gray-50 rounded-2xl text-sm text-gray-600">
            <span className="font-semibold">{job.model}</span>
            <span className="font-mono text-xs text-blue-600 ml-2">SN: {job.serial_number}</span>
          </div>
          {/* Line Items */}
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
          {/* Internal Cost */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5">4. ราคาต้นทุนอะไหล่ (ภายใน — ไม่ส่งลูกค้า)</label>
            <input type="number" min={0} value={costInternal||""} onChange={e=>setCostInternal(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" placeholder="ต้นทุนอะไหล่ บาท" />
            {costInternal > 0 && total > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">Margin: {(((total - costInternal) / total) * 100).toFixed(1)}%</p>
            )}
          </div>
          {/* Approval status */}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceRequestPage() {
  const [jobs, setJobs] = useState<ServiceJob[]>(MOCK_JOBS)
  const [selected, setSelected] = useState<ServiceJob | null>(MOCK_JOBS[0])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all"|JobType>("all")
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด")
  const [showNew, setShowNew] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQuoteDialog, setShowQuoteDialog] = useState(false)

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    return (j.job_no.toLowerCase().includes(q) || j.model.toLowerCase().includes(q) || j.serial_number.toLowerCase().includes(q) || j.customer_org.toLowerCase().includes(q)) &&
      (filterType === "all" || j.job_type === filterType) &&
      (filterStatus === "ทั้งหมด" || j.status === filterStatus)
  })

  function advanceStatus(job: ServiceJob) {
    const idx = STATUS_FLOW.indexOf(job.status)
    if (idx < STATUS_FLOW.length - 1) {
      const next = STATUS_FLOW[idx + 1]
      // Skip "รอ Quotation Approve" if not required
      const actualNext = next === "รอ Quotation Approve" && !job.requires_approval ? STATUS_FLOW[idx + 2] : next
      const updated = { ...job, status: actualNext }
      setJobs(prev => prev.map(j => j.id === job.id ? updated : j))
      setSelected(updated)
    }
  }

  function copyQuote(job: ServiceJob) {
    const text = `เรียน ${job.customer_org}\nเรื่อง ใบเสนอราคา${job.job_type === "repair" ? "ซ่อม" : "สอบเทียบ"} ${job.model} SN: ${job.serial_number}\nอาการ: ${job.symptom_reported}\n\nราคา: ________________ บาท\n\nโปรดส่ง PO กลับมาที่ฝ่ายบริการ\nขอบคุณครับ`
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const sel = selected

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">งาน Repair & Calibration</h1>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} งานทั้งหมด · {jobs.filter(j=>j.status!=="ปิดงาน").length} งานที่ยังเปิดอยู่</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> สร้างงานใหม่
        </button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" placeholder="ค้นหา job / model / SN" />
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {([["all","ทั้งหมด"],["repair","Repair"],["calibration","Cal"]] as ["all"|JobType, string][]).map(([v,l])=>(
              <button key={v} onClick={()=>setFilterType(v)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType===v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{l}</button>
            ))}
          </div>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>ทั้งหมด</option>
            {STATUS_FLOW.map(s=><option key={s}>{s}</option>)}
          </select>
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-10">ไม่พบงาน</p>
              : filtered.map(j=><JobCard key={j.id} job={j} selected={sel?.id===j.id} onClick={()=>setSelected(j)} />)
            }
          </div>
        </div>

        {/* Right — Detail */}
        {sel ? (
          <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
            {/* Header */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${sel.job_type==="repair" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"}`}>
                      {sel.job_type==="repair" ? <Wrench className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
                      {sel.job_type==="repair" ? "Repair" : "Calibration"}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${sel.priority==="urgent" ? "bg-red-100 text-red-700" : sel.priority==="high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                      {sel.priority==="urgent" ? "⚡ เร่งด่วน" : sel.priority==="high" ? "↑ สำคัญ" : "ปกติ"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-500 mb-1">{sel.job_no}</p>
                  <span className={`inline-flex px-3 py-1.5 rounded-2xl text-sm font-bold ${STATUS_COLORS[sel.status]}`}>{sel.status}</span>
                </div>
                {sel.status !== "ปิดงาน" && (
                  <button onClick={()=>advanceStatus(sel)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-semibold transition-colors">
                    เปลี่ยนสถานะ <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-1">
                {STATUS_FLOW.map((s,i) => {
                  const cur = STATUS_FLOW.indexOf(sel.status)
                  return <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i <= cur ? "bg-blue-500" : "bg-gray-200"}`} title={s} />
                })}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">เริ่ม</span>
                <span className="text-xs text-gray-400">ปิดงาน</span>
              </div>
            </div>

            {/* Equipment Card */}
            <div className="bg-gray-50 rounded-3xl border border-gray-200 p-6">
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
            <div className="bg-white rounded-3xl border border-gray-200 p-6">
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
            <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">อาการ & การแก้ไข</p>
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-xs text-red-500 mb-1">อาการที่ลูกค้าแจ้ง</p>
                <p className="text-sm text-gray-900">{sel.symptom_reported}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${sel.symptom_actual ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-200"}`}>
                <p className="text-xs text-gray-500 mb-1">ผลการวิเคราะห์</p>
                {sel.symptom_actual
                  ? <p className="text-sm text-gray-900">{sel.symptom_actual}</p>
                  : <p className="text-sm text-gray-400 italic">ยังไม่ได้วิเคราะห์</p>}
              </div>
              {sel.fix_method && (
                <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                  <p className="text-xs text-green-600 mb-1">วิธีแก้ไข</p>
                  <p className="text-sm text-gray-900">{sel.fix_method}</p>
                </div>
              )}
            </div>

            {/* Quotation */}
            {STATUS_FLOW.indexOf(sel.status) >= STATUS_FLOW.indexOf("รอ Quotation Approve") && (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
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
                <button onClick={()=>setShowQuoteDialog(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold transition-all">
                  <FileText className="h-4 w-4" /> สร้าง Draft Quotation
                </button>
              </div>
            )}

            {/* Close */}
            {STATUS_FLOW.indexOf(sel.status) >= STATUS_FLOW.indexOf("รอส่งคืน") && (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">ปิดงาน</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">Tracking (ออก)</p>
                    <p className="text-sm font-bold font-mono">{sel.tracking_out || "—"}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">Invoice No.</p>
                    <p className="text-sm font-bold">{sel.invoice_no || "—"}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-400 mb-0.5">Warranty</p>
                    <p className="text-sm font-bold">{sel.warranty_days ? `${sel.warranty_days} วัน` : "—"}</p>
                  </div>
                </div>
                {sel.status === "ปิดงาน" && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-2xl border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-bold text-green-800">งานปิดแล้ว</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center"><Wrench className="h-16 w-16 mx-auto mb-3 opacity-20" /><p className="text-sm">เลือกงานเพื่อดูรายละเอียด</p></div>
          </div>
        )}
      </div>

      {showNew && <NewJobDialog onClose={()=>setShowNew(false)} onSave={j=>{setJobs(p=>[j,...p]);setSelected(j)}} />}
      {showQuoteDialog && sel && <QuotationDraftDialog job={sel} onClose={()=>setShowQuoteDialog(false)} />}
    </div>
  )
}
