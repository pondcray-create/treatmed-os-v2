"use client"

import { useEffect, useState } from "react"
import { Package, Plus, Search, ArrowDownCircle, X, AlertTriangle, CheckCircle2, Wrench, FlaskConical, ShoppingCart, Zap, Drill, Camera, ChevronRight, Bookmark, Send, User, Building2, ClipboardList, MoreHorizontal } from "lucide-react"
import {
  appendModuleAssignment,
  appendLoanReturnHistory,
  appendStockDispatch,
  readJobs,
  readLoanReturnHistory,
  readModuleAssignments,
  readOrganizations,
  readProactiveCalibrationAssets,
  readProductCatalog,
  readDropdownConfig,
  readStockDispatches,
  readStockItems,
  upsertOrganizationByName,
  writeDropdownConfig,
  writeProactiveCalibrationAssets,
  writeStockItems,
  writeOrganizations,
  type ASDropdownConfig,
  type ProductCatalogGroup,
  type ASContact,
  type ASModuleAssignment,
  type ASLoanReturnHistory,
  type ASOrganization,
  type ASProactiveCalibrationAsset,
  type ASServiceJob,
} from "@/lib/mock/as-store"

type StockCategory = "spare_part" | "module" | "sellable" | "consumable" | "tool" | "demo"
type ItemStatus = "in_stock" | "reserved" | "on_loan" | "sold" | "pending_qc"
type Tab = "all" | "receive" | "booking" | "loan" | "demo"

interface StockItem {
  id: string; name: string; brand: string; model?: string; category: StockCategory
  has_serial: boolean; serial_number?: string; qty: number; min_qty: number; unit: string
  status: ItemStatus; loaned_to?: string; reserved_by_sales?: string; reserved_for_customer?: string; loan_due?: string
  loan_date?: string
  stocked_at?: string
  module_serials?: string[]
  companion_serial?: string
  parent_display_sn?: string
  qc_customer_org?: string
  qc_customer_contact?: string
}

interface StockTransaction {
  id: string; item_id: string; item_name: string; type: "in" | "out" | "adjust"
  qty: number; reference: string; note?: string; date: string; approved_by?: string
  shelf_location?: string
  customer_org?: string
  customer_contact?: string
  serial_number?: string
  manufacturer?: string
  model?: string
  category?: StockCategory
  set_status?: ItemStatus
  // Used for customer evaluation (return) and calibration alert (new machine)
  due_date?: string
  loan_date?: string
  loan_due?: string
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
  on_loan: "bg-blue-100 text-blue-700", sold: "bg-gray-100 text-gray-400",
  pending_qc: "bg-amber-100 text-amber-800"
}
const STATUS_LABELS: Record<ItemStatus, string> = {
  in_stock: "In Stock", reserved: "Reserved", on_loan: "On Loan", sold: "Sold",
  pending_qc: "Pending QC"
}

const MOCK_ITEMS: StockItem[] = [
  { id:"1", name:"Battery Pack ProSim 8", brand:"Fluke Biomedical", category:"spare_part", has_serial:false, qty:3, min_qty:5, unit:"ชิ้น", status:"in_stock", stocked_at:"2024-01-05" },
  { id:"2", name:"LCD Module ProSim 4", brand:"Fluke Biomedical", category:"spare_part", has_serial:false, qty:1, min_qty:2, unit:"ชิ้น", status:"in_stock", stocked_at:"2024-02-12" },
  { id:"3", name:"IDA6 Infusion Module", brand:"Fluke Biomedical", category:"module", has_serial:true, serial_number:"IDA6MOD-2023-0089", qty:1, min_qty:1, unit:"อัน", status:"in_stock", stocked_at:"2024-03-20" },
  { id:"4", name:"ProSim 8 + SPOT Module", brand:"Fluke Biomedical", category:"sellable", has_serial:true, serial_number:"PS8-2024-NEW-001", qty:1, min_qty:0, unit:"เครื่อง", status:"reserved", reserved_by_sales:"คุณสมหมาย", reserved_for_customer:"โรงพยาบาลรามาธิบดี", stocked_at:"2024-05-09" },
  { id:"5", name:"RaySafe X2 Solo", brand:"RaySafe", category:"sellable", has_serial:true, serial_number:"X2S-2024-001", qty:2, min_qty:1, unit:"เครื่อง", status:"in_stock", stocked_at:"2024-06-18" },
  { id:"6", name:"Electrode Pad (10 pcs)", brand:"Generic", category:"consumable", has_serial:false, qty:15, min_qty:20, unit:"แพ็ค", status:"in_stock", stocked_at:"2024-07-02" },
  { id:"7", name:"Calibration Fixture Set", brand:"TreatMed", category:"tool", has_serial:false, qty:2, min_qty:1, unit:"ชุด", status:"in_stock", stocked_at:"2024-07-21" },
  { id:"8", name:"ProSim 4 Demo", brand:"Fluke Biomedical", category:"demo", has_serial:true, serial_number:"PS4-DEMO-001", qty:1, min_qty:0, unit:"เครื่อง", status:"on_loan", loaned_to:"โรงพยาบาลขอนแก่น", loan_due:"2024-03-10", loan_date:"2024-02-10", stocked_at:"2024-01-20" },
  { id:"9", name:"RaySafe 452 Full Kit", brand:"RaySafe", category:"sellable", has_serial:true, serial_number:"452-2024-001", qty:1, min_qty:0, unit:"ชุด", status:"in_stock", stocked_at:"2024-08-11" },
  { id:"10", name:"ESA 615 Demo", brand:"Fluke Biomedical", category:"demo", has_serial:true, serial_number:"ESA615-DEMO-001", qty:1, min_qty:0, unit:"เครื่อง", status:"in_stock", stocked_at:"2024-09-15" },
]

function parseISODateToUTC(iso: string) {
  // iso is expected as "YYYY-MM-DD"
  return new Date(`${iso}T00:00:00.000Z`).getTime()
}

