"use client"

import { useState, useRef } from "react"
import { Package, Plus, Search, ArrowDownCircle, X, AlertTriangle, CheckCircle2, Wrench, FlaskConical, ShoppingCart, Zap, Drill, Camera, ChevronRight, Bookmark, Send, User, Building2, ClipboardList, TrendingDown, Clock, BarChart2, PackageCheck, Link2, Box } from "lucide-react"
import { setNotificationCounts, getNotificationCounts } from "@/lib/notificationStore"

type StockCategory = "spare_part" | "module" | "sellable" | "consumable" | "tool" | "demo"
type ItemStatus = "in_stock" | "reserved" | "on_loan" | "on_rma" | "sold" | "pending_inspection"
type Tab = "all" | "receive" | "booking" | "demo" | "dead_stock"

interface ChildSN { sn: string; label: string }

interface StockItem {
  id: string; name: string; brand: string; category: StockCategory
  has_serial: boolean; serial_number?: string; qty: number; min_qty: number; unit: string
  status: ItemStatus; loaned_to?: string; reserved_by_sales?: string; reserved_for_customer?: string; loan_due?: string
  has_al_case?: boolean
  child_sns?: ChildSN[]   // Parent-Child SN (IDA6 / ProSim8)
  parent_id?: string      // child item → points to parent
  last_movement_date?: string   // for dead stock analysis
}

interface StockTransaction {
  id: string; item_id: string; item_name: string; type: "in" | "out" | "adjust"
  qty: number; reference: string; note?: string; date: string; approved_by?: string
}

interface Booking {
  id: string; item_id: string; item_name: string; serial_number?: string
  sales_name: string; customer_name: string; booked_date: string; note?: string
}

interface DispatchForm {
  item: StockItem; job_type: "repair" | "calibration"
  customer_org: string; customer_name: string; symptom: string
}

interface IntakeInspection {
  id: string; item_id: string; item_name: string; serial_number?: string
  po_number: string; supplier: string; has_al_case: boolean
  sent_by: string; sent_at: string; status: "pending" | "approved" | "rejected"
}

// ── Customer DB mock (for LLM-style search) ───────────────────────────────────
const CUSTOMER_DB = [
  { id:"c1", org:"โรงพยาบาลศิริราช", contact:"นพ.วีระชัย สมิทธ์", tel:"02-419-7000" },
  { id:"c2", org:"โรงพยาบาลกรุงเทพ", contact:"นายประสิทธิ์ แก้วมณี", tel:"02-310-3000" },
  { id:"c3", org:"โรงพยาบาลมหาราชนครเชียงใหม่", contact:"นางสมศรี ใจดี", tel:"053-935-000" },
  { id:"c4", org:"โรงพยาบาลขอนแก่น", contact:"นพ.ธีรพล รักดี", tel:"043-336-789" },
  { id:"c5", org:"โรงพยาบาลสมิติเวช", contact:"นางสาวพิมลพรรณ รักดี", tel:"02-022-2222" },
  { id:"c6", org:"โรงพยาบาลบำรุงราษฎร์", contact:"คุณวิภาพร สุขใจ", tel:"02-066-8888" },
  { id:"c7", org:"โรงพยาบาลรามาธิบดี", contact:"นายสมชาย วงศ์ดี", tel:"02-201-2222" },
  { id:"c8", org:"โรงพยาบาลจุฬาลงกรณ์", contact:"คุณธนากร มั่นใจ", tel:"02-256-4000" },
]

const CAT_LABELS: Record<StockCategory, string> = {
  spare_part:"อะไหล่", module:"Module", sellable:"สินค้าขาย",
  consumable:"วัสดุสิ้นเปลือง", tool:"เครื่องมือ", demo:"Demo Unit"
}
const CAT_COLORS: Record<StockCategory, string> = {
  spare_part:"bg-blue-100 text-blue-700", module:"bg-violet-100 text-violet-700",
  sellable:"bg-emerald-100 text-emerald-700", consumable:"bg-yellow-100 text-yellow-700",
  tool:"bg-gray-100 text-gray-700", demo:"bg-orange-100 text-orange-700"
}
const CAT_ICONS: Record<StockCategory, React.ReactNode> = {
  spare_part:<Wrench className="h-4 w-4"/>, module:<FlaskConical className="h-4 w-4"/>,
  sellable:<ShoppingCart className="h-4 w-4"/>, consumable:<Zap className="h-4 w-4"/>,
  tool:<Drill className="h-4 w-4"/>, demo:<Camera className="h-4 w-4"/>
}
const STATUS_COLORS: Record<ItemStatus, string> = {
  in_stock:"bg-emerald-100 text-emerald-700", reserved:"bg-orange-100 text-orange-700",
  on_loan:"bg-blue-100 text-blue-700", on_rma:"bg-gray-100 text-gray-500",
  sold:"bg-gray-100 text-gray-400", pending_inspection:"bg-yellow-100 text-yellow-700"
}
const STATUS_LABELS: Record<ItemStatus, string> = {
  in_stock:"In Stock", reserved:"Reserved", on_loan:"On Loan",
  on_rma:"On RMA", sold:"Sold", pending_inspection:"รอตรวจ"
}

