"use client"

import { useState } from "react"
import { Package, Plus, Search, ArrowDownCircle, X, AlertTriangle, CheckCircle2, Wrench, FlaskConical, ShoppingCart, Zap, Drill, Camera, ChevronRight, Bookmark, Send, User, Building2, ClipboardList } from "lucide-react"

type StockCategory = "spare_part" | "module" | "sellable" | "consumable" | "tool" | "demo"
type ItemStatus = "in_stock" | "reserved" | "on_loan" | "on_rma" | "sold"
type Tab = "all" | "receive" | "booking" | "demo"

interface StockItem {
  id: string; name: string; brand: string; category: StockCategory
  has_serial: boolean; serial_number?: string; qty: number; min_qty: number; unit: string
  status: ItemStatus; loaned_to?: string; reserved_by_sales?: string; reserved_for_customer?: string; loan_due?: string
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

const CAT_LABELS: Record<StockCategory, string> = {
  spare_part: "อะไหล่", module: "Module", sellable: "สินค้าขาย",
  consumable: "วัสดุสิ้นเปลือง", tool: "เครื่องมือ", demo: "Demo Unit"
}
const CAT_COLORS: Record<StockCategory, string> = {
  spare_part: "bg-blue-100 text-blue-700", module: "bg-violet-100 text-violet-700",
  sellable: "bg-emerald-100 text-emerald-700", consumable: "bg-yellow-100 text-yellow-700",
  tool: "bg-gray-100 text-gray-700", demo: "bg-orange-100 text-orange-700"
}
const CAT_ICONS: Record<StockCategory, React.ReactNode> = {
  spare_part: <Wrench className="h-4 w-4" />, module: <FlaskConical className="h-4 w-4" />,
  sellable: <ShoppingCart className="h-4 w-4" />, consumable: <Zap className="h-4 w-4" />,
  tool: <Drill className="h-4 w-4" />, demo: <Camera className="h-4 w-4" />
}
const STATUS_COLORS: Record<ItemStatus, string> = {
  in_stock: "bg-emerald-100 text-emerald-700", reserved: "bg-orange-100 text-orange-700",
  on_loan: "bg-blue-100 text-blue-700", on_rma: "bg-gray-100 text-gray-500", sold: "bg-gray-100 text-gray-400"
}
const STATUS_LABELS: Record<ItemStatus, string> = {
  in_stock: "In Stock", reserved: "Reserved", on_loan: "On Loan", on_rma: "On RMA", sold: "Sold"
}

const MOCK_ITEMS: StockItem[] = [
  { id:"1", name:"Battery Pack ProSim 8", brand:"Fluke Biomedical", category:"spare_part", has_serial:false, qty:3, min_qty:5, unit:"ชิ้น", status:"in_stock" },
  { id:"2", name:"LCD Module ProSim 4", brand:"Fluke Biomedical", category:"spare_part", has_serial:false, qty:1, min_qty:2, unit:"ชิ้น", status:"in_stock" },
  { id:"3", name:"IDA6 Infusion Module", brand:"Fluke Biomedical", category:"module", has_serial:true, serial_number:"IDA6MOD-2023-0089", qty:1, min_qty:1, unit:"อัน", status:"in_stock" },
  { id:"4", name:"ProSim 8 + SPOT Module", brand:"Fluke Biomedical", category:"sellable", has_serial:true, serial_number:"PS8-2024-NEW-001", qty:1, min_qty:0, unit:"เครื่อง", status:"reserved", reserved_by_sales:"คุณสมหมาย", reserved_for_customer:"โรงพยาบาลรามาธิบดี" },
  { id:"5", name:"RaySafe X2 Solo", brand:"RaySafe", category:"sellable", has_serial:true, serial_number:"X2S-2024-001", qty:2, min_qty:1, unit:"เครื่อง", status:"in_stock" },
  { id:"6", name:"Electrode Pad (10 pcs)", brand:"Generic", category:"consumable", has_serial:false, qty:15, min_qty:20, unit:"แพ็ค", status:"in_stock" },
  { id:"7", name:"Calibration Fixture Set", brand:"TreatMed", category:"tool", has_serial:false, qty:2, min_qty:1, unit:"ชุด", status:"in_stock" },
  { id:"8", name:"ProSim 4 Demo", brand:"Fluke Biomedical", category:"demo", has_serial:true, serial_number:"PS4-DEMO-001", qty:1, min_qty:0, unit:"เครื่อง", status:"on_loan", loaned_to:"โรงพยาบาลขอนแก่น", loan_due:"2024-03-10" },
  { id:"9", name:"RaySafe 452 Full Kit", brand:"RaySafe", category:"sellable", has_serial:true, serial_number:"452-2024-001", qty:1, min_qty:0, unit:"ชุด", status:"on_rma" },
  { id:"10", name:"ESA 615 Demo", brand:"Fluke Biomedical", category:"demo", has_serial:true, serial_number:"ESA615-DEMO-001", qty:1, min_qty:0, unit:"เครื่อง", status:"in_stock" },
]

const MOCK_TRANSACTIONS: StockTransaction[] = [
  { id:"t1", item_id:"1", item_name:"Battery Pack ProSim 8", type:"in", qty:5, reference:"PO-2024-089", note:"สั่งจาก Fluke SG", date:"2024-03-01", approved_by:"Admin" },
  { id:"t2", item_id:"1", item_name:"Battery Pack ProSim 8", type:"out", qty:2, reference:"JOB-2024-001", note:"ใช้ซ่อม ProSim 8", date:"2024-03-10", approved_by:"Stock สมชาย" },
  { id:"t3", item_id:"3", item_name:"IDA6 Infusion Module", type:"in", qty:1, reference:"PO-2024-078", date:"2024-02-20", approved_by:"Admin" },
  { id:"t4", item_id:"6", item_name:"Electrode Pad", type:"in", qty:20, reference:"PO-2024-091", note:"Consumables restock", date:"2024-03-12", approved_by:"Admin" },
  { id:"t5", item_id:"6", item_name:"Electrode Pad", type:"out", qty:5, reference:"JOB-2024-003", date:"2024-03-15", approved_by:"Stock สมชาย" },
]

const MOCK_BOOKINGS: Booking[] = [
  { id:"b1", item_id:"4", item_name:"ProSim 8 + SPOT Module", serial_number:"PS8-2024-NEW-001", sales_name:"คุณสมหมาย", customer_name:"โรงพยาบาลรามาธิบดี", booked_date:"2024-03-10", note:"รอลูกค้า approve PO" },
]

const SALES_STAFF = ["คุณสมหมาย", "คุณวิภาพร", "คุณธนากร", "คุณพรรณิภา"]

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

// ── Dispatch to Services Dialog ───────────────────────────────────────────────
function DispatchDialog({ item, onClose, onConfirm }: { item: StockItem; onClose: () => void; onConfirm: (d: DispatchForm) => void }) {
  const [form, setForm] = useState<DispatchForm>({ item, job_type:"repair", customer_org:"", customer_name:"", symptom:"" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e: React.FormEvent) { e.preventDefault(); onConfirm(form); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2"><Send className="h-5 w-5 text-blue-500" /> ส่งงานไป Services</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3 bg-blue-50 rounded-2xl mb-4 border border-blue-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทงาน</label>
            <div className="flex gap-2">
              {([["repair","🔧 Repair"],["calibration","📐 Calibration"]] as const).map(([v,l]) => (
                <button key={v} type="button" onClick={() => setForm(f=>({...f,job_type:v}))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.job_type===v ? v==="repair" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-500"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วยงาน *</label>
            <input required value={form.customer_org} onChange={e=>setForm(f=>({...f,customer_org:e.target.value}))} className={inp} placeholder="ชื่อโรงพยาบาล / หน่วยงาน" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ผู้ติดต่อ</label>
            <input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} className={inp} placeholder="ชื่อผู้ติดต่อ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">อาการ / เหตุผล *</label>
            <textarea required value={form.symptom} onChange={e=>setForm(f=>({...f,symptom:e.target.value}))} className={`${inp} resize-none`} rows={3} placeholder="อาการเสียหรือเหตุผลที่ส่งซ่อม/สอบเทียบ" />
          </div>
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
function AddBookingDialog({ items, onClose, onSave }: { items: StockItem[]; onClose: () => void; onSave: (b: Booking) => void }) {
  const serialItems = items.filter(i => i.has_serial && i.serial_number && (i.status === "in_stock" || i.status === "reserved"))
  const [form, setForm] = useState({ item_id:"", sales_name:"", customer_name:"", note:"" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white"
  const selectedItem = serialItems.find(i => i.id === form.item_id)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem) return
    onSave({ id: Date.now().toString(), item_id: form.item_id, item_name: selectedItem.name, serial_number: selectedItem.serial_number, sales_name: form.sales_name, customer_name: form.customer_name, booked_date: new Date().toISOString().split("T")[0], note: form.note })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2"><Bookmark className="h-5 w-5 text-orange-500" /> เพิ่มการ Booking</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">เลือกสินค้า (SN) *</label>
            <select required value={form.item_id} onChange={e=>setForm(f=>({...f,item_id:e.target.value}))} className={inp}>
              <option value="">-- เลือก SN --</option>
              {serialItems.map(i => <option key={i.id} value={i.id}>{i.name} — SN: {i.serial_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales ที่ Booking *</label>
            <select required value={form.sales_name} onChange={e=>setForm(f=>({...f,sales_name:e.target.value}))} className={inp}>
              <option value="">-- เลือก Sales --</option>
              {SALES_STAFF.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ลูกค้า *</label>
            <input required value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} className={inp} placeholder="ชื่อโรงพยาบาล / หน่วยงาน" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label>
            <input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} className={inp} placeholder="เช่น รอ PO, นัดส่งวันที่..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">บันทึก Booking</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Item Dialog ───────────────────────────────────────────────────────────
function AddItemDialog({ item, onClose, onSave }: { item: Partial<StockItem>|null; onClose:()=>void; onSave:(d:Partial<StockItem>)=>void }) {
  const [form, setForm] = useState({ name: item?.name??"", brand: item?.brand??"", category: item?.category??"spare_part" as StockCategory, has_serial: item?.has_serial??false, serial_number: item?.serial_number??"", qty: item?.qty??0, min_qty: item?.min_qty??0, unit: item?.unit??"ชิ้น" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e: React.FormEvent) { e.preventDefault(); onSave({ ...item, ...form }); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <h2 className="font-bold text-lg">{item?.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อสินค้า *</label><input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp} placeholder="ชื่อ Part / สินค้า" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">แบรนด์</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} className={inp} placeholder="Fluke Biomedical" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภท</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CAT_LABELS) as StockCategory[]).map(c=>(
                <button key={c} type="button" onClick={()=>setForm(f=>({...f,category:c}))}
                  className={`p-2.5 rounded-xl border-2 text-xs font-semibold text-center transition-all ${form.category===c ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
                  {CAT_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวน</label><input type="number" min={0} value={form.qty} onChange={e=>setForm(f=>({...f,qty:Number(e.target.value)}))} className={inp} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Min Stock</label><input type="number" min={0} value={form.min_qty} onChange={e=>setForm(f=>({...f,min_qty:Number(e.target.value)}))} className={inp} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วย</label><input value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className={inp} placeholder="ชิ้น" /></div>
          </div>
          <button type="button" onClick={()=>setForm(f=>({...f,has_serial:!f.has_serial}))}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.has_serial ? "bg-violet-50 border-violet-300" : "bg-gray-50 border-gray-200"}`}>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${form.has_serial ? "bg-violet-500" : "bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.has_serial ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <p className={`text-sm font-semibold ${form.has_serial ? "text-violet-800" : "text-gray-700"}`}>มี Serial Number</p>
          </button>
          {form.has_serial && (
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Serial Number</label><input value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN ของสินค้า" /></div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">{item?.id ? "บันทึก" : "เพิ่มสินค้า"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Receive Dialog ────────────────────────────────────────────────────────────
function ReceiveDialog({ items, onClose, onSave }: { items: StockItem[]; onClose:()=>void; onSave:(tx:StockTransaction)=>void }) {
  const [form, setForm] = useState({ item_id:"", qty:1, po_number:"", supplier:"", note:"", type:"new" as "new"|"return"|"rma_return" })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm bg-white"
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const item = items.find(i=>i.id===form.item_id)
    if (!item) return
    onSave({ id: Date.now().toString(), item_id: form.item_id, item_name: item.name, type:"in", qty: form.qty, reference: form.po_number, note: `${form.supplier ? form.supplier+" · " : ""}${form.note}`, date: new Date().toISOString().split("T")[0], approved_by:"Admin" })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">รับสินค้าเข้า (PO)</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ประเภทการรับ</label>
            <div className="flex gap-2">
              {([["new","ซื้อใหม่"],["return","รับคืน"],["rma_return","RMA กลับมา"]] as ["new"|"return"|"rma_return", string][]).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,type:v}))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.type===v ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">สินค้า *</label>
            <select required value={form.item_id} onChange={e=>setForm(f=>({...f,item_id:e.target.value}))} className={inp}>
              <option value="">-- เลือกสินค้า --</option>
              {items.map(i=><option key={i.id} value={i.id}>{i.name}{i.serial_number ? ` (SN: ${i.serial_number})` : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวน</label><input type="number" min={1} required value={form.qty} onChange={e=>setForm(f=>({...f,qty:Number(e.target.value)}))} className={inp} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number *</label><input required value={form.po_number} onChange={e=>setForm(f=>({...f,po_number:e.target.value}))} className={inp} placeholder="PO-2024-XXX" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label><input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className={inp} placeholder="ชื่อ Supplier" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} className={inp} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600">บันทึกรับเข้า</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>(MOCK_ITEMS)
  const [transactions, setTransactions] = useState<StockTransaction[]>(MOCK_TRANSACTIONS)
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState<StockCategory|"all">("all")
  const [dispatchDialog, setDispatchDialog] = useState<StockItem|null>(null)
  const [addDialog, setAddDialog] = useState<{open:boolean; data:Partial<StockItem>|null}>({open:false,data:null})
  const [receiveDialog, setReceiveDialog] = useState(false)
  const [bookingDialog, setBookingDialog] = useState(false)
  const [dispatchSuccess, setDispatchSuccess] = useState<string|null>(null)

  const lowStock = items.filter(i => i.qty < i.min_qty && i.status === "in_stock")
  const demoOnLoan = items.filter(i => i.category === "demo" && i.status === "on_loan")
  const today = new Date().toISOString().split("T")[0]

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    return (i.name.toLowerCase().includes(q) || (i.serial_number||"").toLowerCase().includes(q) || i.brand.toLowerCase().includes(q)) &&
      (filterCat === "all" || i.category === filterCat)
  })

  function doStockOut(item: StockItem, qty: number, ref: string, note: string) {
    const tx: StockTransaction = { id: Date.now().toString(), item_id: item.id, item_name: item.name, type:"out", qty, reference: ref, note, date: today, approved_by:"Stock" }
    setTransactions(p => [tx, ...p])
    setItems(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty - qty } : i))
  }

  function returnDemo(item: StockItem) {
    setItems(p => p.map(i => i.id === item.id ? { ...i, status:"in_stock", loaned_to:undefined, loan_due:undefined } : i))
  }

  function sellDemo(item: StockItem) {
    setItems(p => p.map(i => i.id === item.id ? { ...i, status:"sold", qty:0 } : i))
  }

  function saveItem(data: Partial<StockItem>) {
    if (data.id) { setItems(p => p.map(i => i.id === data.id ? { ...i, ...data } as StockItem : i)) }
    else { setItems(p => [...p, { id: Date.now().toString(), status:"in_stock", ...data } as StockItem]) }
  }

  function addTransaction(tx: StockTransaction) {
    setTransactions(p => [tx, ...p])
    setItems(p => p.map(i => i.id === tx.item_id ? { ...i, qty: i.qty + tx.qty } : i))
  }

  function handleDispatch(form: DispatchForm) {
    setDispatchSuccess(`สร้างงาน ${form.job_type === "repair" ? "Repair" : "Calibration"} สำหรับ ${form.customer_org} เรียบร้อยแล้ว`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  function removeBooking(id: string) {
    const b = bookings.find(x => x.id === id)
    if (b) {
      setItems(p => p.map(i => i.id === b.item_id ? { ...i, status:"in_stock", reserved_by_sales:undefined, reserved_for_customer:undefined } : i))
      setBookings(p => p.filter(x => x.id !== id))
    }
  }

  function addBooking(b: Booking) {
    setBookings(p => [...p, b])
    setItems(p => p.map(i => i.id === b.item_id ? { ...i, status:"reserved", reserved_by_sales:b.sales_name, reserved_for_customer:b.customer_name } : i))
  }

  const catCounts = (Object.keys(CAT_LABELS) as StockCategory[]).reduce((acc, c) => { acc[c] = items.filter(i => i.category === c).length; return acc }, {} as Record<StockCategory, number>)

  const TABS = [
    { id:"all" as Tab, label:"สต็อกทั้งหมด" },
    { id:"receive" as Tab, label:"รับเข้า / PO" },
    { id:"booking" as Tab, label:`Booking (${bookings.length})` },
    { id:"demo" as Tab, label:"Demo Tracker" },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คลังสินค้า</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} รายการ
            {lowStock.length > 0 && <> · <span className="text-red-500 font-semibold">{lowStock.length} รายการต่ำกว่า Minimum</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setReceiveDialog(true)} className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-sm font-bold transition-colors">
            <ArrowDownCircle className="h-4 w-4" /> รับเข้า
          </button>
          <button onClick={()=>setAddDialog({open:true,data:{}})} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold transition-colors">
            <Plus className="h-4 w-4" /> เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {dispatchSuccess && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl mb-4 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 font-semibold">{dispatchSuccess}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: All Stock ───────────────────────────────────────────────────── */}
      {tab === "all" && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 font-semibold">{lowStock.length} รายการ Stock ต่ำกว่า Minimum: {lowStock.map(i=>i.name).join(", ")}</p>
            </div>
          )}
          <div className="grid grid-cols-6 gap-3">
            {(Object.keys(CAT_LABELS) as StockCategory[]).map(c => (
              <button key={c} onClick={()=>setFilterCat(filterCat===c?"all":c)}
                className={`p-3 rounded-2xl border-2 text-center transition-all ${filterCat===c ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                <div className={`inline-flex p-2 rounded-xl mb-1.5 ${CAT_COLORS[c].split(" ")[0]} bg-opacity-50`}>{CAT_ICONS[c]}</div>
                <p className="text-xs font-semibold text-gray-700">{CAT_LABELS[c]}</p>
                <p className="text-lg font-black text-gray-900">{catCounts[c]}</p>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" placeholder="ค้นหาสินค้า / SN / แบรนด์" />
          </div>
          <div className="flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["ชื่อสินค้า / SN","แบรนด์","ประเภท","คงเหลือ","Min","สถานะ",""].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => {
                  const isLow = item.qty < item.min_qty
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isLow ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.has_serial && item.serial_number
                          ? <p className="font-mono text-xs text-blue-600 mt-0.5">SN: {item.serial_number}</p>
                          : item.has_serial && <p className="text-xs text-gray-400 italic">ยังไม่มี SN</p>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{item.brand}</td>
                      <td className="px-4 py-3"><Pill label={CAT_LABELS[item.category]} color={CAT_COLORS[item.category]} /></td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-base ${isLow ? "text-red-600" : "text-gray-900"}`}>{item.qty}</span>
                        <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{item.min_qty}</td>
                      <td className="px-4 py-3">
                        <Pill label={STATUS_LABELS[item.status]} color={STATUS_COLORS[item.status]} />
                        {item.reserved_by_sales && <p className="text-xs text-orange-600 mt-0.5">By {item.reserved_by_sales}</p>}
                        {item.reserved_for_customer && <p className="text-xs text-gray-500">{item.reserved_for_customer}</p>}
                        {item.loaned_to && <p className="text-xs text-blue-600 mt-0.5">{item.loaned_to}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(item.status === "in_stock" || item.status === "reserved") && (
                            <button onClick={()=>setDispatchDialog(item)} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1">
                              <Send className="h-3 w-3" /> ส่งงาน
                            </button>
                          )}
                          {item.status === "on_loan" && (
                            <button onClick={()=>returnDemo(item)} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors">คืนเครื่อง</button>
                          )}
                          <button onClick={()=>setAddDialog({open:true,data:item})} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ChevronRight className="h-3.5 w-3.5" /></button>
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

      {/* ── Tab: Receive/PO ──────────────────────────────────────────────────── */}
      {tab === "receive" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">ประวัติการรับเข้า / เบิกออก</h3>
              <button onClick={()=>setReceiveDialog(true)} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600">
                <ArrowDownCircle className="h-4 w-4" /> รับสินค้าเข้า
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["วันที่","สินค้า","ประเภท","จำนวน","PO / อ้างอิง","หมายเหตุ","อนุมัติโดย"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{tx.item_name}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tx.type==="in" ? "bg-green-100 text-green-700" : tx.type==="out" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{tx.type==="in" ? "รับเข้า" : tx.type==="out" ? "เบิกออก" : "ปรับ"}</span></td>
                    <td className="px-4 py-3 font-bold">{tx.type==="out" ? "-" : "+"}{tx.qty}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{tx.reference}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.note || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.approved_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Booking ─────────────────────────────────────────────────────── */}
      {tab === "booking" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">การ Booking ของ Sales</h3>
              <p className="text-sm text-gray-500 mt-0.5">จัดการการจอง SN สำหรับลูกค้าแต่ละราย</p>
            </div>
            <button onClick={()=>setBookingDialog(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-colors">
              <Plus className="h-4 w-4" /> เพิ่ม Booking
            </button>
          </div>

          {bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Bookmark className="h-16 w-16 mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีการ Booking</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {bookings.map(b => (
                <div key={b.id} className="p-5 bg-white rounded-3xl border border-gray-200 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-gray-900">{b.item_name}</p>
                      {b.serial_number && <p className="font-mono text-xs text-blue-600 mt-0.5">SN: {b.serial_number}</p>}
                    </div>
                    <Pill label="Reserved" color={STATUS_COLORS.reserved} />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">Sales:</span>
                      <span className="font-semibold text-gray-900">{b.sales_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">ลูกค้า:</span>
                      <span className="font-semibold text-gray-900">{b.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ClipboardList className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-500 text-xs">{b.booked_date}</span>
                      {b.note && <span className="text-gray-400 text-xs">· {b.note}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setDispatchDialog(items.find(i=>i.id===b.item_id) || null as any)} className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1">
                      <Send className="h-3 w-3" /> ส่งงาน Services
                    </button>
                    <button onClick={()=>removeBooking(b.id)} className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100">ยกเลิก Booking</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Demo Tracker ────────────────────────────────────────────────── */}
      {tab === "demo" && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {demoOnLoan.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Demo ที่ออกไปอยู่ ({demoOnLoan.length})</h3>
              <div className="grid grid-cols-2 gap-4">
                {demoOnLoan.map(item => {
                  const overdue = item.loan_due ? item.loan_due < today : false
                  return (
                    <div key={item.id} className={`p-5 rounded-3xl border-2 ${overdue ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="font-mono text-xs text-gray-500">SN: {item.serial_number}</p>
                        </div>
                        {overdue && <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold"><AlertTriangle className="h-3 w-3" /> เกินกำหนด</span>}
                      </div>
                      <div className="space-y-1.5 mb-4">
                        <p className="text-sm text-gray-700 font-semibold">{item.loaned_to}</p>
                        {item.loan_due && <p className="text-xs text-gray-500">กำหนดคืน: <span className={overdue ? "text-red-600 font-bold" : ""}>{item.loan_due}</span></p>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>returnDemo(item)} className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600">บันทึกคืน</button>
                        <button onClick={()=>sellDemo(item)} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600">ตัดขาย</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Demo ในคลัง</h3>
            <div className="grid grid-cols-3 gap-4">
              {items.filter(i=>i.category==="demo" && i.status==="in_stock").map(item=>(
                <div key={item.id} className="p-5 bg-white rounded-3xl border border-gray-200">
                  <p className="font-bold text-gray-900 mb-0.5">{item.name}</p>
                  <p className="font-mono text-xs text-gray-500 mb-3">SN: {item.serial_number}</p>
                  <Pill label="In Stock" color={STATUS_COLORS.in_stock} />
                </div>
              ))}
              {items.filter(i=>i.category==="demo").length === 0 && (
                <p className="text-gray-400 text-sm col-span-3 py-8 text-center">ยังไม่มี Demo Unit</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {dispatchDialog && <DispatchDialog item={dispatchDialog} onClose={()=>setDispatchDialog(null)} onConfirm={handleDispatch} />}
      {addDialog.open && <AddItemDialog item={addDialog.data} onClose={()=>setAddDialog({open:false,data:null})} onSave={saveItem} />}
      {receiveDialog && <ReceiveDialog items={items} onClose={()=>setReceiveDialog(false)} onSave={addTransaction} />}
      {bookingDialog && <AddBookingDialog items={items} onClose={()=>setBookingDialog(false)} onSave={addBooking} />}
    </div>
  )
}