function diffDays(fromISO: string, toISO: string) {
  const from = parseISODateToUTC(fromISO)
  const to = parseISODateToUTC(toISO)
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

function getSpecialModelRule(model: string) {
  const m = model.trim()
  const ida = m.match(/IDA6-(\d)ch/i)
  if (ida) {
    const count = Number(ida[1])
    return { moduleCount: Number.isFinite(count) ? count : 0, needsCompanion: false }
  }
  if (/ProSim8P?\s*\+\s*SPOT/i.test(m) || /ProSim4\s*\+\s*SPOTLIGHT/i.test(m)) {
    return { moduleCount: 0, needsCompanion: true }
  }
  return { moduleCount: 0, needsCompanion: false }
}

function ReturnDemoDialog({
  item,
  onClose,
  onConfirm,
  todayISO,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (loanDate: string) => void
  todayISO: string
}) {
  const [loanDate, setLoanDate] = useState(item.loan_date || todayISO)
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!loanDate) return
    onConfirm(loanDate)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" /> รับคืน Demo
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 bg-blue-50 rounded-2xl mb-4 border border-blue-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
          {item.loan_due && <p className="text-xs text-blue-600 mt-0.5">กำหนดคืน: {item.loan_due}</p>}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              วันที่ลูกค้ายืม *
            </label>
            <input type="date" required value={loanDate} onChange={(e) => setLoanDate(e.target.value)} className={inp} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">
              บันทึกคืนเครื่อง
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LoanDialog({
  item,
  onClose,
  onConfirm,
  todayISO,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (payload: { customer: string; dueDate: string }) => void
  todayISO: string
}) {
  const [customer, setCustomer] = useState(item.loaned_to || "")
  const [dueDate, setDueDate] = useState(item.loan_due || todayISO)
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer.trim() || !dueDate) return
    onConfirm({ customer: customer.trim(), dueDate })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Loan Item</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 bg-indigo-50 rounded-2xl mb-4 border border-indigo-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-indigo-700 mt-0.5">SN: {item.serial_number}</p>}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer / Organization *</label>
            <input required value={customer} onChange={(e) => setCustomer(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Loan Due Date *</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600">
              Confirm Loan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModuleHistoryDialog({
  moduleSerial,
  records,
  onClose,
}: {
  moduleSerial: string
  records: ASModuleAssignment[]
  onClose: () => void
}) {
  const eventColor: Record<ASModuleAssignment["event"], string> = {
    received_link: "bg-blue-100 text-blue-700",
    reassigned: "bg-violet-100 text-violet-700",
    separated: "bg-amber-100 text-amber-800",
    sold: "bg-emerald-100 text-emerald-700",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Module Timeline</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs text-gray-500">Module SN</p>
          <p className="text-sm font-mono font-semibold text-gray-900">{moduleSerial}</p>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-auto">
          {records.map((m) => (
            <div key={m.id} className="rounded-2xl border border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${eventColor[m.event]}`}>{m.event}</span>
                <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{m.from_parent_serial || "—"} to {m.to_parent_serial || "—"}</p>
              {m.note && <p className="text-xs text-gray-500 mt-1">{m.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SellDemoDialog({
  item,
  onClose,
  onConfirm,
  todayISO,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (payload: { customer_org: string; due_date: string; last_calibration_date?: string }) => void
  todayISO: string
}) {
  const [customerOrg, setCustomerOrg] = useState(item.loaned_to || item.reserved_for_customer || "")
  const [dueDate, setDueDate] = useState("")
  const [lastCalDate, setLastCalDate] = useState("")
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerOrg.trim() || !dueDate) return
    onConfirm({
      customer_org: customerOrg.trim(),
      due_date: dueDate,
      last_calibration_date: lastCalDate || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-500" /> ตัดขาย + ลง Proactive
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 bg-emerald-50 rounded-2xl mb-4 border border-emerald-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-emerald-700 mt-0.5">SN: {item.serial_number}</p>}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วยงานลูกค้า *</label>
            <input required value={customerOrg} onChange={(e) => setCustomerOrg(e.target.value)} className={inp} placeholder="ชื่อหน่วยงานลูกค้า" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Calibration Date</label>
              <input type="date" value={lastCalDate} onChange={(e) => setLastCalDate(e.target.value)} className={inp} max={todayISO} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date *</label>
              <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600">
              ยืนยันตัดขาย
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerLoanHistoryModal({
  customerOrg,
  records,
  onClose,
}: {
  customerOrg: string
  records: ASLoanReturnHistory[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">ประวัติการคืนเครื่องช้า</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
          <p className="text-sm text-amber-800 font-semibold">ลูกค้า: {customerOrg}</p>
          <p className="text-xs text-amber-700 mt-1">
            แสดงรายการทั้งหมด ({records.length})
          </p>
        </div>

        <div className="overflow-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["วันที่ลูกค้ายืม", "กำหนดคืน", "วันที่คืนจริง", "Overdue (วัน)", "แหล่งที่มา"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records
                .slice()
                .sort((a, b) => (a.returned_at < b.returned_at ? 1 : -1))
                .map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600">{r.loan_date}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.due_date}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.returned_at}</td>
                    <td className={`px-4 py-3 text-xs font-bold ${r.overdue_days >= 3 ? "text-red-600" : r.overdue_days >= 1 ? "text-orange-600" : "text-gray-600"}`}>
                      {r.overdue_days}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.source}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

const MOCK_TRANSACTIONS: StockTransaction[] = [
  { id:"t1", item_id:"1", item_name:"Battery Pack ProSim 8", type:"in", qty:5, reference:"PO-2024-089", note:"สั่งจาก Fluke SG", date:"2024-03-01", approved_by:"Admin", shelf_location:"A-01", customer_org:"โรงพยาบาลกรุงเทพ" },
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
  const [orgs, setOrgs] = useState<ASOrganization[]>([])

  useEffect(() => {
    setOrgs(readOrganizations([]))
  }, [])

  const selectedOrg = orgs.find((o) => o.name === form.customer_org)
  const contacts: ASContact[] = selectedOrg?.contacts ?? []
  const contactsRequired = contacts.length > 0

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
            <select
              required
              value={form.customer_org}
              onChange={(e) => {
                const orgName = e.target.value
                const org = orgs.find((o) => o.name === orgName)
                const primary = org?.contacts.find((c) => c.is_primary)
                const nextContact = primary?.name ?? org?.contacts[0]?.name ?? ""
                setForm((f) => ({ ...f, customer_org: orgName, customer_name: nextContact }))
              }}
              className={inp}
            >
              <option value="">-- เลือกหน่วยงาน --</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ผู้ติดต่อ</label>
            <select
              required={contactsRequired}
              value={form.customer_name}
              disabled={!contactsRequired}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              className={inp}
            >
              <option value="">{contactsRequired ? "-- เลือกผู้ติดต่อ --" : "— ไม่พบผู้ติดต่อ"}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                  {c.position ? ` (${c.position})` : ""}
                </option>
              ))}
            </select>
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
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  useEffect(() => {
    setOrgs(readOrganizations([]))
  }, [])
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
            <select required value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} className={inp}>
              <option value="">-- เลือกหน่วยงาน --</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
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
          <h2 className="font-bold text-lg">{item?.id ? "Edit Item Master" : "Add Item Master"}</h2>
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
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">{item?.id ? "Save" : "Add Item Master"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Receive Dialog ────────────────────────────────────────────────────────────
function ReceiveDialog({
  items,
  dropdownConfig,
  onClose,
  onSave,
  onCreateModel,
  onCreateManufacturer,
  productCatalog,
}: {
  items: StockItem[]
  dropdownConfig: ASDropdownConfig
  onClose:()=>void
  onSave:(tx:StockTransaction)=>void
  onCreateModel: (modelName: string) => void
  onCreateManufacturer: (manufacturerName: string) => void
  productCatalog: ProductCatalogGroup[]
}) {
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  const [registerMode, setRegisterMode] = useState(false)
  const [customModelMode, setCustomModelMode] = useState(false)
  const [customManufacturerMode, setCustomManufacturerMode] = useState(false)
  const [form, setForm] = useState({
    item_id: "",
    qty: 1,
    po_number: "",
    supplier: "",
    note: "",
    shelf_location: "",
    customer_org: "",
    custom_customer_org: "",
    customer_contact: "",
    custom_customer_contact: "",
    category: "sellable" as StockCategory,
    product_group_code: "",
    type: "new" as "new"|"return",
    serial_number: "",
    manufacturer: "",
    model: "",
    module_serial_1: "",
    module_serial_2: "",
    module_serial_3: "",
    module_serial_4: "",
    companion_serial: "",
    due_date: "",
    loan_date: "",
  })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm bg-white"
  useEffect(() => {
    setOrgs(readOrganizations([]))
  }, [])

  const selectedItem = items.find((i) => i.id === form.item_id)
  const selectedGroup = productCatalog.find((g) => g.code === form.product_group_code)
  const allCatalogModels = [...new Set(productCatalog.flatMap((g) => g.models))]
  const specialRule = getSpecialModelRule(form.model)
  const selectedOrg = orgs.find((o) => o.name === form.customer_org)
  const contacts = selectedOrg?.contacts ?? []
  const primaryContact = contacts.find((c) => c.is_primary)?.name ?? contacts[0]?.name ?? ""

  useEffect(() => {
    // สำหรับ receive ประเภท return เราใช้รายการสต็อกเดิมเป็นหลัก
    if (form.type === "new") return
    if (!selectedItem) return
    setForm((f) => ({
      ...f,
      manufacturer: selectedItem.brand || f.manufacturer,
      model: selectedItem.model || selectedItem.name || f.model,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.item_id, form.type])

  useEffect(() => {
    if (form.type !== "new") return
    if (!selectedGroup) return
    setForm((f) => ({
      ...f,
      manufacturer: selectedGroup.manufacturer || f.manufacturer,
      model: selectedGroup.models.includes(f.model) ? f.model : "",
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_group_code, form.type])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const item = items.find(i=>i.id===form.item_id)
    const customerOrg = registerMode ? form.custom_customer_org.trim() : form.customer_org
    const customerContact = registerMode ? form.custom_customer_contact.trim() : form.customer_contact
    if (!customerOrg) return
    if (!customerContact) return

    const isNewMachine = form.type === "new"
    if (isNewMachine) {
      if (!form.serial_number.trim()) return
      if (!form.manufacturer.trim()) return
      if (!form.model.trim()) return
      if (!form.due_date) return
      if (specialRule.moduleCount > 0) {
        const modules = [form.module_serial_1, form.module_serial_2, form.module_serial_3, form.module_serial_4]
          .slice(0, specialRule.moduleCount)
          .map((v) => v.trim())
        if (modules.some((v) => !v)) return
      }
      if (specialRule.needsCompanion && !form.companion_serial.trim()) return
    }
    if (!isNewMachine) {
      if (form.type === "return" && !form.loan_date) return
    }
    if (registerMode) {
      const next = upsertOrganizationByName(orgs, customerOrg, customerContact)
      writeOrganizations(next)
      setOrgs(next)
    }
    if (!isNewMachine && !item) return

    // item_id สำหรับ "ซื้อใหม่" จะถูกสร้างขึ้นจากของจริงที่กรอก
    const txItemId = isNewMachine ? `in-${Date.now().toString()}` : form.item_id
    const normalizedModel = form.model.trim()
    const normalizedManufacturer = form.manufacturer.trim()
    const txItemName = isNewMachine ? normalizedModel : item?.name
    if (!txItemName) return
    if (isNewMachine && !dropdownConfig.stock_models.includes(normalizedModel)) {
      onCreateModel(normalizedModel)
    }
    if (isNewMachine && !dropdownConfig.stock_manufacturers.includes(normalizedManufacturer)) {
      onCreateManufacturer(normalizedManufacturer)
    }

    const moduleSerials = [form.module_serial_1, form.module_serial_2, form.module_serial_3, form.module_serial_4]
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, specialRule.moduleCount)

    onSave({
      id: Date.now().toString(),
      item_id: txItemId,
      item_name: txItemName,
      type: "in",
      qty: isNewMachine ? 1 : form.qty,
      reference: isNewMachine ? form.po_number : "—",
      note: `${form.supplier ? form.supplier + " · " : ""}${form.note || ""}${isNewMachine ? ` · Due:${form.due_date}` : ` · Loan date:${form.loan_date}`}${isNewMachine ? ` · SN:${form.serial_number.trim()} Mfr:${normalizedManufacturer} Model:${normalizedModel}` : ""}${moduleSerials.length ? ` · ModuleSN:${moduleSerials.join(",")}` : ""}${form.companion_serial.trim() ? ` · CompanionSN:${form.companion_serial.trim()}` : ""}`,
      date: new Date().toISOString().split("T")[0],
      approved_by:"Admin",
      shelf_location: form.shelf_location,
      customer_org: customerOrg,
      customer_contact: customerContact,
      serial_number: isNewMachine ? form.serial_number.trim() : undefined,
      manufacturer: isNewMachine ? normalizedManufacturer : undefined,
      model: isNewMachine ? normalizedModel : undefined,
      category: isNewMachine ? "sellable" : undefined,
      set_status: isNewMachine ? "pending_qc" : "in_stock",
      due_date: isNewMachine ? form.due_date : undefined,
      loan_date: !isNewMachine ? form.loan_date : undefined,
      loan_due: !isNewMachine ? item?.loan_due : undefined,
    })

    if (isNewMachine && form.serial_number.trim() && moduleSerials.length > 0) {
      const now = new Date().toISOString()
      moduleSerials.forEach((sn) => {
        appendModuleAssignment({
          id: `ma-${Date.now()}-${sn}`,
          module_serial: sn,
          from_parent_serial: undefined,
          to_parent_serial: form.serial_number.trim(),
          event: "received_link",
          note: `Linked on receive (${normalizedModel})`,
          created_at: now,
        })
      })
    }
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Stock In (PO)</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ประเภทการรับ</label>
            <div className="flex gap-2">
              {([["new","ซื้อใหม่"],["return","รับคืน"]] as ["new"|"return", string][]).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,type:v}))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.type===v ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          {form.type !== "new" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รายการสต็อก *</label>
              <select
                required
                value={form.item_id}
                onChange={(e)=>setForm(f=>({...f,item_id:e.target.value}))}
                className={inp}
              >
                <option value="">-- เลือกรายการสต็อก --</option>
                {items.map((i)=>(
                  <option key={i.id} value={i.id}>
                    {i.name}{i.serial_number ? ` (SN: ${i.serial_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวน</label>
              <input
                type="number"
                min={1}
            required
            disabled={form.type === "new"}
            value={form.type === "new" ? 1 : form.qty}
                onChange={e=>setForm(f=>({...f,qty:Number(e.target.value)}))}
                className={inp}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                PO Number {form.type === "new" ? "*" : "(ไม่ต้อง)"}
              </label>
              <input
                required={form.type === "new"}
                disabled={form.type !== "new"}
                value={form.po_number}
                onChange={e=>setForm(f=>({...f,po_number:e.target.value}))}
                className={inp}
                placeholder="PO-2024-XXX"
              />
            </div>
          </div>
          {form.type === "new" ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              เครื่องใหม่ (มี SN) จะถูกส่งตรวจเช็คก่อนเข้าสต็อกอัตโนมัติ
            </p>
          ) : null}
          {form.type === "new" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date (สำหรับ Calibration alert) *</label>
              <input
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className={inp}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                วันที่ลูกค้ายืม {form.type === "return" ? "*" : ""}
              </label>
              <input
                type="date"
                required={form.type === "return"}
                value={form.loan_date}
                onChange={(e) => setForm((f) => ({ ...f, loan_date: e.target.value }))}
                className={inp}
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชั้นวางสินค้า *</label>
              <input required value={form.shelf_location} onChange={e=>setForm(f=>({...f,shelf_location:e.target.value}))} className={inp} placeholder="เช่น A-01 / B-03" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ลูกค้าอ้างอิง *</label>
              {!registerMode ? (
                <>
                  <select
                    required
                    value={form.customer_org}
                    onChange={(e) => {
                      const orgName = e.target.value
                      const org = orgs.find((o) => o.name === orgName)
                      const nextPrimary = org?.contacts.find((c) => c.is_primary)?.name ?? org?.contacts[0]?.name ?? ""
                      setForm((f) => ({ ...f, customer_org: orgName, customer_contact: nextPrimary }))
                    }}
                    className={inp}
                  >
                    <option value="">-- เลือกจากฐานข้อมูลลูกค้า --</option>
                    {orgs.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <select
                    required
                    value={form.customer_contact}
                    onChange={(e) => setForm((f) => ({ ...f, customer_contact: e.target.value }))}
                    className={inp + " mt-2"}
                    disabled={contacts.length === 0}
                  >
                    <option value="">{contacts.length > 0 ? "-- เลือกผู้ติดต่อ --" : "— ไม่มีผู้ติดต่อ —"}</option>
                    {contacts.map((c) => <option key={c.id} value={c.name}>{c.name}{c.position ? ` (${c.position})` : ""}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <input required value={form.custom_customer_org} onChange={e=>setForm(f=>({...f,custom_customer_org:e.target.value}))} className={inp} placeholder="พิมพ์ชื่อลูกค้าเพื่อ Register อัตโนมัติ" />
                  <input required value={form.custom_customer_contact} onChange={e=>setForm(f=>({...f,custom_customer_contact:e.target.value}))} className={inp + " mt-2"} placeholder="ผู้ติดต่อหลัก (ชื่อ)" />
                </>
              )}
              <button
                type="button"
                onClick={() => setRegisterMode((v) => !v)}
                className="mt-1 text-xs text-green-700 hover:text-green-800 underline"
              >
                {registerMode ? "กลับไปเลือกจากฐานข้อมูล" : "ไม่พบลูกค้า? Register อัตโนมัติ"}
              </button>
            </div>
          </div>
          {form.type === "new" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SN *</label>
                <input required value={form.serial_number} onChange={(e)=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN ของเครื่อง" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Manufacturer *</label>
                {!customManufacturerMode ? (
                  <select
                    required
                    value={form.manufacturer}
                    onChange={(e) => {
                      const next = e.target.value
                      if (next === "__custom__") {
                        setCustomManufacturerMode(true)
                        setForm((f) => ({ ...f, manufacturer: "" }))
                        return
                      }
                      setForm((f) => ({ ...f, manufacturer: next }))
                    }}
                    className={inp}
                  >
                    <option value="">-- เลือกผู้ผลิต --</option>
                    {[...new Set([
                      ...dropdownConfig.stock_manufacturers,
                      ...productCatalog.map((g) => g.manufacturer),
                    ])].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom__">+ เพิ่มผู้ผลิตใหม่</option>
                  </select>
                ) : (
                  <>
                    <input required value={form.manufacturer} onChange={(e)=>setForm(f=>({...f,manufacturer:e.target.value}))} className={inp} placeholder="กรอกผู้ผลิตใหม่" />
                    <button
                      type="button"
                      onClick={() => setCustomManufacturerMode(false)}
                      className="mt-1 text-xs text-green-700 hover:text-green-800 underline"
                    >
                      กลับไปเลือกผู้ผลิตจากระบบ
                    </button>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Group</label>
                <select
                  value={form.product_group_code}
                  onChange={(e) => setForm((f) => ({ ...f, product_group_code: e.target.value }))}
                  className={inp}
                >
                  <option value="">-- เลือกกลุ่ม --</option>
                  {productCatalog.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.code} - {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Model *</label>
                {!customModelMode ? (
                  <select
                    required
                    value={form.model}
                    onChange={(e) => {
                      const next = e.target.value
                      if (next === "__custom__") {
                        setCustomModelMode(true)
                        setForm((f) => ({ ...f, model: "" }))
                        return
                      }
                      setForm((f) => ({ ...f, model: next }))
                    }}
                    className={inp}
                  >
                    <option value="">-- เลือกรุ่น --</option>
                    {(selectedGroup?.models?.length
                      ? selectedGroup.models
                      : [...new Set([...dropdownConfig.stock_models, ...allCatalogModels])]
                    ).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom__">+ เพิ่มรุ่นใหม่</option>
                  </select>
                ) : (
                  <>
                    <input required value={form.model} onChange={(e)=>setForm(f=>({...f,model:e.target.value}))} className={inp} placeholder="กรอกรุ่นใหม่" />
                    <button
                      type="button"
                      onClick={() => setCustomModelMode(false)}
                      className="mt-1 text-xs text-green-700 hover:text-green-800 underline"
                    >
                      กลับไปเลือกรุ่นจากระบบ
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}
          {form.type === "new" && specialRule.moduleCount > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: specialRule.moduleCount }).map((_, idx) => {
                const key = `module_serial_${idx + 1}` as "module_serial_1" | "module_serial_2" | "module_serial_3" | "module_serial_4"
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{`Module SN #${idx + 1} *`}</label>
                    <input
                      required
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className={inp}
                      placeholder={`SN ของ Module ${idx + 1}`}
                    />
                  </div>
                )
              })}
            </div>
          )}
          {form.type === "new" && specialRule.needsCompanion && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Companion Module SN *</label>
              <input
                required
                value={form.companion_serial}
                onChange={(e) => setForm((f) => ({ ...f, companion_serial: e.target.value }))}
                className={inp}
                placeholder="เช่น SN ของ SPOT Module"
              />
            </div>
          )}
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
  const [items, setItems] = useState<StockItem[]>(() => {
    const saved = readStockItems([])
    return saved.length > 0 ? (saved as StockItem[]) : MOCK_ITEMS
  })
  const [transactions, setTransactions] = useState<StockTransaction[]>(MOCK_TRANSACTIONS)
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState<StockCategory|"all">("all")
  const [filterBrand, setFilterBrand] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<ItemStatus|"all">("all")
  const [dispatchDialog, setDispatchDialog] = useState<StockItem|null>(null)
  const [addDialog, setAddDialog] = useState<{open:boolean; data:Partial<StockItem>|null}>({open:false,data:null})
  const [receiveDialog, setReceiveDialog] = useState(false)
  const [bookingDialog, setBookingDialog] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [dispatchSuccess, setDispatchSuccess] = useState<string|null>(null)
  const [serviceRequestsFromStock, setServiceRequestsFromStock] = useState<ASServiceJob[]>([])
  const [pendingInServiceInbox, setPendingInServiceInbox] = useState(0)
  const [loanReturnHistory, setLoanReturnHistory] = useState<ASLoanReturnHistory[]>([])
  const [returnDemoDialog, setReturnDemoDialog] = useState<StockItem | null>(null)
  const [loanDialog, setLoanDialog] = useState<StockItem | null>(null)
  const [sellDemoDialog, setSellDemoDialog] = useState<StockItem | null>(null)
  const [customerHistoryModal, setCustomerHistoryModal] = useState<string | null>(null)
  const [proactiveAssets, setProactiveAssets] = useState<ASProactiveCalibrationAsset[]>([])
  const [moduleAssignments, setModuleAssignments] = useState<ASModuleAssignment[]>([])
  const [moduleHistorySearch, setModuleHistorySearch] = useState("")
  const [moduleHistoryDialogSn, setModuleHistoryDialogSn] = useState<string | null>(null)
  const [loanHistorySearch, setLoanHistorySearch] = useState("")
  const [loanHistoryCustomer, setLoanHistoryCustomer] = useState("all")
  const [dropdownConfig, setDropdownConfig] = useState<ASDropdownConfig>(readDropdownConfig())
  const [productCatalog, setProductCatalog] = useState<ProductCatalogGroup[]>(readProductCatalog())

  const lowStock = items.filter(i => i.qty < i.min_qty && i.status === "in_stock")
  const demoOnLoan = items.filter(i => i.category === "demo" && i.status === "on_loan")
  const stockOnLoan = items.filter((i) => i.status === "on_loan")
  const reservedItems = items.filter((i) => i.status === "reserved")
  const today = new Date().toISOString().split("T")[0]

  const uniqueBrands = Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b))

  function getStockAgingDays(item: StockItem) {
    if (!item.stocked_at) return 0
    return Math.max(0, diffDays(item.stocked_at, today))
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    return (i.name.toLowerCase().includes(q) || (i.serial_number||"").toLowerCase().includes(q) || i.brand.toLowerCase().includes(q)) &&
      (filterCat === "all" || i.category === filterCat) &&
      (filterBrand === "all" || i.brand === filterBrand) &&
      (filterStatus === "all" || i.status === filterStatus)
  }).sort((a, b) => getStockAgingDays(b) - getStockAgingDays(a))

  const statusLabel: Record<ASServiceJob["status"], string> = {
    "รอประเมิน": "รอประเมิน",
    "กำลังประเมิน": "กำลังประเมิน",
    "รอ Quotation Approve": "รออนุมัติใบเสนอราคา",
    "รอ PO": "รอ PO",
    "ในคิว": "อยู่ในคิว",
    "กำลังซ่อม": "กำลังซ่อม",
    "รออะไหล่": "รออะไหล่",
    "QC": "QC",
    "รอส่งคืน": "รอส่งคืน",
    "ปิดงาน": "ปิดงาน",
    "ยกเลิก": "ยกเลิก",
  }

  const statusColor: Record<ASServiceJob["status"], string> = {
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

  useEffect(() => {
    const sync = () => {
      const jobs = readJobs([])
      const dispatches = readStockDispatches([])
      setServiceRequestsFromStock(jobs.filter((j) => j.source === "stock"))
      setPendingInServiceInbox(dispatches.length)
      setLoanReturnHistory(readLoanReturnHistory([]))
      setProactiveAssets(readProactiveCalibrationAssets([]))
      setDropdownConfig(readDropdownConfig())
      setProductCatalog(readProductCatalog())
      setModuleAssignments(readModuleAssignments([]))
    }
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    const timer = window.setInterval(sync, 1200)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    writeStockItems(items)
  }, [items])

  useEffect(() => {
    if (!actionMenuId) return
    const closeMenu = () => setActionMenuId(null)
    window.addEventListener("click", closeMenu)
    return () => window.removeEventListener("click", closeMenu)
  }, [actionMenuId])

  const demoLoans = demoOnLoan
  const nearDueLoans = demoLoans.filter((i) => i.loan_due && diffDays(today, i.loan_due) <= 3 && diffDays(today, i.loan_due) >= 0)
  const overdueLoans = demoLoans.filter((i) => i.loan_due && diffDays(i.loan_due, today) >= 1)

  const customerScores = (() => {
    const byCustomer = new Map<string, ASLoanReturnHistory[]>()
    for (const r of loanReturnHistory) {
      const key = r.customer_org.trim()
      if (!key) continue
      const arr = byCustomer.get(key) || []
      arr.push(r)
      byCustomer.set(key, arr)
    }
    const out = Array.from(byCustomer.entries()).map(([customer_org, records]) => {
      const deductions = records.filter((r) => r.overdue_days >= 3).length
      const score = Math.max(0, 10 - deductions)
      return { customer_org, score, deductions, records }
    })
    out.sort((a, b) => a.score - b.score)
    return out
  })()

  const badCustomers = customerScores.filter((c) => c.score < 6)
  const loanHistoryCustomers = Array.from(new Set(loanReturnHistory.map((r) => r.customer_org).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const filteredLoanHistory = loanReturnHistory.filter((r) => {
    const q = loanHistorySearch.trim().toLowerCase()
    const matchText = !q || (r.equipment_name || "").toLowerCase().includes(q) || r.customer_org.toLowerCase().includes(q)
    const matchCustomer = loanHistoryCustomer === "all" || r.customer_org === loanHistoryCustomer
    return matchText && matchCustomer
  })
  const loanByMonth = Array.from(
    filteredLoanHistory.reduce((acc, cur) => {
      const month = (cur.loan_date || "").slice(0, 7) || "unknown"
      acc.set(month, (acc.get(month) || 0) + 1)
      return acc
    }, new Map<string, number>()),
  ).sort((a, b) => (a[0] < b[0] ? -1 : 1))

  function handleReturnDemoConfirmed(item: StockItem, loanDate: string) {
    const returnedAt = today
    const due = item.loan_due
    if (!item.loaned_to || !due) return
    const overdueDays = Math.max(0, diffDays(due, returnedAt))
    const id = `lr-${Date.now()}`
    const record: ASLoanReturnHistory = {
      id,
      customer_org: item.loaned_to,
      equipment_name: item.name,
      loan_date: loanDate,
      due_date: due,
      returned_at: returnedAt,
      overdue_days: overdueDays,
      source: "demo_return",
      created_at: new Date().toISOString(),
    }
    appendLoanReturnHistory(record)
    setLoanReturnHistory((prev) => [record, ...prev])

    setItems((p) =>
      p.map((i) =>
        i.id === item.id
          ? { ...i, status: "in_stock", loaned_to: undefined, loan_due: undefined, loan_date: undefined }
          : i,
      ),
    )
    setDispatchSuccess(`บันทึกคืนเครื่องของ ${item.loaned_to} เรียบร้อยแล้ว`)
    setTimeout(() => setDispatchSuccess(null), 3500)
  }

  function doStockOut(item: StockItem, qty: number, ref: string, note: string) {
    const tx: StockTransaction = { id: Date.now().toString(), item_id: item.id, item_name: item.name, type:"out", qty, reference: ref, note, date: today, approved_by:"Stock" }
    setTransactions(p => [tx, ...p])
    setItems(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty - qty } : i))
  }

  function confirmSellDemo(item: StockItem, payload: { customer_org: string; due_date: string; last_calibration_date?: string }) {
    if (!item.serial_number) {
      setDispatchSuccess("ตัดขายไม่สำเร็จ: ต้องมี SN ก่อน")
      setTimeout(() => setDispatchSuccess(null), 3500)
      return
    }

    const existing = proactiveAssets.find((a) => a.serial_number.trim().toLowerCase() === item.serial_number!.trim().toLowerCase())
    const record: ASProactiveCalibrationAsset = {
      id: existing?.id || `pc-${Date.now()}`,
      customer_org: payload.customer_org,
      customer_name: undefined,
      manufacturer: item.brand || "—",
      model: item.model || item.name,
      serial_number: item.serial_number,
      last_calibration_date: payload.last_calibration_date,
      due_date: payload.due_date,
      note: `Auto from stock sell (${item.name})`,
      created_at: existing?.created_at || today,
    }

    const nextAssets = existing
      ? proactiveAssets.map((a) => (a.id === existing.id ? record : a))
      : [record, ...proactiveAssets]
    setProactiveAssets(nextAssets)
    writeProactiveCalibrationAssets(nextAssets)

    setItems((p) =>
      p.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "sold",
              qty: 0,
              loaned_to: undefined,
              loan_due: undefined,
              loan_date: undefined,
              reserved_by_sales: undefined,
              reserved_for_customer: undefined,
            }
          : i,
      ),
    )

    setDispatchSuccess(existing ? "อัปเดต Cal Proactive จากข้อมูลตัดขายแล้ว" : "ตัดขายและลง Cal Proactive อัตโนมัติแล้ว")
    setTimeout(() => setDispatchSuccess(null), 3500)
  }

  function saveItem(data: Partial<StockItem>) {
    if (data.id) { setItems(p => p.map(i => i.id === data.id ? { ...i, ...data } as StockItem : i)) }
    else { setItems(p => [...p, { id: Date.now().toString(), status:"in_stock", ...data } as StockItem]) }
  }

  function addTransaction(tx: StockTransaction) {
    setTransactions(p => [tx, ...p])
    setItems((p) => {
      const exists = p.find((i) => i.id === tx.item_id)
      if (exists) {
        return p.map((i) => {
          if (i.id !== tx.item_id) return i
          return {
            ...i,
            qty: i.qty + tx.qty,
            status: tx.set_status || i.status,
            serial_number: tx.serial_number || i.serial_number,
            brand: tx.manufacturer || i.brand,
            model: tx.model || i.model,
            qc_customer_org: tx.customer_org || i.qc_customer_org,
            qc_customer_contact: tx.customer_contact || i.qc_customer_contact,
            // If we receive back to stock, clear loan metadata.
            loaned_to: tx.set_status === "in_stock" ? undefined : i.loaned_to,
            loan_due: tx.set_status === "in_stock" ? undefined : i.loan_due,
            loan_date: tx.set_status === "in_stock" ? undefined : i.loan_date,
            stocked_at: i.stocked_at || tx.date,
          }
        })
      }

      // สร้างรายการในคลังใหม่สำหรับ "เครื่องใหม่" (ไม่มี item_id ในระบบเดิม)
      const nextItem: StockItem = {
        id: tx.item_id,
        name: tx.model || tx.item_name,
        brand: tx.manufacturer || "—",
        model: tx.model || tx.item_name,
        category: tx.category || "sellable",
        has_serial: !!tx.serial_number,
        serial_number: tx.serial_number,
        qty: tx.qty,
        min_qty: 0,
        unit: "เครื่อง",
        status: tx.set_status || "in_stock",
        qc_customer_org: tx.customer_org,
        qc_customer_contact: tx.customer_contact,
        stocked_at: tx.date,
      }
      return [nextItem, ...p]
    })

    // When returning an item with loan context, record customer loan evaluation.
    if (tx.type === "in" && tx.customer_org && tx.loan_date && tx.loan_due) {
      const overdueDays = Math.max(0, diffDays(tx.loan_due, tx.date))
      const record: ASLoanReturnHistory = {
        id: `lr-${Date.now()}`,
        customer_org: tx.customer_org,
        equipment_name: tx.item_name,
        loan_date: tx.loan_date,
        due_date: tx.loan_due,
        returned_at: tx.date,
        overdue_days: overdueDays,
        source: "receive_return",
        created_at: new Date().toISOString(),
      }
      appendLoanReturnHistory(record)
      setLoanReturnHistory((prev) => [record, ...prev])
    }

    if (tx.set_status === "pending_qc" && tx.customer_org && tx.customer_contact) {
      appendStockDispatch({
        id: `sd-qc-${Date.now()}`,
        item_name: tx.model || tx.item_name,
        manufacturer: tx.manufacturer,
        model: tx.model || tx.item_name,
        serial_number: tx.serial_number || "—",
        customer_org: tx.customer_org,
        customer_contact: tx.customer_contact,
        symptom: `QC ก่อนเข้า Stock (PO ${tx.reference})`,
        job_type: "calibration",
        routing: "overseas",
        dispatched_by: "Stock",
        dispatched_at: today,
        due_date: tx.due_date,
      })
      setDispatchSuccess(`ส่งตรวจเช็คก่อนเข้า Stock เรียบร้อยแล้ว (${tx.reference})`)
      setTimeout(() => setDispatchSuccess(null), 4000)
    }
  }

  function handleDispatch(form: DispatchForm) {
    appendStockDispatch({
      id: `sd-${Date.now()}`,
      item_name: form.item.name,
      serial_number: form.item.serial_number || "—",
      customer_org: form.customer_org,
      customer_contact: form.customer_name,
      symptom: form.symptom,
      job_type: form.job_type,
      dispatched_by: "Stock",
      dispatched_at: today,
    })
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

  function updateItemStatus(itemId: string, nextStatus: ItemStatus) {
    const target = items.find((i) => i.id === itemId)
    if (target?.status === nextStatus) return
    if (target && nextStatus === "sold" && target.serial_number) {
      const now = new Date().toISOString()
      const linkedModules = [
        ...(target.module_serials || []),
        ...(target.companion_serial ? [target.companion_serial] : []),
      ].filter(Boolean)
      linkedModules.forEach((moduleSn) => {
        const rec: ASModuleAssignment = {
          id: `ma-sold-${Date.now()}-${moduleSn}`,
          module_serial: moduleSn,
          from_parent_serial: target.serial_number,
          to_parent_serial: undefined,
          event: "sold",
          note: `Parent item sold (${target.name})`,
          created_at: now,
        }
        appendModuleAssignment(rec)
        setModuleAssignments((prev) => [rec, ...prev])
      })
    }
    if (target && nextStatus === "pending_qc") {
      const customerOrg = target.qc_customer_org?.trim() || "ลูกค้าไม่ระบุ"
      const customerContact = target.qc_customer_contact?.trim() || "ไม่ระบุผู้ติดต่อ"
      const exists = readStockDispatches([]).some(
        (d) =>
          d.serial_number === (target.serial_number || "—") &&
          d.customer_org === customerOrg &&
          d.job_type === "calibration" &&
          d.symptom === "QC ก่อนเข้า Stock (จาก Quick Action)",
      )
      if (!exists) {
        appendStockDispatch({
          id: `sd-qc-quick-${Date.now()}`,
          item_name: target.model || target.name,
          manufacturer: target.brand,
          model: target.model || target.name,
          serial_number: target.serial_number || "—",
          customer_org: customerOrg,
          customer_contact: customerContact,
          symptom: "QC ก่อนเข้า Stock (จาก Quick Action)",
          job_type: "calibration",
          routing: "overseas",
          dispatched_by: "Stock",
          dispatched_at: today,
        })
      }
    }

    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i
        return {
          ...i,
          status: nextStatus,
          reserved_by_sales: nextStatus === "reserved" ? i.reserved_by_sales : undefined,
          reserved_for_customer: nextStatus === "reserved" ? i.reserved_for_customer : undefined,
          loaned_to: nextStatus === "on_loan" ? i.loaned_to : undefined,
          loan_due: nextStatus === "on_loan" ? i.loan_due : undefined,
          loan_date: nextStatus === "on_loan" ? i.loan_date : undefined,
          stocked_at: nextStatus === "in_stock" ? (i.stocked_at || today) : i.stocked_at,
        }
      }),
    )
    setDispatchSuccess(`อัปเดตสถานะสินค้าเรียบร้อยแล้ว (${STATUS_LABELS[nextStatus]})`)
    setTimeout(() => setDispatchSuccess(null), 2500)
  }

  function quickLoanItem(item: StockItem, payload: { customer: string; dueDate: string }) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "on_loan",
              loaned_to: payload.customer,
              loan_due: payload.dueDate,
              loan_date: today,
            }
          : i,
      ),
    )
    setDispatchSuccess(`อัปเดตเป็น Loan แล้ว (${payload.customer})`)
    setTimeout(() => setDispatchSuccess(null), 2500)
  }

  function handleQuickAction(item: StockItem, action: string) {
    if (!action) return
    setActionMenuId(null)
    if (action === "send_job") {
      setDispatchDialog(item)
      return
    }
    if (action === "loan") {
      setLoanDialog(item)
      return
    }
    if (action === "return_loan") {
      setReturnDemoDialog(item)
      return
    }
    if (action === "edit_item") {
      setAddDialog({ open: true, data: item })
      return
    }
    if (action === "reassign_module") {
      if (!item.serial_number) return
      const moduleSn = window.prompt("Module SN to move")
      if (!moduleSn || !moduleSn.trim()) return
      const current = moduleAssignments.find((m) => m.module_serial === moduleSn.trim())
      const nextParent = window.prompt("New parent/display SN", "")
      if (!nextParent || !nextParent.trim()) return
      const rec: ASModuleAssignment = {
        id: `ma-${Date.now()}`,
        module_serial: moduleSn.trim(),
        from_parent_serial: current?.to_parent_serial,
        to_parent_serial: nextParent.trim(),
        event: "reassigned",
        note: `Reassigned from ${current?.to_parent_serial || "unknown"}`,
        created_at: new Date().toISOString(),
      }
      appendModuleAssignment(rec)
      setModuleAssignments((prev) => [rec, ...prev])
      setDispatchSuccess(`Module ${moduleSn.trim()} moved to ${nextParent.trim()}`)
      setTimeout(() => setDispatchSuccess(null), 2600)
      return
    }
    if (action === "separate_module") {
      if (!item.serial_number) return
      const moduleSn = window.prompt("Module SN to separate from parent")
      if (!moduleSn || !moduleSn.trim()) return
      const current = moduleAssignments.find((m) => m.module_serial === moduleSn.trim())
      const rec: ASModuleAssignment = {
        id: `ma-sep-${Date.now()}`,
        module_serial: moduleSn.trim(),
        from_parent_serial: current?.to_parent_serial || item.serial_number,
        to_parent_serial: undefined,
        event: "separated",
        note: `Separated from parent ${current?.to_parent_serial || item.serial_number}`,
        created_at: new Date().toISOString(),
      }
      appendModuleAssignment(rec)
      setModuleAssignments((prev) => [rec, ...prev])
      setDispatchSuccess(`Module ${moduleSn.trim()} separated from parent`)
      setTimeout(() => setDispatchSuccess(null), 2600)
      return
    }
    if (action.startsWith("status:")) {
      const nextStatus = action.replace("status:", "") as ItemStatus
      updateItemStatus(item.id, nextStatus)
    }
  }

  function createStockModel(modelName: string) {
    const normalized = modelName.trim()
    if (!normalized) return
    if (dropdownConfig.stock_models.includes(normalized)) return
    const next = {
      ...dropdownConfig,
      stock_models: [...dropdownConfig.stock_models, normalized].sort((a, b) => a.localeCompare(b)),
    }
    setDropdownConfig(next)
    writeDropdownConfig(next)
  }

  function createStockManufacturer(manufacturerName: string) {
    const normalized = manufacturerName.trim()
    if (!normalized) return
    if (dropdownConfig.stock_manufacturers.includes(normalized)) return
    const next = {
      ...dropdownConfig,
      stock_manufacturers: [...dropdownConfig.stock_manufacturers, normalized].sort((a, b) => a.localeCompare(b)),
    }
    setDropdownConfig(next)
    writeDropdownConfig(next)
  }

  const catCounts = (Object.keys(CAT_LABELS) as StockCategory[]).reduce((acc, c) => { acc[c] = items.filter(i => i.category === c).length; return acc }, {} as Record<StockCategory, number>)

  const TABS = [
    { id:"all" as Tab, label:"All Stock" },
    { id:"receive" as Tab, label:"Stock In / PO" },
    { id:"booking" as Tab, label:`Booking (${bookings.length})` },
    { id:"loan" as Tab, label:`Loan (${stockOnLoan.length})` },
    { id:"demo" as Tab, label:"Demo Tracker" },
  ]

  return (
    <div className="h-full flex flex-col relative z-10 p-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คลังสินค้า</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} รายการ
            {lowStock.length > 0 && <> · <span className="text-red-500 font-semibold">{lowStock.length} รายการต่ำกว่า Minimum</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setReceiveDialog(true)} className="modern-button premium-glow rounded-2xl text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-[0_8px_20px_rgba(16,185,129,0.3)]">
            <ArrowDownCircle className="h-4 w-4" /> รับเข้า
          </button>
          <button onClick={()=>setAddDialog({open:true,data:{}})} className="modern-button-primary premium-glow rounded-2xl">
            <Plus className="h-4 w-4" /> Item Master
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

      {(nearDueLoans.length > 0 || overdueLoans.length > 0 || badCustomers.length > 0) && (
        <div className="glass-panel rounded-2xl p-4 mb-4 premium-glow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Loan Alerts (Demo)</p>
              <p className="text-xs text-muted-foreground mt-1">
                เตือนลูกค้าตามกำหนดคืน · อัปเดตคะแนนเมื่อคืนเกินกำหนด
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {overdueLoans.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                  Urgent: {overdueLoans.length}
                </span>
              )}
              {nearDueLoans.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                  ใกล้ครบ: {nearDueLoans.length}
                </span>
              )}
              {badCustomers.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">
                  คะแนนต่ำ: {badCustomers.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">สถานะงานที่ส่งไป Service</p>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold">รอรับโดย Service ({pendingInServiceInbox})</span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">Service Request ({serviceRequestsFromStock.length})</span>
          </div>
        </div>
        {serviceRequestsFromStock.length === 0 ? (
          <p className="text-xs text-gray-500 mt-2">ยังไม่มีงานจาก Stock ที่ถูกแปลงเป็น Service Request</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {serviceRequestsFromStock.slice(0, 6).map((job) => (
              <div key={job.id} className="bg-white/80 border border-white rounded-xl px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-gray-500">{job.job_no}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[job.status]}`}>{statusLabel[job.status]}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{job.model}</p>
                <p className="text-xs text-gray-500 truncate">{job.customer_org}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass-panel rounded-2xl mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} data-active={tab===t.id} className={`tab-premium px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t.id ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: All Stock ───────────────────────────────────────────────────── */}
      {tab === "all" && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {lowStock.length > 0 && (
            <div className="glass-panel flex items-center gap-3 p-4 rounded-2xl">
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
          <div className="flex-1 overflow-auto rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Item / SN","Brand","Category","Qty","Min","Days In Stock","Status","Quick Action"].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <th className="px-4 py-2">
                    <span className="text-[11px] text-gray-400">Use Search box above</span>
                  </th>
                  <th className="px-4 py-2">
                    <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white">
                      <option value="all">All Brands</option>
                      {uniqueBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </th>
                  <th className="px-4 py-2">
                    <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as StockCategory | "all")} className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white">
                      <option value="all">All Categories</option>
                      {(Object.keys(CAT_LABELS) as StockCategory[]).map((c) => (
                        <option key={c} value={c}>{CAT_LABELS[c]}</option>
                      ))}
                    </select>
                  </th>
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">
                    <span className="text-[11px] text-gray-400">Oldest → Newest (fixed)</span>
                  </th>
                  <th className="px-4 py-2">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ItemStatus | "all")} className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white">
                      <option value="all">All Statuses</option>
                      {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => {
                  const isLow = item.qty < item.min_qty
                  const agingDays = getStockAgingDays(item)
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
                        <span className={`text-sm font-bold ${agingDays >= 180 ? "text-red-600" : agingDays >= 90 ? "text-amber-700" : "text-gray-700"}`}>
                          {agingDays}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">days</span>
                      </td>
                      <td className="px-4 py-3">
                        <Pill label={STATUS_LABELS[item.status]} color={STATUS_COLORS[item.status]} />
                        {item.reserved_by_sales && <p className="text-xs text-orange-600 mt-0.5">By {item.reserved_by_sales}</p>}
                        {item.reserved_for_customer && <p className="text-xs text-gray-500">{item.reserved_for_customer}</p>}
                        {item.loaned_to && <p className="text-xs text-blue-600 mt-0.5">{item.loaned_to}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionMenuId((prev) => (prev === item.id ? null : item.id))
                            }}
                            className="w-full min-w-[170px] inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <span>Quick Action</span>
                            <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                          {actionMenuId === item.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-1 w-52 rounded-xl border border-gray-200 bg-white shadow-lg z-20 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                            >
                              {(item.status === "in_stock" || item.status === "reserved") && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "send_job") }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-blue-700 hover:bg-blue-50">
                                  Send Job
                                </button>
                              )}
                              {item.status !== "on_loan" ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "loan") }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-indigo-700 hover:bg-indigo-50">
                                  Loan
                                </button>
                              ) : (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "return_loan") }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-indigo-700 hover:bg-indigo-50">
                                  Return Loan
                                </button>
                              )}
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "edit_item") }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                                Edit Item
                              </button>
                              {item.serial_number && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "reassign_module") }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                                  Re-assign Module
                                </button>
                              )}
                              {item.serial_number && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "separate_module") }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                                  Separate Module
                                </button>
                              )}
                              <div className="h-px bg-gray-100 my-1" />
                              {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleQuickAction(item, `status:${s}`) }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  {`Update Status -> ${STATUS_LABELS[s]}`}
                                </button>
                              ))}
                            </div>
                          )}
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
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Stock In/Out History</h3>
              <button onClick={()=>setReceiveDialog(true)} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600">
                <ArrowDownCircle className="h-4 w-4" /> Stock In
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["วันที่","สินค้า","ประเภท","จำนวน","PO / อ้างอิง","ชั้นวาง","ลูกค้าอ้างอิง","ผู้ติดต่อ","หมายเหตุ","อนุมัติโดย"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{tx.date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{tx.item_name}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tx.type==="in" ? "bg-green-100 text-green-700" : tx.type==="out" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{tx.type==="in" ? "รับเข้า" : tx.type==="out" ? "เบิกออก" : "ปรับ"}</span></td>
                    <td className="px-4 py-3 font-bold">{tx.type==="out" ? "-" : "+"}{tx.qty}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{tx.reference}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{tx.shelf_location || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{tx.customer_org || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{tx.customer_contact || "—"}</td>
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
              <h3 className="font-bold text-gray-900">การ Booking (Reserved) ของ Sales</h3>
              <p className="text-sm text-gray-500 mt-0.5">เจ้าหน้าที่ Stock เป็นผู้ตั้งสถานะ Reserved · แสดง Sales ที่จองและลูกค้าเป้าหมาย</p>
            </div>
            <button onClick={()=>setBookingDialog(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-colors">
              <Plus className="h-4 w-4" /> เพิ่ม Booking
            </button>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
            <Bookmark className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700">
              <span className="font-semibold">Stock Staff</span> เป็นผู้กำหนดและยกเลิกสถานะ <span className="font-semibold">Reserved</span> เมื่อ Sales แจ้งจองสินค้าให้ลูกค้า
              · ใช้ปุ่ม "เพิ่ม Booking" เพื่อบันทึก Sales ที่จองและชื่อลูกค้า
            </p>
          </div>

          {bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Bookmark className="h-16 w-16 mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีการ Booking</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {bookings.map(b => (
                <div key={b.id} className="p-5 bg-white rounded-3xl border-2 border-orange-200 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-gray-900">{b.item_name}</p>
                      {b.serial_number && <p className="font-mono text-xs text-blue-600 mt-0.5">SN: {b.serial_number}</p>}
                    </div>
                    <Pill label="Reserved" color={STATUS_COLORS.reserved} />
                  </div>
                  {/* จองโดย / Booked by section */}
                  <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 mb-3 space-y-2">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">จองโดย (Booked by)</p>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                      <span className="text-gray-600 text-xs">Sales:</span>
                      <span className="font-bold text-gray-900">{b.sales_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                      <span className="text-gray-600 text-xs">ลูกค้า:</span>
                      <span className="font-bold text-gray-900">{b.customer_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm mb-4">
                    <ClipboardList className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-500 text-xs">วันที่จอง: {b.booked_date}</span>
                    {b.note && <span className="text-gray-400 text-xs">· {b.note}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setDispatchDialog(items.find(i=>i.id===b.item_id) || null as any)} className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1">
                      <Send className="h-3 w-3" /> ส่งงาน Services
                    </button>
                    <button onClick={()=>removeBooking(b.id)} className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100">ยกเลิก Reserved</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Loan ────────────────────────────────────────────────────────── */}
      {tab === "loan" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">On Loan</h3>
                <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
                  {stockOnLoan.length} Items
                </span>
              </div>
              {stockOnLoan.length === 0 ? (
                <p className="text-sm text-gray-400">No items currently on loan.</p>
              ) : (
                <div className="space-y-2">
                  {stockOnLoan.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {item.loaned_to || "—"} · Due: {item.loan_due || "—"}
                      </p>
                      {item.serial_number && <p className="text-xs font-mono text-blue-700 mt-0.5">SN: {item.serial_number}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Reserved Items</h3>
                <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold">
                  {reservedItems.length} Items
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Reserved = lock stock status, Booking = reservation record with sales + customer context.
              </p>
              {reservedItems.length === 0 ? (
                <p className="text-sm text-gray-400">No reserved items.</p>
              ) : (
                <div className="space-y-2">
                  {reservedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Sales: {item.reserved_by_sales || "—"} · Customer: {item.reserved_for_customer || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
              <h3 className="font-bold text-gray-900">Module History</h3>
              <input
                value={moduleHistorySearch}
                onChange={(e) => setModuleHistorySearch(e.target.value)}
                className="w-full md:min-w-[320px] px-3 py-2 rounded-xl border border-gray-200 text-sm"
                placeholder="Search Module SN"
              />
            </div>
            <div className="space-y-2 max-h-[320px] overflow-auto">
              {moduleAssignments
                .filter((m) =>
                  moduleHistorySearch.trim()
                    ? m.module_serial.toLowerCase().includes(moduleHistorySearch.trim().toLowerCase())
                    : true,
                )
                .slice(0, 80)
                .map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setModuleHistoryDialogSn(m.module_serial)}
                    className="w-full text-left rounded-2xl border border-gray-100 px-4 py-3 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">{m.module_serial}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {m.event} · {m.from_parent_serial || "—"} {"->"} {m.to_parent_serial || "—"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                  </button>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3">Loan Return History</h3>
            {loanReturnHistory.length === 0 ? (
              <p className="text-sm text-gray-400">No loan return records yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <input
                    value={loanHistorySearch}
                    onChange={(e) => setLoanHistorySearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    placeholder="Search equipment or customer"
                  />
                  <select
                    value={loanHistoryCustomer}
                    onChange={(e) => setLoanHistoryCustomer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="all">All Customers</option>
                    {loanHistoryCustomers.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="px-3 py-2 rounded-xl border border-gray-100 text-sm text-gray-600 bg-gray-50">
                    {filteredLoanHistory.length} records
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                  <div className="rounded-2xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-2">Most Borrowed Equipment</p>
                    <div className="space-y-2">
                      {Array.from(
                        loanReturnHistory.reduce((acc, cur) => {
                          const key = cur.equipment_name || "Unknown"
                          acc.set(key, (acc.get(key) || 0) + 1)
                          return acc
                        }, new Map<string, number>()),
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{name}</span>
                            <span className="font-bold text-blue-700">{count} times</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-2">Top Customers by Borrowing</p>
                    <div className="space-y-2">
                      {Array.from(
                        loanReturnHistory.reduce((acc, cur) => {
                          const key = cur.customer_org || "Unknown"
                          acc.set(key, (acc.get(key) || 0) + 1)
                          return acc
                        }, new Map<string, number>()),
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{name}</span>
                            <span className="font-bold text-violet-700">{count} times</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4 mb-4">
                  <p className="text-xs text-gray-500 mb-2">Borrowing Frequency by Month</p>
                  <div className="space-y-2">
                    {loanByMonth.length === 0 ? (
                      <p className="text-sm text-gray-400">No monthly data.</p>
                    ) : (
                      loanByMonth.map(([month, count]) => (
                        <div key={month} className="flex items-center gap-3">
                          <span className="w-20 text-xs text-gray-600">{month}</span>
                          <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                            <div
                              className="h-2 bg-blue-500 rounded"
                              style={{ width: `${Math.max(8, (count / Math.max(...loanByMonth.map((x) => x[1]), 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-blue-700">{count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-auto">
                  {filteredLoanHistory.slice(0, 60).map((r) => (
                    <div key={r.id} className="rounded-2xl border border-gray-100 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{r.equipment_name || "Unknown equipment"}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {r.customer_org} · Loan: {r.loan_date} · Due: {r.due_date} · Returned: {r.returned_at}
                      </p>
                      <p className={`text-xs mt-0.5 ${r.overdue_days > 0 ? "text-red-600 font-semibold" : "text-emerald-700"}`}>
                        Overdue: {r.overdue_days} days
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Demo Tracker ────────────────────────────────────────────────── */}
      {tab === "demo" && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {badCustomers.length > 0 && (
            <div className="glass-card rounded-3xl p-5 premium-glow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">ลูกค้าที่คะแนนต่ำกว่า 6</p>
                  <p className="text-xs text-muted-foreground mt-1">มีประวัติยืมเครื่องแล้วคืนไม่ตรงเวลา</p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-violet-100 text-violet-700 text-xs font-bold">
                  {badCustomers.length} ราย
                </span>
              </div>
              <div className="space-y-2">
                {badCustomers.map((c) => (
                  <div key={c.customer_org} className="flex items-center justify-between gap-3 bg-white/70 border border-white/70 rounded-2xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{c.customer_org}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Score: <span className={c.score < 3 ? "text-red-600 font-bold" : "text-violet-700 font-bold"}>{c.score}</span> / 10 · Deduct: {c.deductions}
                      </p>
                    </div>
                    <button
                      onClick={() => setCustomerHistoryModal(c.customer_org)}
                      className="px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      ดูประวัติ
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {demoOnLoan.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Demo ที่ออกไปอยู่ ({demoOnLoan.length})</h3>
              <div className="grid grid-cols-2 gap-4">
                {demoOnLoan.map(item => {
                  const due = item.loan_due
                  const overdueDays = due ? diffDays(due, today) : 0
                  const daysUntilDue = due ? diffDays(today, due) : 999
                  const isUrgent = due ? overdueDays >= 1 : false
                  const isNear = due ? !isUrgent && daysUntilDue <= 3 : false
                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-3xl border-2 ${isUrgent ? "bg-red-50 border-red-200" : isNear ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="font-mono text-xs text-gray-500">SN: {item.serial_number}</p>
                        </div>
                        {isUrgent ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                            <AlertTriangle className="h-3 w-3" /> Urgent
                          </span>
                        ) : isNear ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                            <AlertTriangle className="h-3 w-3" /> ใกล้ครบกำหนด
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1.5 mb-4">
                        <p className="text-sm text-gray-700 font-semibold">{item.loaned_to}</p>
                        {item.loan_due && (
                          <p className="text-xs text-gray-500">
                            กำหนดคืน:{" "}
                            <span className={isUrgent ? "text-red-600 font-bold" : isNear ? "text-amber-800 font-bold" : ""}>
                              {item.loan_due}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>setReturnDemoDialog(item)} className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600">บันทึกคืน</button>
                        <button onClick={()=>setSellDemoDialog(item)} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600">ตัดขาย</button>
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
      {receiveDialog && (
        <ReceiveDialog
          items={items}
          dropdownConfig={dropdownConfig}
          onClose={()=>setReceiveDialog(false)}
          onSave={addTransaction}
          onCreateModel={createStockModel}
          onCreateManufacturer={createStockManufacturer}
          productCatalog={productCatalog}
        />
      )}
      {bookingDialog && <AddBookingDialog items={items} onClose={()=>setBookingDialog(false)} onSave={addBooking} />}
      {returnDemoDialog && (
        <ReturnDemoDialog
          item={returnDemoDialog}
          todayISO={today}
          onClose={() => setReturnDemoDialog(null)}
          onConfirm={(loanDate) => handleReturnDemoConfirmed(returnDemoDialog, loanDate)}
        />
      )}
      {sellDemoDialog && (
        <SellDemoDialog
          item={sellDemoDialog}
          todayISO={today}
          onClose={() => setSellDemoDialog(null)}
          onConfirm={(payload) => confirmSellDemo(sellDemoDialog, payload)}
        />
      )}
      {loanDialog && (
        <LoanDialog
          item={loanDialog}
          todayISO={today}
          onClose={() => setLoanDialog(null)}
          onConfirm={(payload) => quickLoanItem(loanDialog, payload)}
        />
      )}
      {moduleHistoryDialogSn && (
        <ModuleHistoryDialog
          moduleSerial={moduleHistoryDialogSn}
          records={moduleAssignments.filter((m) => m.module_serial === moduleHistoryDialogSn)}
          onClose={() => setModuleHistoryDialogSn(null)}
        />
      )}
      {customerHistoryModal && (
        <CustomerLoanHistoryModal
          customerOrg={customerHistoryModal}
          records={loanReturnHistory.filter((r) => r.customer_org === customerHistoryModal)}
          onClose={() => setCustomerHistoryModal(null)}
        />
      )}
    </div>
  )
}