const MOCK_ITEMS: StockItem[] = [
  { id:"1", name:"Battery Pack ProSim 8", brand:"Fluke Biomedical", category:"spare_part", has_serial:false, qty:3, min_qty:5, unit:"ชิ้น", status:"in_stock", last_movement_date:"2024-01-10" },
  { id:"2", name:"LCD Module ProSim 4", brand:"Fluke Biomedical", category:"spare_part", has_serial:false, qty:1, min_qty:2, unit:"ชิ้น", status:"in_stock", last_movement_date:"2023-11-05" },
  { id:"3", name:"IDA6 Display Unit", brand:"Fluke Biomedical", category:"module", has_serial:true, serial_number:"IDA6-DISP-2023-0089", qty:1, min_qty:1, unit:"อัน", status:"in_stock",
    child_sns:[{ sn:"IDA6MOD-CH1-0089", label:"Module Ch.1" },{ sn:"IDA6MOD-CH2-0089", label:"Module Ch.2" }], last_movement_date:"2024-02-20" },
  { id:"4", name:"ProSim 8 + SPOT Module", brand:"Fluke Biomedical", category:"sellable", has_serial:true, serial_number:"PS8-2024-NEW-001", qty:1, min_qty:0, unit:"เครื่อง",
    status:"reserved", reserved_by_sales:"คุณสมหมาย", reserved_for_customer:"โรงพยาบาลรามาธิบดี",
    has_al_case:true,
    child_sns:[{ sn:"SPOT-2024-NEW-001", label:"SPOT Module" }],
    last_movement_date:"2024-03-10" },
  { id:"5", name:"RaySafe X2 Solo", brand:"RaySafe", category:"sellable", has_serial:true, serial_number:"X2S-2024-001", qty:2, min_qty:1, unit:"เครื่อง", status:"in_stock", has_al_case:true, last_movement_date:"2024-03-15" },
  { id:"6", name:"Electrode Pad (10 pcs)", brand:"Generic", category:"consumable", has_serial:false, qty:15, min_qty:20, unit:"แพ็ค", status:"in_stock", last_movement_date:"2024-03-15" },
  { id:"7", name:"Calibration Fixture Set", brand:"TreatMed", category:"tool", has_serial:false, qty:2, min_qty:1, unit:"ชุด", status:"in_stock", last_movement_date:"2023-09-01" },
  { id:"8", name:"ProSim 4 Demo", brand:"Fluke Biomedical", category:"demo", has_serial:true, serial_number:"PS4-DEMO-001", qty:1, min_qty:0, unit:"เครื่อง", status:"on_loan", loaned_to:"โรงพยาบาลขอนแก่น", loan_due:"2024-03-10", last_movement_date:"2024-02-01" },
  { id:"9", name:"RaySafe 452 Full Kit", brand:"RaySafe", category:"sellable", has_serial:true, serial_number:"452-2024-001", qty:1, min_qty:0, unit:"ชุด", status:"on_rma", last_movement_date:"2024-01-20" },
  { id:"10", name:"ESA 615 Demo", brand:"Fluke Biomedical", category:"demo", has_serial:true, serial_number:"ESA615-DEMO-001", qty:1, min_qty:0, unit:"เครื่อง", status:"in_stock", last_movement_date:"2024-03-20" },
  { id:"11", name:"ProSim 8 (ใหม่ — รอตรวจ)", brand:"Fluke Biomedical", category:"sellable", has_serial:true, serial_number:"PS8-2024-STOCK-003", qty:1, min_qty:0, unit:"เครื่อง", status:"pending_inspection", has_al_case:true, last_movement_date:"2024-03-19" },
]

const MOCK_TRANSACTIONS: StockTransaction[] = [
  { id:"t1", item_id:"1", item_name:"Battery Pack ProSim 8", type:"in", qty:5, reference:"PO-2024-089", note:"สั่งจาก Fluke SG", date:"2024-03-01", approved_by:"Admin" },
  { id:"t2", item_id:"1", item_name:"Battery Pack ProSim 8", type:"out", qty:2, reference:"JOB-2024-001", note:"ใช้ซ่อม ProSim 8", date:"2024-03-10", approved_by:"Stock สมชาย" },
  { id:"t3", item_id:"3", item_name:"IDA6 Display Unit", type:"in", qty:1, reference:"PO-2024-078", date:"2024-02-20", approved_by:"Admin" },
  { id:"t4", item_id:"6", item_name:"Electrode Pad", type:"in", qty:20, reference:"PO-2024-091", note:"Consumables restock", date:"2024-03-12", approved_by:"Admin" },
  { id:"t5", item_id:"6", item_name:"Electrode Pad", type:"out", qty:5, reference:"JOB-2024-003", date:"2024-03-15", approved_by:"Stock สมชาย" },
]

const MOCK_BOOKINGS: Booking[] = [
  { id:"b1", item_id:"4", item_name:"ProSim 8 + SPOT Module", serial_number:"PS8-2024-NEW-001", sales_name:"คุณสมหมาย", customer_name:"โรงพยาบาลรามาธิบดี", booked_date:"2024-03-10", note:"รอลูกค้า approve PO" },
]

const MOCK_INTAKES: IntakeInspection[] = [
  { id:"int1", item_id:"11", item_name:"ProSim 8 (ใหม่)", serial_number:"PS8-2024-STOCK-003", po_number:"PO-2024-112", supplier:"Fluke Biomedical Asia", has_al_case:true, sent_by:"Stock วิชัย", sent_at:"2024-03-19", status:"pending" },
]

const SALES_STAFF = ["คุณสมหมาย","คุณวิภาพร","คุณธนากร","คุณพรรณิภา"]

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

// ── New Machine Receive Dialog (→ sends to Services for inspection) ─────────────
function NewMachineReceiveDialog({ onClose, onConfirm }: {
  onClose: () => void
  onConfirm: (data: { model: string; serial_number: string; po_number: string; supplier: string; has_al_case: boolean; child_sns: ChildSN[] }) => void
}) {
  const [form, setForm] = useState({ model:"", serial_number:"", po_number:"", supplier:"", has_al_case:false, child_sns:[] as ChildSN[] })
  const [isParentChild, setIsParentChild] = useState(false)
  const [newChild, setNewChild] = useState({ sn:"", label:"" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm bg-white"

  function addChild() {
    if (!newChild.sn) return
    setForm(f => ({ ...f, child_sns: [...f.child_sns, { ...newChild }] }))
    setNewChild({ sn:"", label:"" })
  }
  function removeChild(sn: string) {
    setForm(f => ({ ...f, child_sns: f.child_sns.filter(c => c.sn !== sn) }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm({ ...form, child_sns: isParentChild ? form.child_sns : [] })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <h3 className="font-bold text-lg flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-green-500"/>รับเครื่องใหม่เข้า (→ ส่งตรวจ)</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>

        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-700 font-semibold">⚠️ เครื่องใหม่จะถูกส่งให้ Services ตรวจเช็คก่อน จึงจะตัดเข้า Stock</p>
          <p className="text-xs text-blue-500 mt-0.5">สถานะจะอยู่ที่ "รอตรวจ" จนกว่า Services จะ Approve</p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Model *</label><input required value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} className={inp} placeholder="เช่น ProSim 8"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Serial Number *</label><input required value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN เครื่อง"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number *</label><input required value={form.po_number} onChange={e=>setForm(f=>({...f,po_number:e.target.value}))} className={inp} placeholder="PO-2024-XXX"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label><input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className={inp} placeholder="ชื่อ Supplier"/></div>
          </div>

          {/* Al Case */}
          <button type="button" onClick={()=>setForm(f=>({...f,has_al_case:!f.has_al_case}))}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.has_al_case?"bg-amber-50 border-amber-300":"bg-gray-50 border-gray-200"}`}>
            <Box className={`h-5 w-5 ${form.has_al_case?"text-amber-500":"text-gray-400"}`}/>
            <div className="flex-1 text-left">
              <p className={`text-sm font-semibold ${form.has_al_case?"text-amber-800":"text-gray-600"}`}>มีกล่อง Aluminium Case</p>
              <p className="text-xs text-gray-400">ระบบจะตัด Al Case Stock +1 อัตโนมัติ</p>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${form.has_al_case?"bg-amber-500":"bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.has_al_case?"translate-x-5":"translate-x-1"}`}/>
            </div>
          </button>

          {/* Parent-Child SN */}
          <button type="button" onClick={()=>setIsParentChild(v=>!v)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${isParentChild?"bg-violet-50 border-violet-300":"bg-gray-50 border-gray-200"}`}>
            <Link2 className={`h-5 w-5 ${isParentChild?"text-violet-500":"text-gray-400"}`}/>
            <div className="flex-1 text-left">
              <p className={`text-sm font-semibold ${isParentChild?"text-violet-800":"text-gray-600"}`}>มี Child SN (IDA6 / ProSim8 + SPOT)</p>
              <p className="text-xs text-gray-400">เครื่องที่มีหลาย SN ผูกกัน เช่น IDA6 Module, SPOT Module</p>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${isParentChild?"bg-violet-500":"bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isParentChild?"translate-x-5":"translate-x-1"}`}/>
            </div>
          </button>

          {isParentChild && (
            <div className="p-4 bg-violet-50 rounded-2xl border border-violet-200 space-y-3">
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Child SNs</p>
              {form.child_sns.map(c => (
                <div key={c.sn} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-violet-200">
                  <div className="flex-1">
                    <p className="font-mono text-xs font-bold text-violet-700">{c.sn}</p>
                    <p className="text-xs text-gray-500">{c.label}</p>
                  </div>
                  <button type="button" onClick={()=>removeChild(c.sn)} className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"><X className="h-3.5 w-3.5"/></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newChild.sn} onChange={e=>setNewChild(v=>({...v,sn:e.target.value}))} className="flex-1 px-3 py-2 rounded-xl border border-violet-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Child SN"/>
                <input value={newChild.label} onChange={e=>setNewChild(v=>({...v,label:e.target.value}))} className="flex-1 px-3 py-2 rounded-xl border border-violet-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="ชื่อ เช่น SPOT Module"/>
                <button type="button" onClick={addChild} className="px-3 py-2 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600">+</button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600">
              ส่งให้ Services ตรวจ →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Dispatch to Customer Dialog (Stock Out with LLM customer search) ─────────
function DispatchToCustomerDialog({ item, onClose, onConfirm }: {
  item: StockItem; onClose: () => void
  onConfirm: (data: { customer_id: string; customer_org: string; customer_name: string; with_al_case: boolean; sales_name: string; booking: boolean }) => void
}) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<typeof CUSTOMER_DB>([])
  const [selected, setSelected] = useState<typeof CUSTOMER_DB[0] | null>(null)
  const [withAlCase, setWithAlCase] = useState(!!item.has_al_case)
  const [salesName, setSalesName] = useState("")
  const [isBooking, setIsBooking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  function handleQuery(v: string) {
    setQuery(v)
    setSelected(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (v.trim().length < 1) { setSuggestions([]); return }
      // LLM-style fuzzy match from DB
      const q = v.toLowerCase()
      setSuggestions(CUSTOMER_DB.filter(c =>
        c.org.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q)
      ).slice(0, 5))
    }, 200)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected && !query.trim()) return
    onConfirm({
      customer_id: selected?.id ?? "",
      customer_org: selected?.org ?? query,
      customer_name: selected?.contact ?? "",
      with_al_case: withAlCase,
      sales_name: salesName,
      booking: isBooking,
    })
    onClose()
  }

  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2"><Send className="h-5 w-5 text-blue-500"/>ตัดจ่ายให้ลูกค้า</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>

        <div className="p-3 bg-blue-50 rounded-2xl mb-4 border border-blue-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
          {item.child_sns && item.child_sns.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.child_sns.map(c => (
                <span key={c.sn} className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full font-mono">{c.label}: {c.sn}</span>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* LLM Customer Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ค้นหาลูกค้า (พิมพ์ชื่อ / รพ.)</label>
            <div className="relative">
              <input value={selected ? selected.org : query} onChange={e=>handleQuery(e.target.value)}
                className={`${inp} ${selected ? "bg-green-50 border-green-300" : ""}`}
                placeholder="พิมพ์ชื่อโรงพยาบาล..."/>
              {selected && (
                <button type="button" onClick={()=>{setSelected(null);setQuery("")}} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100">
                  <X className="h-3.5 w-3.5 text-gray-400"/>
                </button>
              )}
            </div>
            {/* Suggestions */}
            {!selected && suggestions.length > 0 && (
              <div className="mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                {suggestions.map(c => (
                  <button key={c.id} type="button" onClick={()=>{setSelected(c);setSuggestions([])}}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors border-b border-gray-100 last:border-0">
                    <div className="p-1.5 bg-blue-100 rounded-lg mt-0.5"><Building2 className="h-3.5 w-3.5 text-blue-600"/></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.org}</p>
                      <p className="text-xs text-gray-400">{c.contact}</p>
                    </div>
                    <span className="ml-auto text-xs text-green-600 font-bold mt-1">ในระบบ ✓</span>
                  </button>
                ))}
              </div>
            )}
            {!selected && query.length > 1 && suggestions.length === 0 && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3"/>ไม่พบลูกค้าในระบบ — กรุณาลงทะเบียนก่อน หรือพิมพ์ชื่อเต็มเพื่อดำเนินการต่อ
              </p>
            )}
            {selected && (
              <div className="mt-2 p-3 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-700 font-semibold">✓ พบในระบบ</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{selected.org}</p>
                <p className="text-xs text-gray-500">{selected.contact} · {selected.tel}</p>
              </div>
            )}
          </div>

          {/* Al Case */}
          {item.has_al_case !== undefined && (
            <button type="button" onClick={()=>setWithAlCase(v=>!v)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${withAlCase?"bg-amber-50 border-amber-300":"bg-gray-50 border-gray-200"}`}>
              <Box className={`h-5 w-5 shrink-0 ${withAlCase?"text-amber-500":"text-gray-400"}`}/>
              <div className="flex-1 text-left">
                <p className={`text-sm font-semibold ${withAlCase?"text-amber-800":"text-gray-600"}`}>ส่งกล่อง Aluminium ไปด้วย</p>
                <p className="text-xs text-gray-400">ตัดกล่อง Al Case Stock -1 อัตโนมัติ</p>
              </div>
              <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${withAlCase?"bg-amber-500":"bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${withAlCase?"translate-x-4":"translate-x-0.5"}`}/>
              </div>
            </button>
          )}

          {/* Sales Booking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales ที่ดูแล</label>
            <select value={salesName} onChange={e=>setSalesName(e.target.value)} className={inp}>
              <option value="">-- ไม่ระบุ --</option>
              {SALES_STAFF.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Booking or Dispatch now */}
          <div className="flex gap-2">
            {([["dispatch","ตัดออกทันที","bg-blue-500 border-blue-500 text-white",""],["booking","Booking (จองไว้ก่อน)","bg-orange-500 border-orange-500 text-white",""]] as [string,string,string,string][]).map(([v,l,ac])=>(
              <button key={v} type="button" onClick={()=>setIsBooking(v==="booking")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${(v==="booking"&&isBooking)||(v==="dispatch"&&!isBooking) ? ac : "border-gray-200 text-gray-500 bg-white"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${isBooking?"bg-orange-500 hover:bg-orange-600":"bg-blue-500 hover:bg-blue-600"}`}>
              {isBooking ? "บันทึก Booking" : "ตัดออก / Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Dispatch to Services Dialog ───────────────────────────────────────────────
function DispatchDialog({ item, onClose, onConfirm }: { item: StockItem; onClose: () => void; onConfirm: (d: DispatchForm) => void }) {
  const [form, setForm] = useState<DispatchForm>({ item, job_type:"repair", customer_org:"", customer_name:"", symptom:"" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e: React.FormEvent) { e.preventDefault(); onConfirm(form); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2"><Send className="h-5 w-5 text-blue-500"/>ส่งงานไป Services</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>
        <div className="p-3 bg-blue-50 rounded-2xl mb-4 border border-blue-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทงาน</label>
            <div className="flex gap-2">
              {([["repair","🔧 Repair"],["calibration","📐 Calibration"]] as const).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,job_type:v}))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.job_type===v?v==="repair"?"border-blue-500 bg-blue-50 text-blue-700":"border-teal-500 bg-teal-50 text-teal-700":"border-gray-200 text-gray-500"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วยงาน *</label><input required value={form.customer_org} onChange={e=>setForm(f=>({...f,customer_org:e.target.value}))} className={inp} placeholder="ชื่อโรงพยาบาล / หน่วยงาน"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ผู้ติดต่อ</label><input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} className={inp} placeholder="ชื่อผู้ติดต่อ"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">อาการ / เหตุผล *</label><textarea required value={form.symptom} onChange={e=>setForm(f=>({...f,symptom:e.target.value}))} className={`${inp} resize-none`} rows={3} placeholder="อาการเสียหรือเหตุผลที่ส่งซ่อม/สอบเทียบ"/></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">ส่งงาน Services</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Booking Dialog ────────────────────────────────────────────────────────
function AddBookingDialog({ items, onClose, onSave }: { items: StockItem[]; onClose:()=>void; onSave:(b:Booking)=>void }) {
  const serialItems = items.filter(i=>i.has_serial&&i.serial_number&&(i.status==="in_stock"||i.status==="reserved"))
  const [form, setForm] = useState({ item_id:"", sales_name:"", customer_name:"", note:"" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white"
  const selectedItem = serialItems.find(i=>i.id===form.item_id)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem) return
    onSave({ id:Date.now().toString(), item_id:form.item_id, item_name:selectedItem.name, serial_number:selectedItem.serial_number, sales_name:form.sales_name, customer_name:form.customer_name, booked_date:new Date().toISOString().split("T")[0], note:form.note })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2"><Bookmark className="h-5 w-5 text-orange-500"/>เพิ่มการ Booking</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">เลือกสินค้า (SN) *</label><select required value={form.item_id} onChange={e=>setForm(f=>({...f,item_id:e.target.value}))} className={inp}><option value="">-- เลือก SN --</option>{serialItems.map(i=><option key={i.id} value={i.id}>{i.name} — SN: {i.serial_number}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Sales ที่ Booking *</label><select required value={form.sales_name} onChange={e=>setForm(f=>({...f,sales_name:e.target.value}))} className={inp}><option value="">-- เลือก Sales --</option>{SALES_STAFF.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ลูกค้า *</label><input required value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} className={inp} placeholder="ชื่อโรงพยาบาล / หน่วยงาน"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} className={inp} placeholder="เช่น รอ PO, นัดส่งวันที่..."/></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">บันทึก Booking</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddItemDialog({ item, onClose, onSave }: { item:Partial<StockItem>|null; onClose:()=>void; onSave:(d:Partial<StockItem>)=>void }) {
  const [form, setForm] = useState({ name:item?.name??"", brand:item?.brand??"", category:item?.category??"spare_part" as StockCategory, has_serial:item?.has_serial??false, serial_number:item?.serial_number??"", qty:item?.qty??0, min_qty:item?.min_qty??0, unit:item?.unit??"ชิ้น", has_al_case:item?.has_al_case??false })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e:React.FormEvent){e.preventDefault();onSave({...item,...form});onClose()}
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <h2 className="font-bold text-lg">{item?.id?"แก้ไขสินค้า":"เพิ่มสินค้า"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อสินค้า *</label><input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp} placeholder="ชื่อ Part / สินค้า"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">แบรนด์</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} className={inp} placeholder="Fluke Biomedical"/></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภท</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CAT_LABELS) as StockCategory[]).map(c=>(
                <button key={c} type="button" onClick={()=>setForm(f=>({...f,category:c}))}
                  className={`p-2.5 rounded-xl border-2 text-xs font-semibold text-center transition-all ${form.category===c?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-500"}`}>
                  {CAT_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวน</label><input type="number" min={0} value={form.qty} onChange={e=>setForm(f=>({...f,qty:Number(e.target.value)}))} className={inp}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Min Stock</label><input type="number" min={0} value={form.min_qty} onChange={e=>setForm(f=>({...f,min_qty:Number(e.target.value)}))} className={inp}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วย</label><input value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className={inp} placeholder="ชิ้น"/></div>
          </div>
          <button type="button" onClick={()=>setForm(f=>({...f,has_serial:!f.has_serial}))}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.has_serial?"bg-violet-50 border-violet-300":"bg-gray-50 border-gray-200"}`}>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${form.has_serial?"bg-violet-500":"bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.has_serial?"translate-x-5":"translate-x-1"}`}/>
            </div>
            <p className={`text-sm font-semibold ${form.has_serial?"text-violet-800":"text-gray-700"}`}>มี Serial Number</p>
          </button>
          {form.has_serial&&<div><label className="block text-sm font-medium text-gray-700 mb-1.5">Serial Number</label><input value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN ของสินค้า"/></div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">{item?.id?"บันทึก":"เพิ่มสินค้า"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReceiveDialog({ items, onClose, onSave }: { items:StockItem[]; onClose:()=>void; onSave:(tx:StockTransaction)=>void }) {
  const [form, setForm] = useState({ item_id:"", qty:1, po_number:"", supplier:"", note:"", type:"return" as "return"|"rma_return" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm bg-white"
  function submit(e:React.FormEvent){
    e.preventDefault()
    const item=items.find(i=>i.id===form.item_id)
    if(!item)return
    onSave({id:Date.now().toString(),item_id:form.item_id,item_name:item.name,type:"in",qty:form.qty,reference:form.po_number,note:`${form.supplier?form.supplier+" · ":""}${form.note}`,date:new Date().toISOString().split("T")[0],approved_by:"Admin"})
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">รับสินค้าคืน / RMA กลับ</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4"/></button>
        </div>
        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
          <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5"/>
          <p className="text-xs text-blue-700">สำหรับ <strong>เครื่องคืน / RMA กลับ</strong> เท่านั้น · หากเป็นเครื่อง<strong>ใหม่</strong> กรุณาใช้ปุ่ม "รับเครื่องใหม่"</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ประเภทการรับ</label>
            <div className="flex gap-2">
              {([["return","รับคืนจากลูกค้า"],["rma_return","RMA กลับมา"]] as ["return"|"rma_return",string][]).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,type:v}))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.type===v?"border-green-500 bg-green-50 text-green-700":"border-gray-200 text-gray-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">สินค้า *</label><select required value={form.item_id} onChange={e=>setForm(f=>({...f,item_id:e.target.value}))} className={inp}><option value="">-- เลือกสินค้า --</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}{i.serial_number?` (SN: ${i.serial_number})`:""}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวน</label><input type="number" min={1} required value={form.qty} onChange={e=>setForm(f=>({...f,qty:Number(e.target.value)}))} className={inp}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">PO/Ref Number *</label><input required value={form.po_number} onChange={e=>setForm(f=>({...f,po_number:e.target.value}))} className={inp} placeholder="PO-2024-XXX"/></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier / แหล่งที่มา</label><input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className={inp} placeholder="ชื่อ Supplier"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} className={inp}/></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600">บันทึกรับเข้า</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Dead Stock Analysis ───────────────────────────────────────────────────────
function DeadStockTab({ items }: { items: StockItem[] }) {
  const today = new Date("2024-03-20")
  function daysSince(dateStr: string): number {
    const d = new Date(dateStr)
    return Math.floor((today.getTime() - d.getTime()) / 86400000)
  }
  const analyzed = items
    .filter(i => i.status !== "sold" && i.last_movement_date)
    .map(i => ({
      ...i,
      days: daysSince(i.last_movement_date!),
      risk: daysSince(i.last_movement_date!) >= 90 ? "dead" : daysSince(i.last_movement_date!) >= 60 ? "slow" : "active"
    }))
    .sort((a,b) => b.days - a.days)

  const dead = analyzed.filter(i => i.risk === "dead")
  const slow = analyzed.filter(i => i.risk === "slow")
  const active = analyzed.filter(i => i.risk === "active")

  const RISK_CONFIG = {
    dead: { color:"bg-red-100 text-red-700", badge:"Dead Stock", bar:"bg-red-400" },
    slow: { color:"bg-yellow-100 text-yellow-700", badge:"Slow Moving", bar:"bg-yellow-400" },
    active: { color:"bg-green-100 text-green-700", badge:"Active", bar:"bg-green-400" },
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {([
          ["dead", dead.length, "Dead Stock", "≥ 90 วัน", "bg-red-50 border-red-200 text-red-700"],
          ["slow", slow.length, "Slow Moving", "60–89 วัน", "bg-yellow-50 border-yellow-200 text-yellow-700"],
          ["active", active.length, "Active", "< 60 วัน", "bg-green-50 border-green-200 text-green-700"],
        ] as [string,number,string,string,string][]).map(([k,n,label,sub,cls])=>(
          <div key={k} className={`p-5 rounded-3xl border-2 ${cls}`}>
            <p className="text-3xl font-black mb-1">{n}</p>
            <p className="font-bold text-sm">{label}</p>
            <p className="text-xs opacity-70">{sub} ไม่มีการเคลื่อนไหว</p>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-start gap-3">
        <TrendingDown className="h-5 w-5 text-gray-500 shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-semibold text-gray-700">Stock Turnover Rate Analysis</p>
          <p className="text-xs text-gray-500 mt-0.5">วิเคราะห์จากวันที่มีการเคลื่อนไหวล่าสุด (รับเข้า/เบิกออก) · Dead Stock ≥ 90 วัน แนะนำให้แจ้ง Procurement ลดการสั่งซื้อ</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{["สินค้า","ประเภท","จำนวน","เคลื่อนไหวล่าสุด","ไม่มีเคลื่อนไหว","สถานะ",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {analyzed.map(item => {
              const cfg = RISK_CONFIG[item.risk as keyof typeof RISK_CONFIG]
              const maxDays = 180
              const barWidth = Math.min(100, (item.days / maxDays) * 100)
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    {item.serial_number && <p className="font-mono text-xs text-blue-600">{item.serial_number}</p>}
                  </td>
                  <td className="px-4 py-3"><Pill label={CAT_LABELS[item.category]} color={CAT_COLORS[item.category]}/></td>
                  <td className="px-4 py-3 font-bold text-gray-900">{item.qty} {item.unit}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.last_movement_date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.bar}`} style={{width:`${barWidth}%`}}/>
                      </div>
                      <span className={`text-xs font-bold ${item.risk==="dead"?"text-red-600":item.risk==="slow"?"text-yellow-600":"text-green-600"}`}>{item.days} วัน</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Pill label={cfg.badge} color={cfg.color}/></td>
                  <td className="px-4 py-3">
                    {item.risk === "dead" && (
                      <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3"/>แจ้ง Procurement
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>(MOCK_ITEMS)
  const [transactions, setTransactions] = useState<StockTransaction[]>(MOCK_TRANSACTIONS)
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS)
  const [intakes, setIntakes] = useState<IntakeInspection[]>(MOCK_INTAKES)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState<StockCategory|"all">("all")
  const [dispatchDialog, setDispatchDialog] = useState<StockItem|null>(null)
  const [dispatchCustomerDialog, setDispatchCustomerDialog] = useState<StockItem|null>(null)
  const [addDialog, setAddDialog] = useState<{open:boolean;data:Partial<StockItem>|null}>({open:false,data:null})
  const [receiveDialog, setReceiveDialog] = useState(false)
  const [newMachineDialog, setNewMachineDialog] = useState(false)
  const [bookingDialog, setBookingDialog] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string|null>(null)

  const lowStock = items.filter(i=>i.qty<i.min_qty&&i.status==="in_stock")
  const pendingInspection = items.filter(i=>i.status==="pending_inspection")
  const demoOnLoan = items.filter(i=>i.category==="demo"&&i.status==="on_loan")
  const today = new Date().toISOString().split("T")[0]

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(()=>setSuccessMsg(null), 4000)
  }

  const filtered = items.filter(i=>{
    const q=search.toLowerCase()
    return (i.name.toLowerCase().includes(q)||(i.serial_number||"").toLowerCase().includes(q)||i.brand.toLowerCase().includes(q)) &&
      (filterCat==="all"||i.category===filterCat)
  })

  function returnDemo(item: StockItem) {
    setItems(p=>p.map(i=>i.id===item.id?{...i,status:"in_stock",loaned_to:undefined,loan_due:undefined}:i))
  }

  function saveItem(data: Partial<StockItem>) {
    if(data.id){setItems(p=>p.map(i=>i.id===data.id?{...i,...data}as StockItem:i))}
    else{setItems(p=>[...p,{id:Date.now().toString(),status:"in_stock",...data}as StockItem])}
  }

  function addTransaction(tx: StockTransaction) {
    setTransactions(p=>[tx,...p])
    setItems(p=>p.map(i=>i.id===tx.item_id?{...i,qty:i.qty+tx.qty}:i))
  }

  function handleDispatch(form: DispatchForm) {
    showSuccess(`สร้างงาน ${form.job_type==="repair"?"Repair":"Calibration"} สำหรับ ${form.customer_org} เรียบร้อยแล้ว`)
  }

  function handleDispatchToCustomer(item: StockItem, data: {customer_id:string;customer_org:string;customer_name:string;with_al_case:boolean;sales_name:string;booking:boolean}) {
    if (data.booking) {
      // Add booking
      const b: Booking = {
        id: Date.now().toString(), item_id:item.id, item_name:item.name,
        serial_number:item.serial_number, sales_name:data.sales_name,
        customer_name:data.customer_org, booked_date:today,
        note:`Booked by ${data.sales_name||"Stock"}`
      }
      setBookings(p=>[...p,b])
      setItems(p=>p.map(i=>i.id===item.id?{...i,status:"reserved",reserved_by_sales:data.sales_name,reserved_for_customer:data.customer_org}:i))
      showSuccess(`Booking บันทึกแล้ว — ${item.name} → ${data.customer_org}`)
    } else {
      // Dispatch now
      const tx: StockTransaction = {
        id:Date.now().toString(), item_id:item.id, item_name:item.name, type:"out",
        qty:1, reference:`DISPATCH-${Date.now().toString().slice(-6)}`,
        note:`ส่งให้ ${data.customer_org}${data.with_al_case?" (พร้อมกล่อง Al)":""}`,
        date:today, approved_by:data.sales_name||"Stock"
      }
      setTransactions(p=>[tx,...p])
      setItems(p=>p.map(i=>i.id===item.id?{...i,status:"sold",qty:Math.max(0,i.qty-1),reserved_by_sales:undefined,reserved_for_customer:undefined}:i))
      showSuccess(`ตัดออกเรียบร้อย — ${item.name} → ${data.customer_org}${data.with_al_case?" (ตัดกล่อง Al -1)":""}`)
    }
    setBookings(b=>b.filter(x=>x.item_id!==item.id||!data.booking))
  }

  function handleNewMachineReceive(data: {model:string;serial_number:string;po_number:string;supplier:string;has_al_case:boolean;child_sns:ChildSN[]}) {
    const newItem: StockItem = {
      id:Date.now().toString(), name:`${data.model} (สต็อกใหม่)`, brand:"—",
      category:"sellable", has_serial:true, serial_number:data.serial_number,
      qty:1, min_qty:0, unit:"เครื่อง", status:"pending_inspection",
      has_al_case:data.has_al_case,
      child_sns:data.child_sns.length>0?data.child_sns:undefined,
      last_movement_date:today,
    }
    setItems(p=>[...p,newItem])
    const intake: IntakeInspection = {
      id:Date.now().toString(), item_id:newItem.id,
      item_name:data.model, serial_number:data.serial_number,
      po_number:data.po_number, supplier:data.supplier,
      has_al_case:data.has_al_case, sent_by:"Stock", sent_at:today, status:"pending"
    }
    setIntakes(p=>[...p,intake])
    // Update notification count
    const cur = getNotificationCounts()
    setNotificationCounts({ inspectionPending: cur.inspectionPending + 1 })
    showSuccess(`ส่งเครื่อง ${data.model} ให้ Services ตรวจเช็คแล้ว — รอผล`)
  }

  function removeBooking(id: string) {
    const b=bookings.find(x=>x.id===id)
    if(b){
      setItems(p=>p.map(i=>i.id===b.item_id?{...i,status:"in_stock",reserved_by_sales:undefined,reserved_for_customer:undefined}:i))
      setBookings(p=>p.filter(x=>x.id!==id))
    }
  }

  function addBooking(b: Booking) {
    setBookings(p=>[...p,b])
    setItems(p=>p.map(i=>i.id===b.item_id?{...i,status:"reserved",reserved_by_sales:b.sales_name,reserved_for_customer:b.customer_name}:i))
  }

  const catCounts=(Object.keys(CAT_LABELS) as StockCategory[]).reduce((acc,c)=>{acc[c]=items.filter(i=>i.category===c).length;return acc},{} as Record<StockCategory,number>)

  const TABS = [
    { id:"all" as Tab, label:"สต็อกทั้งหมด" },
    { id:"receive" as Tab, label:"รับเข้า / PO" },
    { id:"booking" as Tab, label:`Booking (${bookings.length})` },
    { id:"demo" as Tab, label:"Demo Tracker" },
    { id:"dead_stock" as Tab, label:"Dead Stock" },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คลังสินค้า</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} รายการ
            {lowStock.length>0&&<> · <span className="text-red-500 font-semibold">{lowStock.length} รายการต่ำกว่า Min</span></>}
            {pendingInspection.length>0&&<> · <span className="text-yellow-600 font-semibold">{pendingInspection.length} รอตรวจ</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setNewMachineDialog(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold transition-colors">
            <ArrowDownCircle className="h-4 w-4"/>รับเครื่องใหม่
          </button>
          <button onClick={()=>setReceiveDialog(true)} className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-sm font-bold transition-colors">
            <ArrowDownCircle className="h-4 w-4"/>รับคืน / RMA
          </button>
          <button onClick={()=>setAddDialog({open:true,data:{}})} className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-colors">
            <Plus className="h-4 w-4"/>เพิ่ม
          </button>
        </div>
      </div>

      {successMsg&&(
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl mb-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0"/>
          <p className="text-sm text-green-700 font-semibold">{successMsg}</p>
        </div>
      )}

      {pendingInspection.length>0&&(
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl mb-4">
          <PackageCheck className="h-5 w-5 text-yellow-500 shrink-0"/>
          <p className="text-sm text-yellow-800 font-semibold flex-1">
            {pendingInspection.length} เครื่องกำลังรอ Services ตรวจเช็ค: {pendingInspection.map(i=>i.name.replace(" (สต็อกใหม่)","")).join(", ")}
          </p>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-5 w-fit">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t.id?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: All Stock ── */}
      {tab==="all"&&(
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {lowStock.length>0&&(
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0"/>
              <p className="text-sm text-red-700 font-semibold">{lowStock.length} รายการ Stock ต่ำกว่า Minimum: {lowStock.map(i=>i.name).join(", ")}</p>
            </div>
          )}
          <div className="grid grid-cols-6 gap-3">
            {(Object.keys(CAT_LABELS) as StockCategory[]).map(c=>(
              <button key={c} onClick={()=>setFilterCat(filterCat===c?"all":c)}
                className={`p-3 rounded-2xl border-2 text-center transition-all ${filterCat===c?"border-blue-500 bg-blue-50":"border-gray-200 bg-white hover:border-gray-300"}`}>
                <div className={`inline-flex p-2 rounded-xl mb-1.5 ${CAT_COLORS[c].split(" ")[0]} bg-opacity-50`}>{CAT_ICONS[c]}</div>
                <p className="text-xs font-semibold text-gray-700">{CAT_LABELS[c]}</p>
                <p className="text-lg font-black text-gray-900">{catCounts[c]}</p>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" placeholder="ค้นหาสินค้า / SN / แบรนด์"/>
          </div>
          <div className="flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ชื่อสินค้า / SN","แบรนด์","ประเภท","คงเหลือ","Min","สถานะ",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item=>{
                  const isLow=item.qty<item.min_qty
                  const isPending=item.status==="pending_inspection"
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isLow?"bg-red-50/50":""} ${isPending?"bg-yellow-50/50":""}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.has_serial&&item.serial_number
                          ?<p className="font-mono text-xs text-blue-600 mt-0.5">SN: {item.serial_number}</p>
                          :item.has_serial&&<p className="text-xs text-gray-400 italic">ยังไม่มี SN</p>
                        }
                        {item.child_sns&&item.child_sns.length>0&&(
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.child_sns.map(c=>(
                              <span key={c.sn} className="px-1.5 py-0.5 bg-violet-100 text-violet-600 text-[10px] rounded font-mono">{c.label}</span>
                            ))}
                          </div>
                        )}
                        {item.has_al_case&&<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded mt-0.5"><Box className="h-2.5 w-2.5"/>Al Case</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{item.brand}</td>
                      <td className="px-4 py-3"><Pill label={CAT_LABELS[item.category]} color={CAT_COLORS[item.category]}/></td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-base ${isLow?"text-red-600":"text-gray-900"}`}>{item.qty}</span>
                        <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                        {isLow&&<AlertTriangle className="h-3.5 w-3.5 text-red-500 inline ml-1"/>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{item.min_qty}</td>
                      <td className="px-4 py-3">
                        <Pill label={STATUS_LABELS[item.status]} color={STATUS_COLORS[item.status]}/>
                        {item.reserved_by_sales&&<p className="text-xs text-orange-600 mt-0.5">By {item.reserved_by_sales}</p>}
                        {item.reserved_for_customer&&<p className="text-xs text-gray-500">{item.reserved_for_customer}</p>}
                        {item.loaned_to&&<p className="text-xs text-blue-600 mt-0.5">{item.loaned_to}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(item.status==="in_stock"||item.status==="reserved")&&(
                            <>
                              <button onClick={()=>setDispatchCustomerDialog(item)} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1">
                                <Send className="h-3 w-3"/>ส่งลูกค้า
                              </button>
                              <button onClick={()=>setDispatchDialog(item)} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1">
                                <Wrench className="h-3 w-3"/>Services
                              </button>
                            </>
                          )}
                          {item.status==="on_loan"&&<button onClick={()=>returnDemo(item)} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors">คืนเครื่อง</button>}
                          <button onClick={()=>setAddDialog({open:true,data:item})} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ChevronRight className="h-3.5 w-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Receive/PO ── */}
      {tab==="receive"&&(
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Pending Inspection list */}
          {pendingInspection.length>0&&(
            <div className="bg-yellow-50 rounded-3xl border-2 border-yellow-200 p-5">
              <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2"><PackageCheck className="h-4 w-4"/>เครื่องใหม่รอ Services ตรวจเช็ค ({pendingInspection.length})</h3>
              <div className="space-y-2">
                {pendingInspection.map(item=>(
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-yellow-200">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                      {item.serial_number&&<p className="font-mono text-xs text-blue-600">SN: {item.serial_number}</p>}
                    </div>
                    <Pill label="รอตรวจ" color={STATUS_COLORS.pending_inspection}/>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">ประวัติการรับเข้า / เบิกออก</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["วันที่","สินค้า","ประเภท","จำนวน","PO / อ้างอิง","หมายเหตุ","อนุมัติโดย"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(tx=>(
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{tx.item_name}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tx.type==="in"?"bg-green-100 text-green-700":tx.type==="out"?"bg-red-100 text-red-700":"bg-gray-100 text-gray-600"}`}>{tx.type==="in"?"รับเข้า":tx.type==="out"?"เบิกออก":"ปรับ"}</span></td>
                    <td className="px-4 py-3 font-bold">{tx.type==="out"?"-":"+"}{tx.qty}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{tx.reference}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.note||"—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.approved_by||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Booking ── */}
      {tab==="booking"&&(
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">การ Booking (Reserved) ของ Sales</h3>
              <p className="text-sm text-gray-500 mt-0.5">Stock เป็นผู้ตั้งสถานะ Reserved · แสดง Sales ที่จองและลูกค้าเป้าหมาย</p>
            </div>
            <button onClick={()=>setBookingDialog(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-colors">
              <Plus className="h-4 w-4"/>เพิ่ม Booking
            </button>
          </div>
          {bookings.length===0?(
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Bookmark className="h-16 w-16 mb-3 opacity-30"/>
              <p className="text-sm">ยังไม่มีการ Booking</p>
            </div>
          ):(
            <div className="grid grid-cols-2 gap-4">
              {bookings.map(b=>(
                <div key={b.id} className="p-5 bg-white rounded-3xl border-2 border-orange-200 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-gray-900">{b.item_name}</p>
                      {b.serial_number&&<p className="font-mono text-xs text-blue-600 mt-0.5">SN: {b.serial_number}</p>}
                    </div>
                    <Pill label="Reserved" color={STATUS_COLORS.reserved}/>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 mb-3 space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">จองโดย</p>
                    <div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5 text-orange-400 shrink-0"/><span className="text-gray-600 text-xs">Sales:</span><span className="font-bold text-gray-900">{b.sales_name}</span></div>
                    <div className="flex items-center gap-2 text-sm"><Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0"/><span className="text-gray-600 text-xs">ลูกค้า:</span><span className="font-bold text-gray-900">{b.customer_name}</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-sm mb-4"><ClipboardList className="h-3.5 w-3.5 text-gray-400"/><span className="text-gray-500 text-xs">วันที่จอง: {b.booked_date}</span>{b.note&&<span className="text-gray-400 text-xs">· {b.note}</span>}</div>
                  <div className="flex gap-2">
                    <button onClick={()=>setDispatchDialog(items.find(i=>i.id===b.item_id)||null as any)} className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1">
                      <Send className="h-3 w-3"/>ส่ง Services
                    </button>
                    <button onClick={()=>removeBooking(b.id)} className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100">ยกเลิก</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Demo Tracker ── */}
      {tab==="demo"&&(
        <div className="flex-1 overflow-y-auto space-y-6">
          {demoOnLoan.length>0&&(
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Demo ที่ออกไปอยู่ ({demoOnLoan.length})</h3>
              <div className="grid grid-cols-2 gap-4">
                {demoOnLoan.map(item=>{
                  const overdue=item.loan_due?item.loan_due<today:false
                  return (
                    <div key={item.id} className={`p-5 rounded-3xl border-2 ${overdue?"bg-red-50 border-red-200":"bg-white border-gray-200"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="font-mono text-xs text-gray-500">SN: {item.serial_number}</p>
                        </div>
                        {overdue&&<span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold"><AlertTriangle className="h-3 w-3"/>เกินกำหนด</span>}
                      </div>
                      <div className="space-y-1.5 mb-4">
                        <p className="text-sm text-gray-700 font-semibold">{item.loaned_to}</p>
                        {item.loan_due&&<p className="text-xs text-gray-500">กำหนดคืน: <span className={overdue?"text-red-600 font-bold":""}>{item.loan_due}</span></p>}
                      </div>
                      <button onClick={()=>returnDemo(item)} className="w-full py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600">บันทึกคืน</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Demo ในคลัง</h3>
            <div className="grid grid-cols-3 gap-4">
              {items.filter(i=>i.category==="demo"&&i.status==="in_stock").map(item=>(
                <div key={item.id} className="p-5 bg-white rounded-3xl border border-gray-200">
                  <p className="font-bold text-gray-900 mb-0.5">{item.name}</p>
                  <p className="font-mono text-xs text-gray-500 mb-3">SN: {item.serial_number}</p>
                  <Pill label="In Stock" color={STATUS_COLORS.in_stock}/>
                </div>
              ))}
              {items.filter(i=>i.category==="demo").length===0&&<p className="text-gray-400 text-sm col-span-3 py-8 text-center">ยังไม่มี Demo Unit</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Dead Stock ── */}
      {tab==="dead_stock"&&(
        <div className="flex-1 overflow-y-auto">
          <DeadStockTab items={items}/>
        </div>
      )}

      {/* Dialogs */}
      {dispatchDialog&&<DispatchDialog item={dispatchDialog} onClose={()=>setDispatchDialog(null)} onConfirm={handleDispatch}/>}
      {dispatchCustomerDialog&&<DispatchToCustomerDialog item={dispatchCustomerDialog} onClose={()=>setDispatchCustomerDialog(null)} onConfirm={(data)=>handleDispatchToCustomer(dispatchCustomerDialog,data)}/>}
      {addDialog.open&&<AddItemDialog item={addDialog.data} onClose={()=>setAddDialog({open:false,data:null})} onSave={saveItem}/>}
      {receiveDialog&&<ReceiveDialog items={items} onClose={()=>setReceiveDialog(false)} onSave={addTransaction}/>}
      {newMachineDialog&&<NewMachineReceiveDialog onClose={()=>setNewMachineDialog(false)} onConfirm={handleNewMachineReceive}/>}
      {bookingDialog&&<AddBookingDialog items={items} onClose={()=>setBookingDialog(false)} onSave={addBooking}/>}
    </div>
  )
}
