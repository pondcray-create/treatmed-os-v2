"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  Package,
  Plus,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  FlaskConical,
  ShoppingCart,
  Zap,
  Drill,
  Camera,
  ChevronRight,
  Bookmark,
  Send,
  User,
  Building2,
  ClipboardList,
  MoreHorizontal,
  ArrowDownCircle,
  Bell,
  LayoutGrid,
  ShieldCheck,
  History,
  ArrowLeftRight,
  Sparkles,
  Activity,
  type LucideIcon,
} from "lucide-react"
import {
  appendModuleAssignment,
  appendLoanReturnHistory,
  appendStockDispatch,
  readJobs,
  readLoanReturnHistory,
  readModuleAssignments,
  readOrganizations,
  readDropdownConfig,
  readProductCatalog,
  upsertOrganizationByName,
  writeOrganizations,
  readProactiveCalibrationAssets,
  readStockDispatches,
  readStockDispatchHistory,
  readStockOutboundTraceLog,
  readPartsRequests,
  updatePartsRequestStatus,
  readStockNotifications,
  markStockNotificationRead,
  appendStockOutboundTraceLog,
  appendEquipmentHistory,
  writeProactiveCalibrationAssets,
  writeJobsWithConcurrencyCheck,
  readJobsVersion,
  readCommissioningClaimCases,
  updateCommissioningClaimCase,
  tryReadJSON,
  AS_STORE_KEYS,
  writeStockItemsWithVersion,
  readStockItemsVersion,
  writeStockTransactionsLedger,
  writeStockBookingsLedger,
  type ASDropdownConfig,
  type ASContact,
  type ASModuleAssignment,
  type ASLoanReturnHistory,
  type ASOrganization,
  type ProductCatalogGroup,
  type ASProactiveCalibrationAsset,
  type ASServiceJob,
  type ASStockDispatchHistoryEntry,
  type ASStockOutboundTraceLogEntry,
  type ASPartsRequest,
  type ASStockNotification,
  type ASCommissioningClaimCase,
  appendSEDealActivity,
  readSEDeals,
  readSEOrderRequests,
  setSEOrderRequestPoVerified,
  type SEDeal,
  type SEOrderRequest,
} from "@/lib/mock/as-store"
import { formatThDateFromYMD, formatThDateTime, thDateInputBeHint } from "@/lib/format-th-datetime"
import { cn } from "@/lib/utils"
import { newId } from "@/lib/new-id"
import { canApproveStockLoan, readMockSession } from "@/lib/mock/session"
import { getStockPatternManufacturers, getStockPatternModelsForManufacturer } from "@/lib/product-catalog-options"
import { getReceiveModuleSpec } from "@/lib/receive-module-spec"
import { Badge } from "@/components/ui/badge"

type StockCategory = "spare_part" | "module" | "sellable" | "consumable" | "tool" | "demo"
type ItemStatus = "in_stock" | "reserved" | "on_loan" | "sold" | "pending_qc"
type Tab = "all" | "booking" | "claim" | "sold_history" | "loan" | "demo" | "service_history"
type ServiceJobTypeFilter = "all" | ASServiceJob["job_type"]
/** เรียงลำดับในตาราง All Stock — ไม่บังคับ "เก่าก่อน" ค่าเริ่มต้นเป็นตามลำดับในระบบ */
type StockTableSort = "default" | "days_high" | "days_low" | "name_az" | "qty_high"

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
  /** หลังตัดขายให้ลูกค้า */
  sold_to_org?: string
  sold_contact?: string
  sold_customer_po?: string
  sold_warranty?: string
  sold_pm_per_year?: number
  sold_calibrations_per_year?: number
  sold_calibration_plan_start?: string
  sold_calibration_plan_end?: string
  sold_at?: string
  /** วันที่สอบเทียบล่าสุดของเครื่อง (กรอกตอนรับเข้า) */
  last_calibration_date?: string
  /** Due date สอบเทียบของเครื่อง */
  calibration_due_date?: string
  /** ไม่ใช่ Demo: ต้องอนุมัติก่อนเปิดฟอร์ม Loan — Demo ไม่ใช้ฟิลด์นี้ */
  loan_approval_status?: "pending" | "approved"
  loan_approval_note?: string
  /** audit — mock session userId เมื่ออนุมัติยืม */
  loan_approved_at?: string
  loan_approved_by?: string
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
  /** PO ของลูกค้า (ตอนตัดขาย) */
  customer_po?: string
  /** รับเข้า — SN ของแต่ละ module (เช่น IDA6) */
  module_serials?: string[]
  /** รับเข้า — SN ของ SPOT / SPOTLIGHT คู่กับเครื่องหลัก */
  companion_serial?: string
  /** มาจาก Input Product เท่านั้น — ใช้ลง Calibration Proactive */
  input_product_receive?: boolean
  /** วันที่ Cal ล่าสุดจริงของเครื่องตอนรับเข้า (ถ้ามี) */
  equipment_calibration_date?: string
}

interface Booking {
  id: string; item_id: string; item_name: string; serial_number?: string
  sales_name: string; customer_name: string; booked_date: string; note?: string
  source?: "stock_manual" | "se_deal"
  se_deal_id?: string
  request_status?: "pending" | "approved" | "rejected"
  stock_feedback?: string
  decided_at?: string
}

interface DispatchForm {
  item: StockItem; job_type: "repair" | "calibration" | "commissioning"
  customer_org: string; customer_name: string; symptom: string
  receive_channel: "พนักงาน" | "ขนส่งเอกชน"
  tracking_in: string
  received_by: string
}

/** Demo ยืมออกได้ทันที — ไม่ใช่ Demo ต้องอนุมัติก่อน */
function isLoanDemoCategory(item: StockItem) {
  return item.category === "demo"
}

function canOpenStockLoanForm(item: StockItem) {
  if (item.status !== "in_stock" && item.status !== "reserved") return false
  if (isLoanDemoCategory(item)) return true
  return item.loan_approval_status === "approved"
}

/** อนุญาตให้ตัดขาย (ไม่รวม on_loan / pending_qc / sold) */
const STATUSES_ALLOWED_SELL: ItemStatus[] = ["in_stock", "reserved"]

function tryApplyStockTx(
  p: StockItem[],
  tx: StockTransaction,
): { ok: boolean; next: StockItem[]; error?: string } {
  const delta =
    tx.type === "in" ? Math.abs(tx.qty) : tx.type === "out" ? -Math.abs(tx.qty) : tx.qty

  const exists = p.find((i) => i.id === tx.item_id)
  if (exists) {
    const nextQty = exists.qty + delta
    if (nextQty < 0) {
      return { ok: false, next: p, error: "รับเข้า/จ่ายออกไม่สำเร็จ: จำนวนในคลังไม่พอ" }
    }
    return {
      ok: true,
      next: p.map((i) => {
        if (i.id !== tx.item_id) return i
        return {
          ...i,
          qty: nextQty,
          status: tx.set_status || i.status,
          serial_number: tx.serial_number || i.serial_number,
          brand: tx.manufacturer || i.brand,
          model: tx.model || i.model,
          qc_customer_org: tx.customer_org || i.qc_customer_org,
          qc_customer_contact: tx.customer_contact || i.qc_customer_contact,
          loaned_to: tx.set_status === "in_stock" ? undefined : i.loaned_to,
          loan_due: tx.set_status === "in_stock" ? undefined : i.loan_due,
          loan_date: tx.set_status === "in_stock" ? undefined : i.loan_date,
          stocked_at: i.stocked_at || tx.date,
          last_calibration_date: tx.equipment_calibration_date?.trim() || i.last_calibration_date,
          calibration_due_date: tx.equipment_calibration_date?.trim()
            ? addYearsToISODate(tx.equipment_calibration_date.trim(), 1)
            : i.calibration_due_date,
        }
      }),
    }
  }

  if (tx.type !== "in") {
    return { ok: false, next: p, error: "จ่ายออกไม่ได้: ไม่พบรายการในคลัง" }
  }

  const nextItem: StockItem = {
    id: tx.item_id,
    name: tx.model || tx.item_name,
    brand: tx.manufacturer || "—",
    model: tx.model || tx.item_name,
    category: tx.category || "sellable",
    has_serial: !!tx.serial_number || !!(tx.module_serials && tx.module_serials.length) || !!tx.companion_serial,
    serial_number: tx.serial_number,
    module_serials: tx.module_serials && tx.module_serials.length > 0 ? tx.module_serials : undefined,
    companion_serial: tx.companion_serial || undefined,
    qty: Math.max(0, tx.qty),
    min_qty: 0,
    unit: "เครื่อง",
    status: tx.set_status || "in_stock",
    qc_customer_org: tx.customer_org,
    qc_customer_contact: tx.customer_contact,
    stocked_at: tx.date,
    last_calibration_date: tx.equipment_calibration_date?.trim() || undefined,
    calibration_due_date: tx.equipment_calibration_date?.trim()
      ? addYearsToISODate(tx.equipment_calibration_date.trim(), 1)
      : undefined,
  }
  return { ok: true, next: [nextItem, ...p] }
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
  in_stock: "In Stock",
  reserved: "Booking",
  on_loan: "On Loan",
  sold: "Sold",
  pending_qc: "Pending QC",
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

/** ลูกค้า placeholder บนรายการ Proactive สำหรับ SN ที่ลงจากรับเข้า Stock */
const PROACTIVE_ORG_STOCK_INBOUND = "Stock — Input Product"

function addYearsToISODate(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

function addMonthsToISODate(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function todayYmdInBangkok(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const d = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !d) return now.toISOString().slice(0, 10)
  return `${y}-${m}-${d}`
}

function collectStockInboundSerials(tx: StockTransaction): string[] {
  const list: string[] = []
  const main = tx.serial_number?.trim()
  if (main) list.push(main)
  if (tx.module_serials?.length) {
    for (const s of tx.module_serials) {
      const t = s.trim()
      if (t) list.push(t)
    }
  }
  const comp = tx.companion_serial?.trim()
  if (comp) list.push(comp)
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const s of list) {
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(s)
  }
  return uniq
}

/**
 * ลง / อัปเดต `as_proactive_calibration_assets` เมื่อรับเข้าผ่าน Input Product
 * — last_calibration_date = equipment_calibration_date หรือวันรับเข้า
 * — due_date = last_cal + 1 ปี (คำนวณอัตโนมัติ)
 */
function upsertProactiveCalibrationFromInputProduct(tx: StockTransaction) {
  if (tx.type !== "in" || !tx.input_product_receive) return
  const serials = collectStockInboundSerials(tx)
  if (serials.length === 0) return
  const assets = readProactiveCalibrationAssets([])
  const recv = tx.date
  const lastCal = (tx.equipment_calibration_date?.trim() || recv).slice(0, 10)
  const due = addYearsToISODate(lastCal, 1)
  const mfg = tx.manufacturer?.trim() || "—"
  const model = (tx.model || tx.item_name).trim() || "—"
  const ref = tx.reference?.trim() || "—"
  let next = [...assets]
  for (const serial of serials) {
    const key = serial.toLowerCase()
    const existing = next.find((a) => a.serial_number.trim().toLowerCase() === key)
    const id = existing?.id || newId("pc-in")
    const record: ASProactiveCalibrationAsset = {
      id,
      customer_org: PROACTIVE_ORG_STOCK_INBOUND,
      manufacturer: mfg,
      model,
      serial_number: serial,
      last_calibration_date: lastCal,
      due_date: due,
      note: existing ? `Re-sync from Input Product (PO ${ref})` : `Auto from Input Product (PO ${ref})`,
      created_at: existing?.created_at || recv,
    }
    next = existing ? next.map((a) => (a.id === existing.id ? record : a)) : [record, ...next]
  }
  writeProactiveCalibrationAssets(next)
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
  const [dateErr, setDateErr] = useState<string | null>(null)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!loanDate) return
    setDateErr(null)
    if (parseISODateToUTC(loanDate) > parseISODateToUTC(todayISO)) {
      setDateErr("วันที่ลูกค้ายืมต้องไม่เกินวันนี้ (วันที่รับคืน)")
      return
    }
    if (item.loan_due && parseISODateToUTC(loanDate) > parseISODateToUTC(item.loan_due)) {
      setDateErr("วันที่ยืมไม่ควรหลังกำหนดคืน — ตรวจสอบอีกครั้ง")
      return
    }
    onConfirm(loanDate)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            {item.category === "demo" ? "รับคืน Demo" : "รับคืนจาก Loan"}
          </h3>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 bg-blue-50 rounded-2xl mb-4 border border-blue-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
          {item.loan_due && (
            <p className="text-[10px] text-blue-600 mt-0.5 leading-tight">
              กำหนดคืน: {formatThDateFromYMD(item.loan_due)}
              <span className="font-mono text-[9px] text-blue-500 ml-1">{item.loan_due}</span>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              วันที่ลูกค้ายืม *
            </label>
            <input
              type="date"
              required
              max={todayISO}
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
              className={inp}
            />
            <p className="text-[10px] text-gray-500 mt-1 leading-snug">{thDateInputBeHint(loanDate)}</p>
          </div>
          {dateErr && <p className="text-xs text-red-600">{dateErr}</p>}
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

function LoanRequestApprovalDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (note: string) => void
}) {
  const [note, setNote] = useState("")
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
  function submit(e: FormEvent) {
    e.preventDefault()
    onConfirm(note)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">ขออนุมัติยืม (ไม่ใช่ Demo)</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 mb-4 text-sm text-amber-900">
          <p className="font-semibold text-gray-900">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-amber-800 mt-0.5">SN: {item.serial_number}</p>}
          <p className="text-xs mt-2 leading-relaxed">
            สินค้าที่<strong>ไม่ใช่ Demo</strong>ต้องได้รับอนุมัติจาก Stock/Admin ก่อนจึงจะยืมออกได้ · บันทึกคำขอแล้วให้ผู้อนุมัติใช้ Quick Action <strong>อนุมัติการยืม</strong>
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">เหตุผล / หมายเหตุ (ถ้ามี)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inp} resize-none`}
              rows={3}
              placeholder="เช่น ขอยืมทดสอบตามคำขอ Sales..."
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">
              บันทึกคำขออนุมัติ
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
  priorApprovalRequired,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (payload: { customer: string; dueDate: string; dealId?: string }) => void
  todayISO: string
  /** true = สินค้าไม่ใช่ Demo (ผ่านขั้นอนุมัติแล้ว) */
  priorApprovalRequired: boolean
}) {
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  const [orgPick, setOrgPick] = useState("")
  const [freeOrg, setFreeOrg] = useState("")
  const [dueDate, setDueDate] = useState(item.loan_due || todayISO)
  const [dueErr, setDueErr] = useState<string | null>(null)
  const [seDeals, setSeDeals] = useState<SEDeal[]>([])
  const [dealLink, setDealLink] = useState("")
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"

  useEffect(() => {
    const loaded = readOrganizations([])
    setOrgs(loaded)
    const lt = item.loaned_to?.trim()
    if (lt && loaded.some((o) => o.name === lt)) setOrgPick(lt)
    else if (lt) {
      setOrgPick("__other__")
      setFreeOrg(lt)
    }
    setSeDeals(readSEDeals([]))
    setDealLink("")
  }, [item.id, item.loaned_to])

  const orgNameLive = orgPick === "__other__" ? freeOrg.trim() : orgPick.trim()
  const matchingDeals = useMemo(
    () =>
      orgNameLive
        ? seDeals.filter((d) => d.customer_name.trim().toLowerCase() === orgNameLive.toLowerCase())
        : [],
    [seDeals, orgNameLive],
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setDueErr(null)
    const orgName = orgPick === "__other__" ? freeOrg.trim() : orgPick.trim()
    if (!orgName || !dueDate) return
    if (parseISODateToUTC(dueDate) < parseISODateToUTC(todayISO)) {
      setDueErr("กำหนดคืนต้องไม่ก่อนวันนี้")
      return
    }
    const nextOrgs = upsertOrganizationByName(readOrganizations([]), orgName, undefined)
    writeOrganizations(nextOrgs)
    const dealOk = dealLink && matchingDeals.some((d) => d.id === dealLink)
    onConfirm({ customer: orgName, dueDate, dealId: dealOk ? dealLink : undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Loan — ยืมให้ลูกค้า</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 bg-indigo-50 rounded-2xl mb-4 border border-indigo-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-indigo-700 mt-0.5">SN: {item.serial_number}</p>}
          {priorApprovalRequired && (
            <p className="text-[11px] text-emerald-800 font-semibold mt-2 leading-snug">
              ✓ ผ่านการอนุมัติยืมแล้ว — สินค้าไม่ใช่ Demo ยืมได้เฉพาะหลังอนุมัติเท่านั้น
            </p>
          )}
          {!priorApprovalRequired && isLoanDemoCategory(item) && (
            <p className="text-[11px] text-indigo-800 mt-2 leading-snug">
              <strong>Demo Unit</strong> — ยืมออกได้ทันทีโดยไม่ต้องขออนุมัติ
            </p>
          )}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">หน่วยงานลูกค้า (ฐานข้อมูล) *</label>
            <select
              required={orgPick !== "__other__"}
              value={orgPick}
              onChange={(e) => setOrgPick(e.target.value)}
              className={inp}
            >
              <option value="">-- เลือกหน่วยงาน --</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
              <option value="__other__">+ ไม่อยู่ในรายชื่อ (พิมพ์ใหม่ → ลงทะเบียนอัตโนมัติ)</option>
            </select>
          </div>
          {orgPick === "__other__" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อหน่วยงาน *</label>
              <input required value={freeOrg} onChange={(e) => setFreeOrg(e.target.value)} className={inp} placeholder="ชื่อโรงพยาบาล / หน่วยงาน" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">กำหนดคืน *</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
            <p className="text-[10px] text-gray-500 mt-1 leading-snug">{thDateInputBeHint(dueDate)}</p>
          </div>
          {orgNameLive ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ผูกดีล SE (ไม่บังคับ)</label>
              <select
                value={dealLink}
                onChange={(e) => setDealLink(e.target.value)}
                className={inp}
              >
                <option value="">ไม่ผูกดีล</option>
                {matchingDeals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.deal_no} · {d.title}
                  </option>
                ))}
              </select>
              {matchingDeals.length === 0 && (
                <p className="text-[10px] text-amber-700 mt-1 leading-snug">
                  ไม่มีดีลที่ชื่อลูกค้าตรงกับหน่วยงานนี้ — บันทึก Activity อัตโนมัติเมื่อเลือกดีลได้หลังมีดีลตรงชื่อ
                </p>
              )}
            </div>
          ) : null}
          {dueErr && <p className="text-xs text-red-600">{dueErr}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600">
              ยืนยันยืม
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Module Timeline</h3>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
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
                <span className="text-xs text-gray-500">{formatThDateTime(m.created_at)}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">ประวัติการคืนเครื่องช้า</h3>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
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
          <table className="w-full min-w-[720px] text-sm">
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

/** ค่าเริ่มต้น MOCK เมื่อ localStorage ว่าง — ใช้เฉพาะ dev หรือเมื่อตั้ง NEXT_PUBLIC_STOCK_DEV_SEED=true */
const USE_STOCK_DEV_SEED =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_STOCK_DEV_SEED === "true"

const SALES_STAFF = ["คุณสมหมาย", "คุณวิภาพร", "คุณธนากร", "คุณพรรณิภา"]

function findOrgByNameLoose(orgs: ASOrganization[], name: string): ASOrganization | undefined {
  const q = name.trim().toLowerCase()
  if (!q) return undefined
  return orgs.find((o) => o.name.trim().toLowerCase() === q)
}

/**
 * ลูกค้าที่ผูกกับรายการสต็อกแล้ว — ใช้เติมอัตโนมัติตอน Send to Services
 * ลำดับ: Booking → Loan → QC (รับเข้า / Commissioning) → ตัดขาย (Sold)
 */
function getStockItemLinkedCustomer(item: StockItem): {
  org: string
  contact: string
  sourceLabel: string
} | null {
  const booking = item.reserved_for_customer?.trim()
  if (booking) {
    return { org: booking, contact: "", sourceLabel: "Booking" }
  }
  const loan = item.loaned_to?.trim()
  if (loan) {
    return { org: loan, contact: "", sourceLabel: "Loan" }
  }
  const qcOrg = item.qc_customer_org?.trim()
  if (qcOrg) {
    return {
      org: qcOrg,
      contact: item.qc_customer_contact?.trim() ?? "",
      sourceLabel: "QC / รับเข้า",
    }
  }
  const soldOrg = item.sold_to_org?.trim()
  if (soldOrg) {
    return {
      org: soldOrg,
      contact: item.sold_contact?.trim() ?? "",
      sourceLabel: "ตัดขาย (Sold)",
    }
  }
  return null
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

// ── Dispatch to Services Dialog ───────────────────────────────────────────────
function DispatchDialog({ item, onClose, onConfirm }: { item: StockItem; onClose: () => void; onConfirm: (d: DispatchForm) => void }) {
  const [form, setForm] = useState<DispatchForm>({
    item,
    job_type: "repair",
    customer_org: "",
    customer_name: "",
    symptom: "",
    receive_channel: "พนักงาน",
    tracking_in: "",
    received_by: "",
  })
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  const [customerNotInDb, setCustomerNotInDb] = useState(false)
  const [freeOrgName, setFreeOrgName] = useState("")
  const [freeContactName, setFreeContactName] = useState("")
  const [linkedHint, setLinkedHint] = useState<string | null>(null)

  useEffect(() => {
    setOrgs(readOrganizations([]))
  }, [])

  /** เมื่อรายการสต็อกผูกลูกค้าแล้ว → เติมหน่วยงาน/ผู้ติดต่อก่อนส่งงานอัตโนมัติ */
  useEffect(() => {
    const linked = getStockItemLinkedCustomer(item)
    if (!linked) {
      setLinkedHint(null)
      setCustomerNotInDb(false)
      setFreeOrgName("")
      setFreeContactName("")
      setForm({
        item,
        job_type: "repair",
        customer_org: "",
        customer_name: "",
        symptom: "",
        receive_channel: "พนักงาน",
        tracking_in: "",
        received_by: "",
      })
      return
    }

    const loaded = readOrganizations([])
    const orgMatch = findOrgByNameLoose(loaded, linked.org)

    if (orgMatch) {
      const primary =
        orgMatch.contacts.find((c) => c.is_primary)?.name ??
        orgMatch.contacts[0]?.name ??
        ""
      setCustomerNotInDb(false)
      setFreeOrgName("")
      setFreeContactName("")
      setForm({
        item,
        job_type: "repair",
        customer_org: orgMatch.name,
        customer_name: linked.contact || primary || "",
        symptom: "",
        receive_channel: "พนักงาน",
        tracking_in: "",
        received_by: "",
      })
      setLinkedHint(`เติมชื่อลูกค้าอัตโนมัติจาก ${linked.sourceLabel} — ตรวจสอบก่อนส่ง`)
    } else {
      setCustomerNotInDb(true)
      setFreeOrgName(linked.org)
      setFreeContactName(linked.contact)
      setForm({
        item,
        job_type: "repair",
        customer_org: "",
        customer_name: "",
        symptom: "",
        receive_channel: "พนักงาน",
        tracking_in: "",
        received_by: "",
      })
      setLinkedHint(
        linked.contact
          ? `เติมจาก ${linked.sourceLabel} — หน่วยงานยังไม่อยู่ในรายชื่อ (โหมดกรอกใหม่)`
          : `เติมชื่อหน่วยงานจาก ${linked.sourceLabel} — กรุณากรอกผู้ติดต่อ`,
      )
    }
  }, [item])

  const selectedOrg = orgs.find((o) => o.name === form.customer_org)
  const contacts: ASContact[] = selectedOrg?.contacts ?? []
  const contactsRequired = !customerNotInDb && contacts.length > 0

  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e: React.FormEvent) {
    e.preventDefault()
    let org = form.customer_org.trim()
    let contact = form.customer_name.trim()
    if (customerNotInDb) {
      org = freeOrgName.trim()
      contact = freeContactName.trim()
    }
    if (!org || !form.symptom.trim()) return
    if (customerNotInDb && !contact) return
    if ((form.job_type === "repair" || form.job_type === "calibration") && form.receive_channel === "ขนส่งเอกชน" && !form.tracking_in.trim()) return
    if ((form.job_type === "repair" || form.job_type === "calibration") && form.receive_channel === "พนักงาน" && !form.received_by.trim()) return
    const nextOrgs = upsertOrganizationByName(readOrganizations([]), org, contact || undefined)
    writeOrganizations(nextOrgs)
    onConfirm({
      ...form,
      customer_org: org,
      customer_name: contact || "ไม่ระบุ",
      tracking_in: form.tracking_in.trim(),
      received_by: form.received_by.trim(),
    })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" /> Send to Services
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 bg-blue-50 rounded-2xl mb-4 border border-blue-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
          {linkedHint ? (
            <p className="text-[11px] text-emerald-900 mt-2 leading-snug rounded-xl bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-2 font-medium">
              {linkedHint}
            </p>
          ) : (
            <p className="text-[11px] text-blue-700 mt-2 leading-snug">
              รองรับลูกค้าที่ยังไม่อยู่ในฐานข้อมูล — ระบบจะลงทะเบียนหน่วยงานอัตโนมัติเมื่อยืนยัน
            </p>
          )}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทงาน</label>
            <div className="flex gap-2">
              {(
                [
                  ["repair", "🔧 Repair"],
                  ["calibration", "📐 Calibration"],
                  ["commissioning", "✅ Commissioning Test"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, job_type: v }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    form.job_type === v
                      ? v === "repair"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : v === "calibration"
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={customerNotInDb} onChange={(e) => setCustomerNotInDb(e.target.checked)} className="rounded border-gray-300" />
            หน่วยงานยังไม่อยู่ในรายชื่อ (กรอกใหม่ + ลงทะเบียนอัตโนมัติ)
          </label>

          {!customerNotInDb ? (
            <>
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
                  <option value="">{contactsRequired ? "-- เลือกผู้ติดต่อ --" : "— พิมพ์ชื่อในช่องอาการ หรือเว้นว่าง"}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                      {c.position ? ` (${c.position})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อหน่วยงาน / ลูกค้า *</label>
                <input required value={freeOrgName} onChange={(e) => setFreeOrgName(e.target.value)} className={inp} placeholder="เช่น โรงพยาบาล..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ผู้ติดต่อ *</label>
                <input required value={freeContactName} onChange={(e) => setFreeContactName(e.target.value)} className={inp} placeholder="ชื่อผู้ส่งเครื่อง" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">อาการ / เหตุผล *</label>
            <textarea
              required
              value={form.symptom}
              onChange={(e) => setForm((f) => ({ ...f, symptom: e.target.value }))}
              className={`${inp} resize-none`}
              rows={3}
              placeholder="อาการเสียหรือเหตุผลที่ส่งซ่อม/สอบเทียบ/Commissioning"
            />
          </div>
          {(form.job_type === "repair" || form.job_type === "calibration") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ช่องทางรับเครื่อง *</label>
                <div className="flex gap-2">
                  {(["พนักงาน", "ขนส่งเอกชน"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, receive_channel: c }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                        form.receive_channel === c ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {form.receive_channel === "ขนส่งเอกชน" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tracking In *</label>
                  <input
                    required
                    value={form.tracking_in}
                    onChange={(e) => setForm((f) => ({ ...f, tracking_in: e.target.value }))}
                    className={inp}
                    placeholder="เลขพัสดุขาเข้า"
                  />
                </div>
              )}
              {form.receive_channel === "พนักงาน" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ผู้รับเครื่อง (พนักงาน) *</label>
                  <input
                    required
                    value={form.received_by}
                    onChange={(e) => setForm((f) => ({ ...f, received_by: e.target.value }))}
                    className={inp}
                    placeholder="ชื่อผู้รับเครื่อง"
                  />
                </div>
              )}
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">
              Send to Services
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Booking Dialog ────────────────────────────────────────────────────────
function AddBookingDialog({
  items,
  existingBookings,
  prefillItemId,
  onClose,
  onSave,
}: {
  items: StockItem[]
  existingBookings: Booking[]
  prefillItemId?: string | null
  onClose: () => void
  onSave: (b: Booking) => void
}) {
  const serialItems = items.filter((i) => i.has_serial && i.serial_number && (i.status === "in_stock" || i.status === "reserved"))
  const [form, setForm] = useState({ item_id: "", sales_name: "", customer_pick: "", customer_other: "", note: "" })
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  useEffect(() => {
    setOrgs(readOrganizations([]))
  }, [])
  useEffect(() => {
    if (!prefillItemId) return
    setForm((f) => ({ ...f, item_id: prefillItemId }))
  }, [prefillItemId])
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white"
  const selectedItem = serialItems.find((i) => i.id === form.item_id)
  const lockItemSelect = Boolean(prefillItemId && serialItems.some((i) => i.id === prefillItemId))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem) return
    if (existingBookings.some((b) => b.item_id === form.item_id)) {
      window.alert("รายการนี้มี Booking อยู่แล้ว — ปลดการจองเดิมก่อน หรือใช้แถวเดิม")
      return
    }
    const customerName = form.customer_pick === "__other__" ? form.customer_other.trim() : form.customer_pick.trim()
    if (!customerName) return
    const nextOrgs = upsertOrganizationByName(readOrganizations([]), customerName, undefined)
    writeOrganizations(nextOrgs)
    onSave({
      id: newId("bk"),
      item_id: form.item_id,
      item_name: selectedItem.name,
      serial_number: selectedItem.serial_number,
      sales_name: form.sales_name,
      customer_name: customerName,
      booked_date: new Date().toISOString().split("T")[0],
      note: form.note,
      source: "stock_manual",
      request_status: "approved",
    })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-orange-500" /> เพิ่มการ Booking
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">เลือกสินค้า (SN) *</label>
            <select
              required
              disabled={lockItemSelect}
              value={form.item_id}
              onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))}
              className={inp}
            >
              <option value="">-- เลือก SN --</option>
              {serialItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — SN: {i.serial_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales ที่ Booking *</label>
            <select required value={form.sales_name} onChange={(e) => setForm((f) => ({ ...f, sales_name: e.target.value }))} className={inp}>
              <option value="">-- เลือก Sales --</option>
              {SALES_STAFF.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ลูกค้า (หน่วยงาน) *</label>
            <select
              required={form.customer_pick !== "__other__"}
              value={form.customer_pick}
              onChange={(e) => setForm((f) => ({ ...f, customer_pick: e.target.value }))}
              className={inp}
            >
              <option value="">-- เลือกหน่วยงาน --</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
              <option value="__other__">+ ไม่อยู่ในรายชื่อ (พิมพ์ใหม่)</option>
            </select>
          </div>
          {form.customer_pick === "__other__" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อหน่วยงาน *</label>
              <input required value={form.customer_other} onChange={(e) => setForm((f) => ({ ...f, customer_other: e.target.value }))} className={inp} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label>
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inp} placeholder="เช่น รอ PO, นัดส่งวันที่..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">
              บันทึก Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Item Dialog ───────────────────────────────────────────────────────────
function AddItemDialog({ item, onClose, onSave }: { item: Partial<StockItem>|null; onClose:()=>void; onSave:(d:Partial<StockItem>)=>void }) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    brand: item?.brand ?? "",
    category: item?.category ?? ("spare_part" as StockCategory),
    has_serial: item?.has_serial ?? false,
    serial_number: item?.serial_number ?? "",
    qty: item?.qty ?? 0,
    min_qty: item?.min_qty ?? 0,
    unit: item?.unit ?? "ชิ้น",
    last_calibration_date: item?.last_calibration_date ?? "",
    calibration_due_date: item?.calibration_due_date ?? "",
  })
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      ...item,
      ...form,
      last_calibration_date: form.last_calibration_date.trim() || undefined,
      calibration_due_date: form.calibration_due_date.trim() || undefined,
    })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <h2 className="font-bold text-lg">{item?.id ? "Edit Item Master" : "Add Item Master"}</h2>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
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
          {item?.id ? (
            <>
              <button type="button" role="switch" aria-checked={form.has_serial} onClick={()=>setForm(f=>({...f,has_serial:!f.has_serial}))}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.has_serial ? "bg-violet-50 border-violet-300" : "bg-gray-50 border-gray-200"}`}>
                <div className={`w-10 h-6 shrink-0 rounded-full p-1 flex items-center transition-colors ${form.has_serial ? "bg-violet-500" : "bg-gray-300"}`}>
                  <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.has_serial ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <p className={`text-sm font-semibold ${form.has_serial ? "text-violet-800" : "text-gray-700"}`}>มี Serial Number</p>
              </button>
              {form.has_serial && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Serial Number</label><input value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} className={inp} placeholder="SN ของสินค้า" /></div>
              )}
              <div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cal ล่าสุด (วันที่สอบเทียบล่าสุด)</label>
                  <input
                    type="date"
                    value={form.last_calibration_date}
                    onChange={(e) => setForm((f) => ({ ...f, last_calibration_date: e.target.value }))}
                    className={inp}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">{thDateInputBeHint(form.last_calibration_date)}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              Item Master ใช้กำหนดเกณฑ์ประเภทสินค้าเท่านั้น (ไม่ต้องลง SN และไม่ต้องกำหนดวันสอบเทียบ)
            </div>
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

function serialsUniqueInsensitive(parts: string[]) {
  const seen = new Set<string>()
  for (const p of parts) {
    const t = p.trim().toLowerCase()
    if (!t) return false
    if (seen.has(t)) return false
    seen.add(t)
  }
  return true
}

// ── Receive / Input Product (รับเข้าคลัง) ─────────────────────────────────────
function ReceiveProductDialog({
  todayISO,
  existingItems,
  onClose,
  onApply,
}: {
  todayISO: string
  existingItems: StockItem[]
  onClose: () => void
  onApply: (tx: StockTransaction) => void
}) {
  const [supplierPo, setSupplierPo] = useState("")
  const [shelf, setShelf] = useState("")
  const [note, setNote] = useState("")
  const [qtyIn, setQtyIn] = useState(1)
  const [productCatalog, setProductCatalog] = useState<ProductCatalogGroup[]>(readProductCatalog())
  const [asDropdown, setAsDropdown] = useState<ASDropdownConfig>(() => readDropdownConfig())
  const [selectedManufacturer, setSelectedManufacturer] = useState("")
  const [selectedCatalogModel, setSelectedCatalogModel] = useState("")
  const [newCategory, setNewCategory] = useState<StockCategory>("sellable")
  const [newHasSerial, setNewHasSerial] = useState(true)
  const [newSerial, setNewSerial] = useState("")
  const [moduleSerials, setModuleSerials] = useState<string[]>([])
  const [receiveDate, setReceiveDate] = useState(todayISO)
  const [equipmentCalDate, setEquipmentCalDate] = useState("")
  const [sendCommissioning, setSendCommissioning] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [duplicateSnPopup, setDuplicateSnPopup] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      setProductCatalog(readProductCatalog())
      setAsDropdown(readDropdownConfig())
    }
    const onStorage = (e: StorageEvent) => {
      if (
        e.key !== AS_STORE_KEYS.productCatalog &&
        e.key !== AS_STORE_KEYS.dropdownConfig
      )
        return
      sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (
        key &&
        key !== AS_STORE_KEYS.productCatalog &&
        key !== AS_STORE_KEYS.dropdownConfig
      )
        return
      sync()
    }
    sync()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const moduleSpec = useMemo(() => getReceiveModuleSpec(selectedCatalogModel), [selectedCatalogModel])

  useEffect(() => {
    const spec = getReceiveModuleSpec(selectedCatalogModel)
    if (spec.componentLabels.length > 0) {
      setNewHasSerial(true)
    }
    setModuleSerials(Array.from({ length: spec.componentLabels.length }, () => ""))
  }, [selectedCatalogModel])

  const manufacturersSorted = useMemo(
    () => getStockPatternManufacturers(productCatalog, asDropdown),
    [productCatalog, asDropdown],
  )

  const catalogModelsForManufacturer = useMemo(() => {
    return getStockPatternModelsForManufacturer(selectedManufacturer, productCatalog, asDropdown)
  }, [productCatalog, asDropdown.stock_models, selectedManufacturer])

  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"

  function setModuleAt(index: number, value: string) {
    setModuleSerials((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function submitData() {
    setSubmitError(null)
    if (!supplierPo.trim()) {
      setSubmitError("กรุณากรอก PO / อ้างอิงรับเข้า")
      return
    }
    if (!selectedManufacturer || !selectedCatalogModel) {
      setSubmitError("กรุณาเลือก Manufacturer และ Product Model")
      return
    }

    const spec = getReceiveModuleSpec(selectedCatalogModel)
    const mainTrim = newSerial.trim()
    const needsMainSerial = newHasSerial || spec.componentLabels.length > 0
    if (needsMainSerial && !mainTrim) {
      setSubmitError(`กรุณากรอก ${spec.mainLabel}`)
      return
    }

    if (spec.componentLabels.length > 0) {
      const mods = moduleSerials.map((s) => s.trim())
      if (mods.length !== spec.componentLabels.length || mods.some((s) => !s)) {
        setSubmitError(`รุ่นนี้ต้องกรอก Serial ของ component ให้ครบ ${spec.componentLabels.length} ช่อง`)
        return
      }
      const allParts = [mainTrim, ...mods]
      if (!serialsUniqueInsensitive(allParts)) {
        setSubmitError("Serial ซ้ำกันในชุดเดียวกัน กรุณาตรวจสอบ Serial เครื่องหลัก/Component")
        return
      }
    }

    const incomingSerials = [mainTrim, ...moduleSerials.map((s) => s.trim())].filter(Boolean)
    const liveItems = tryReadJSON<StockItem[]>(AS_STORE_KEYS.stockItems)
    const mergedItems = Array.isArray(liveItems) ? liveItems : existingItems
    const liveJobs = readJobs([])
    const proactiveAssets = readProactiveCalibrationAssets([])
    const existingSerials = new Set(
      [
        ...mergedItems.flatMap((it) => [it.serial_number || "", ...(it.module_serials || []), it.companion_serial || ""]),
        ...liveJobs.map((j) => j.serial_number || ""),
        ...proactiveAssets.map((a) => a.serial_number || ""),
      ]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    )
    const duplicateSN = incomingSerials.find((s) => existingSerials.has(s.toLowerCase()))
    if (duplicateSN) {
      setSubmitError(`SN ซ้ำในระบบ: ${duplicateSN} (ระบบไม่อนุญาตรับเข้า SN เดียวกัน)`)
      setDuplicateSnPopup(duplicateSN)
      return
    }

    const receiveTrim = receiveDate.trim() || todayISO
    if (parseISODateToUTC(receiveTrim) > parseISODateToUTC(todayISO)) {
      setSubmitError("วันที่รับเข้าห้ามเป็นอนาคต")
      return
    }
    const calTrim = equipmentCalDate.trim()
    if (calTrim && parseISODateToUTC(calTrim) > parseISODateToUTC(receiveTrim)) {
      setSubmitError("Last Cal Date ต้องไม่หลังวันที่รับเข้า")
      return
    }
    const qtyNormalized = Math.floor(Number(qtyIn))
    if (!Number.isFinite(qtyNormalized) || qtyNormalized < 1) {
      setSubmitError("จำนวนรับเข้าต้องมากกว่าหรือเท่ากับ 1")
      return
    }
    const id = newId("stk")

    const tx: StockTransaction = {
      id: newId("tx-in"),
      item_id: id,
      item_name: selectedCatalogModel,
      type: "in",
      qty: Math.max(1, qtyNormalized),
      reference: supplierPo.trim(),
      note: sendCommissioning ? [note.trim(), "ส่ง Commissioning Test หลังรับเข้า"].filter(Boolean).join(" · ") : note.trim() || undefined,
      date: receiveTrim,
      approved_by: "Stock",
      shelf_location: shelf.trim() || undefined,
      manufacturer: selectedManufacturer,
      model: selectedCatalogModel,
      serial_number: needsMainSerial ? mainTrim : undefined,
      module_serials: spec.componentLabels.length > 0 ? moduleSerials.map((s) => s.trim()) : undefined,
      companion_serial: undefined,
      category: newCategory,
      set_status: sendCommissioning ? "pending_qc" : "in_stock",
      input_product_receive: true,
      equipment_calibration_date: calTrim || undefined,
    }
    onApply(tx)
    onClose()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    submitData()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-3xl">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
            Input Product — รับเข้าคลัง
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form noValidate onSubmit={submit} className="p-6 space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            ยี่ห้อ/รุ่น sync จาก Settings → <strong>Global · Product Catalog</strong> (หลัก) และ AS · Stock Manufacturers/Models
            (เสริมเมื่อ Catalog ยังไม่มีรุ่นสำหรับยี่ห้อนั้น) · รุ่นที่มี Module ต้องกรอก SN ครบ · กรอก PO รับเข้า ·
            ติ๊ก Commissioning ด้านล่าง (ไม่ต้องกรอกอะไรเพิ่ม) เพื่อส่งเข้าคิว Services · ทุก SN ที่กรอกจะลง{" "}
            <strong>Calibration Proactive</strong> อัตโนมัติ — due = Last Cal Date + 1 ปี (ถ้าไม่กรอก Last Cal จะใช้วันรับเข้าแทน)
          </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ยี่ห้อ (ผู้ผลิต) *</label>
                <select
                  required
                  value={selectedManufacturer}
                  onChange={(e) => {
                    setSelectedManufacturer(e.target.value)
                    setSelectedCatalogModel("")
                  }}
                  className={inp}
                >
                  <option value="">-- เลือกยี่ห้อ --</option>
                  {manufacturersSorted.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">รุ่น (Product Model) *</label>
                <select
                  required
                  value={selectedCatalogModel}
                  onChange={(e) => setSelectedCatalogModel(e.target.value)}
                  disabled={!selectedManufacturer}
                  className={inp}
                >
                  <option value="">{selectedManufacturer ? "-- เลือกรุ่น --" : "เลือกยี่ห้อก่อน"}</option>
                  {catalogModelsForManufacturer.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {moduleSpec.componentLabels.length > 0 && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-[11px] text-violet-900 leading-relaxed">
                  {/IDA6/i.test(selectedCatalogModel) && (
                    <p>
                      <strong>IDA6:</strong> กรอก SN Display + SN Module 1..4 ครบทุกช่อง (แยก claim ราย module ได้)
                    </p>
                  )}
                  {/X2\s*Solo/i.test(selectedCatalogModel) && (
                    <p className="mt-1">
                      <strong>X2 Solo:</strong> ต้องกรอก SN เครื่องหลัก + SN R/F Sensor
                    </p>
                  )}
                  {/X2/i.test(selectedCatalogModel) && !/X2\s*Solo/i.test(selectedCatalogModel) && (
                    <p className="mt-1">
                      <strong>X2:</strong> ต้องกรอก SN เครื่องหลัก + SN Sensor (R/F, CT, Light, MAM, Survey)
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">หมวด</label>
                <div className="flex flex-wrap gap-2">
                  {(["sellable", "demo", "module", "spare_part", "consumable", "tool"] as StockCategory[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCategory(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 ${
                        newCategory === c ? "border-blue-500 bg-blue-50" : "border-gray-200"
                      }`}
                    >
                      {CAT_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={newHasSerial}
                  disabled={moduleSpec.componentLabels.length > 0}
                  onChange={(e) => setNewHasSerial(e.target.checked)}
                  className="rounded"
                />
                มี Serial Number (เครื่องหลัก / Display)
                {moduleSpec.componentLabels.length > 0 && (
                  <span className="text-[11px] text-gray-500">(บังคับสำหรับรุ่นนี้)</span>
                )}
              </label>
              {newHasSerial && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {moduleSpec.mainLabel} *
                  </label>
                  <input
                    required={newHasSerial}
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    className={inp}
                  />
                </div>
              )}
              {moduleSpec.componentLabels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">Serial แต่ละ Component *</p>
                  {moduleSerials.map((val, idx) => (
                    <div key={idx}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{moduleSpec.componentLabels[idx] || `Component ${idx + 1}`}</label>
                      <input
                        required
                        value={val}
                        onChange={(e) => setModuleAt(idx, e.target.value)}
                        className={inp}
                      />
                    </div>
                  ))}
                </div>
              )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">วันที่รับเข้า (Receive Date)</label>
            <input
              type="date"
              required
              value={receiveDate}
              onChange={(e) => setReceiveDate(e.target.value)}
              max={todayISO}
              className={inp}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              ค่าเริ่มต้นเป็นวันนี้ แต่สามารถระบุย้อนหลังเป็นวันที่รับของจริงได้
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{thDateInputBeHint(receiveDate)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">วันที่สอบเทียบล่าสุดจริง (Last Cal Date)</label>
            <input
              type="date"
              value={equipmentCalDate}
              onChange={(e) => setEquipmentCalDate(e.target.value)}
              max={receiveDate || todayISO}
              className={inp}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              ถ้าไม่กรอก ระบบจะใช้วันที่รับเข้าเป็น Last Calibration และคำนวณ Next Due อัตโนมัติ (+1 year)
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{thDateInputBeHint(equipmentCalDate)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">PO / อ้างอิงรับเข้า *</label>
            <input required value={supplierPo} onChange={(e) => setSupplierPo(e.target.value)} className={inp} placeholder="PO ผู้จัดจำหน่าย หรือเลขที่เอกสารรับเข้า" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวนรับเข้า *</label>
              <input type="number" min={1} required value={qtyIn} onChange={(e) => setQtyIn(Number(e.target.value))} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชั้นวาง</label>
              <input value={shelf} onChange={(e) => setShelf(e.target.value)} className={inp} placeholder="เช่น A-01" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} />
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-2.5 py-2">
            <label className="flex items-start gap-1.5 text-[10px] leading-snug text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={sendCommissioning}
                onChange={(e) => setSendCommissioning(e.target.checked)}
                className="rounded mt-0.5 h-3 w-3 shrink-0"
              />
              <span>
                <span className="font-semibold">Commissioning Test</span>
                <span className="text-amber-800/90"> — ติ๊กเพื่อส่งเข้าคิว Services (Pending QC) หลังรับเข้า ไม่ต้องกรอกข้อมูลเพิ่ม</span>
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitData}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600"
            >
              บันทึกรับเข้า
            </button>
          </div>
          {submitError && <p className="text-xs font-semibold text-red-600">{submitError}</p>}
        </form>
      </div>
      {duplicateSnPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDuplicateSnPopup(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 border border-rose-200">
            <p className="text-center font-black text-rose-600 leading-tight text-[50px]">
              ไอ่ก้อง SN ซ้ำ
            </p>
            <p className="text-center text-sm text-gray-600 mt-3">
              Serial ที่ซ้ำ: <span className="font-mono font-bold">{duplicateSnPopup}</span>
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setDuplicateSnPopup(null)}
                className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sell stock (PO ลูกค้า + ฐานลูกค้า) ───────────────────────────────────────
function SellStockDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (p: {
    customer_org: string
    customer_contact: string
    customer_po: string
    warranty: string
    pm_per_year: number
    calibrations_per_year: number
  }) => void
}) {
  const [orgs, setOrgs] = useState<ASOrganization[]>([])
  const [orgPick, setOrgPick] = useState("")
  const [freeOrg, setFreeOrg] = useState("")
  const [contact, setContact] = useState("")
  const [customerPo, setCustomerPo] = useState("")
  const [warranty, setWarranty] = useState("")
  const [pmPerYear, setPmPerYear] = useState(2)
  const [calPerYear, setCalPerYear] = useState(1)
  const today = todayYmdInBangkok()
  const staleCalDays =
    item.last_calibration_date ? diffDays(item.last_calibration_date, today) : null
  const shouldWarnRecalibrationBeforeShip = staleCalDays != null && staleCalDays > 90
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm bg-white"

  useEffect(() => {
    setOrgs(readOrganizations([]))
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const org = orgPick === "__other__" ? freeOrg.trim() : orgPick.trim()
    if (!org || !customerPo.trim()) return
    onConfirm({
      customer_org: org,
      customer_contact: contact.trim(),
      customer_po: customerPo.trim(),
      warranty: warranty.trim(),
      pm_per_year: Math.max(0, Math.floor(pmPerYear || 0)),
      calibrations_per_year: Math.max(0, Math.floor(calPerYear || 0)),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-slate-700" />
            ตัดขาย (Sold)
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
          {item.serial_number && <p className="text-xs font-mono text-slate-600 mt-0.5">SN: {item.serial_number}</p>}
        </div>
        <p className="text-xs text-gray-600 mb-3">บังคับ PO ลูกค้า · เลือกหน่วยงานจากฐานหรือพิมพ์ใหม่ (ลงทะเบียนอัตโนมัติ)</p>
        {shouldWarnRecalibrationBeforeShip && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Last calibration เกิน 3 เดือน ({staleCalDays} วัน) — แนะนำให้สอบเทียบก่อนส่งสินค้า (สามารถข้ามได้)
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยงานลูกค้า *</label>
            <select required={orgPick !== "__other__"} value={orgPick} onChange={(e) => setOrgPick(e.target.value)} className={inp}>
              <option value="">-- เลือก --</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
              <option value="__other__">+ ไม่อยู่ในรายชื่อ</option>
            </select>
          </div>
          {orgPick === "__other__" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหน่วยงาน *</label>
              <input required value={freeOrg} onChange={(e) => setFreeOrg(e.target.value)} className={inp} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ (ถ้ามี)</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inp} placeholder="ชื่อผู้ติดต่อหลัก" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO ลูกค้า *</label>
            <input required value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} className={inp} placeholder="เลข PO ลูกค้า" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty *</label>
            <input required value={warranty} onChange={(e) => setWarranty(e.target.value)} className={inp} placeholder="เช่น 12 เดือน / 365 วัน" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PM (ครั้ง/ปี) *</label>
              <input required type="number" min={0} value={pmPerYear} onChange={(e) => setPmPerYear(Number(e.target.value))} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สอบเทียบ (ครั้ง/ปี) *</label>
              <input required type="number" min={0} value={calPerYear} onChange={(e) => setCalPerYear(Number(e.target.value))} className={inp} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            หมายเหตุ: PM/ปี เป็นรอบงาน PM เท่านั้น และไม่บังคับจำนวนรอบ Calibration อัตโนมัติ
            (ระบบสร้างแผน Cal จากค่า "สอบเทียบ (ครั้ง/ปี)" เท่านั้น)
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">
              ยืนยันตัดขาย
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CalibrationUpdateDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: StockItem
  onClose: () => void
  onConfirm: (lastCalibrationDate: string) => void
}) {
  const [lastCalDate, setLastCalDate] = useState(item.last_calibration_date || "")
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Update Calibration</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          บันทึก Last Calibration Date แล้วระบบจะคำนวณ Next Due อัตโนมัติ (+1 year)
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Calibration Date *</label>
        <input type="date" required value={lastCalDate} onChange={(e) => setLastCalDate(e.target.value)} className={inp} />
        <p className="text-[10px] text-gray-500 mt-1 leading-snug">{thDateInputBeHint(lastCalDate)}</p>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => lastCalDate.trim() && onConfirm(lastCalDate.trim())}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StockPage() {
  const itemsVersionRef = useRef(0)
  const jobsVersionRef = useRef(0)
  const stockHydratedRef = useRef(false)
  const stockFirstWriteSkippedRef = useRef(false)
  const transactionsHydratedRef = useRef(false)
  const transactionsFirstWriteSkippedRef = useRef(false)
  const bookingsHydratedRef = useRef(false)
  const bookingsFirstWriteSkippedRef = useRef(false)

  const [items, setItems] = useState<StockItem[]>(USE_STOCK_DEV_SEED ? MOCK_ITEMS : [])
  const [transactions, setTransactions] = useState<StockTransaction[]>(
    USE_STOCK_DEV_SEED ? MOCK_TRANSACTIONS : [],
  )
  const [bookings, setBookings] = useState<Booking[]>(USE_STOCK_DEV_SEED ? MOCK_BOOKINGS : [])
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState<StockCategory|"all">("all")
  const [filterBrand, setFilterBrand] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<ItemStatus|"all">("all")
  const [stockTableSort, setStockTableSort] = useState<StockTableSort>("default")
  const [dispatchDialog, setDispatchDialog] = useState<StockItem|null>(null)
  const [addDialog, setAddDialog] = useState<{open:boolean; data:Partial<StockItem>|null}>({open:false,data:null})
  const [bookingDialog, setBookingDialog] = useState(false)
  const [bookingPrefillItemId, setBookingPrefillItemId] = useState<string | null>(null)
  const [receiveProductDialog, setReceiveProductDialog] = useState(false)
  const [sellStockItem, setSellStockItem] = useState<StockItem | null>(null)
  const [calibrationUpdateItem, setCalibrationUpdateItem] = useState<StockItem | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [showAllNotifications, setShowAllNotifications] = useState(false)
  const [notificationPopoverOpen, setNotificationPopoverOpen] = useState(false)
  const [dispatchSuccess, setDispatchSuccess] = useState<string|null>(null)
  const [serviceRequestsFromStock, setServiceRequestsFromStock] = useState<ASServiceJob[]>([])
  const [pendingInServiceInbox, setPendingInServiceInbox] = useState(0)
  const [pendingStockReturns, setPendingStockReturns] = useState<ASServiceJob[]>([])
  const [dispatchAcceptedHistory, setDispatchAcceptedHistory] = useState<ASStockDispatchHistoryEntry[]>([])
  const [completedStockReturns, setCompletedStockReturns] = useState<ASServiceJob[]>([])
  const [outboundTraceLog, setOutboundTraceLog] = useState<ASStockOutboundTraceLogEntry[]>([])
  const [partsRequests, setPartsRequests] = useState<ASPartsRequest[]>([])
  const [stockNotifications, setStockNotifications] = useState<ASStockNotification[]>([])
  const [serviceHistorySearch, setServiceHistorySearch] = useState("")
  const [serviceHistoryJobType, setServiceHistoryJobType] = useState<ServiceJobTypeFilter>("all")
  /** ยืนยัน ยกเลิก / งานเสร็จ จากวิดเจ็ตสถานะ Service */
  const [traceActionDialog, setTraceActionDialog] = useState<null | { mode: "cancel" | "complete"; job: ASServiceJob }>(
    null,
  )
  const [traceCancelReason, setTraceCancelReason] = useState("")
  const [traceCancelActionPlan, setTraceCancelActionPlan] = useState("")
  const [traceCompleteNote, setTraceCompleteNote] = useState("")
  const [traceCompleteConfirmChecked, setTraceCompleteConfirmChecked] = useState(false)
  const [loanReturnHistory, setLoanReturnHistory] = useState<ASLoanReturnHistory[]>([])
  const [returnDemoDialog, setReturnDemoDialog] = useState<StockItem | null>(null)
  const [loanDialog, setLoanDialog] = useState<StockItem | null>(null)
  const [loanRequestItem, setLoanRequestItem] = useState<StockItem | null>(null)
  const [customerHistoryModal, setCustomerHistoryModal] = useState<string | null>(null)
  const [moduleAssignments, setModuleAssignments] = useState<ASModuleAssignment[]>([])
  const [moduleHistorySearch, setModuleHistorySearch] = useState("")
  const [moduleHistoryDialogSn, setModuleHistoryDialogSn] = useState<string | null>(null)
  const [loanHistorySearch, setLoanHistorySearch] = useState("")
  const [loanHistoryCustomer, setLoanHistoryCustomer] = useState("all")
  const [claimCases, setClaimCases] = useState<ASCommissioningClaimCase[]>([])
  const [claimReceiveTarget, setClaimReceiveTarget] = useState<string>("")
  const [claimReplacementSerial, setClaimReplacementSerial] = useState("")
  const [claimReplacementNote, setClaimReplacementNote] = useState("")
  const [claimFilterScope, setClaimFilterScope] = useState<"all" | "whole_unit" | "module" | "sensor">("all")
  const [claimSearchQuery, setClaimSearchQuery] = useState("")
  const [seOrderRequests, setSeOrderRequests] = useState<SEOrderRequest[]>(() => readSEOrderRequests([]))
  const useDb = process.env.NEXT_PUBLIC_AS_DB_MODE === "db"
  const DB_KEYS = {
    stockItems: "as:stock_items",
    stockTransactions: "as:stock_transactions",
    stockBookings: "as:stock_bookings",
  } as const

  async function readDbBlob<T>(key: string): Promise<T | null> {
    try {
      const res = await fetch(`/api/as/state?key=${encodeURIComponent(key)}`)
      if (!res.ok) return null
      const data = (await res.json()) as { payload?: T | null }
      return (data.payload ?? null) as T | null
    } catch {
      return null
    }
  }

  async function writeDbBlob(key: string, payload: unknown) {
    try {
      await fetch("/api/as/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, payload }),
      })
    } catch {
      // best-effort mirror during pilot
    }
  }

  const lowStock = items.filter(i => i.qty < i.min_qty && i.status === "in_stock")
  const demoOnLoan = items.filter(i => i.category === "demo" && i.status === "on_loan")
  const stockOnLoan = items.filter((i) => i.status === "on_loan")
  const reservedItems = items.filter((i) => i.status === "reserved")
  const seBookingRequests = bookings.filter((b) => b.source === "se_deal")
  const activeClaimCases = claimCases.filter((c) => c.status !== "closed")
  const filteredActiveClaimCases = useMemo(() => {
    const q = claimSearchQuery.trim().toLowerCase()
    return activeClaimCases.filter((c) => {
      const scope = c.claim_scope ?? "whole_unit"
      if (claimFilterScope !== "all" && scope !== claimFilterScope) return false
      if (!q) return true
      const hay = [
        c.id,
        c.old_serial_number,
        c.parent_serial_number,
        c.replacement_serial_number,
        c.claim_reference,
        c.source_job_no,
        c.model,
        c.customer_org,
        c.claimed_component_label,
        c.failure_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activeClaimCases, claimFilterScope, claimSearchQuery])
  const soldItems = items.filter((i) => i.status === "sold")
  const today = todayYmdInBangkok()

  const uniqueBrands = Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b))

  function getStockAgingDays(item: StockItem) {
    if (!item.stocked_at) return 0
    return Math.max(0, diffDays(item.stocked_at, today))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const base = items.filter(
      (i) =>
        (i.name.toLowerCase().includes(q) ||
          (i.serial_number || "").toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q)) &&
        (filterCat === "all" || i.category === filterCat) &&
        (filterBrand === "all" || i.brand === filterBrand) &&
        (filterStatus === "all" || i.status === filterStatus),
    )
    const arr = [...base]
    switch (stockTableSort) {
      case "days_high":
        return arr.sort((a, b) => getStockAgingDays(b) - getStockAgingDays(a))
      case "days_low":
        return arr.sort((a, b) => getStockAgingDays(a) - getStockAgingDays(b))
      case "name_az":
        return arr.sort((a, b) => a.name.localeCompare(b.name, "th"))
      case "qty_high":
        return arr.sort((a, b) => b.qty - a.qty)
      default:
        return arr
    }
  }, [items, search, filterCat, filterBrand, filterStatus, stockTableSort, today])

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
    const bootstrap = async () => {
      // Hydrate from localStorage first to avoid SSR/client mismatch.
      const savedItems = tryReadJSON<StockItem[]>(AS_STORE_KEYS.stockItems)
      const savedTx = tryReadJSON<StockTransaction[]>(AS_STORE_KEYS.stockTransactions)
      const savedBookings = tryReadJSON<Booking[]>(AS_STORE_KEYS.stockBookings)
      let nextItems = savedItems && Array.isArray(savedItems) ? savedItems : items
      let nextTx = savedTx && Array.isArray(savedTx) ? savedTx : transactions
      let nextBookings = savedBookings && Array.isArray(savedBookings) ? savedBookings : bookings

      if (useDb) {
        const [dbItems, dbTx, dbBookings] = await Promise.all([
          readDbBlob<StockItem[]>(DB_KEYS.stockItems),
          readDbBlob<StockTransaction[]>(DB_KEYS.stockTransactions),
          readDbBlob<Booking[]>(DB_KEYS.stockBookings),
        ])
        if (Array.isArray(dbItems) && dbItems.length > 0) {
          nextItems = dbItems
        } else {
          void writeDbBlob(DB_KEYS.stockItems, nextItems)
        }
        if (Array.isArray(dbTx) && dbTx.length > 0) {
          nextTx = dbTx
        } else {
          void writeDbBlob(DB_KEYS.stockTransactions, nextTx)
        }
        if (Array.isArray(dbBookings) && dbBookings.length > 0) {
          nextBookings = dbBookings
        } else {
          void writeDbBlob(DB_KEYS.stockBookings, nextBookings)
        }
      }

      setItems(nextItems)
      setTransactions(nextTx)
      setBookings(nextBookings)
      transactionsHydratedRef.current = true
      bookingsHydratedRef.current = true
      stockHydratedRef.current = true
    }
    void bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDb])

  useEffect(() => {
    itemsVersionRef.current = readStockItemsVersion()
    jobsVersionRef.current = readJobsVersion()
  }, [])

  useEffect(() => {
    const syncJobsAndDispatches = () => {
      setSeOrderRequests(readSEOrderRequests([]))
      const jobs = readJobs([])
      const dispatches = readStockDispatches([])
      const parts = readPartsRequests([])
      const notifications = readStockNotifications([])
      setServiceRequestsFromStock(
        jobs.filter(
          (j) =>
            j.source === "stock" &&
            !j.stock_outbound_trace_archived &&
            !(j.status === "ปิดงาน" && j.stock_return_pending),
        ),
      )
      setPendingStockReturns(
        jobs.filter(
          (j) =>
            j.status === "ปิดงาน" &&
            j.stock_return_pending,
        ),
      )
      setDispatchAcceptedHistory(readStockDispatchHistory([]))
      setOutboundTraceLog(readStockOutboundTraceLog([]))
      setCompletedStockReturns(jobs.filter((j) => j.stock_return_received_at))
      setPendingInServiceInbox(dispatches.length)
      setLoanReturnHistory(readLoanReturnHistory([]))
      setModuleAssignments(readModuleAssignments([]))
      setPartsRequests(parts)
      setStockNotifications(notifications)
      setClaimCases(readCommissioningClaimCases([]))
      jobsVersionRef.current = readJobsVersion()
    }

    const hydrateStockFromOtherTab = (ev: StorageEvent) => {
      if (
        ev.key !== AS_STORE_KEYS.stockItems &&
        ev.key !== AS_STORE_KEYS.stockTransactions &&
        ev.key !== AS_STORE_KEYS.stockBookings
      ) {
        return
      }
      const li = tryReadJSON<StockItem[]>(AS_STORE_KEYS.stockItems)
      if (li !== null && Array.isArray(li)) {
        setItems(li as StockItem[])
        itemsVersionRef.current = readStockItemsVersion()
      }
      const lt = tryReadJSON<StockTransaction[]>(AS_STORE_KEYS.stockTransactions)
      if (lt !== null && Array.isArray(lt)) setTransactions(lt)
      const lb = tryReadJSON<Booking[]>(AS_STORE_KEYS.stockBookings)
      if (lb !== null && Array.isArray(lb)) setBookings(lb)
    }

    const onStorage = (ev: StorageEvent) => {
      syncJobsAndDispatches()
      hydrateStockFromOtherTab(ev)
      if (ev.key === AS_STORE_KEYS.jobs) {
        jobsVersionRef.current = readJobsVersion()
      }
    }

    const onAsStoreUpdated = () => {
      syncJobsAndDispatches()
    }

    syncJobsAndDispatches()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onAsStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onAsStoreUpdated)
    }
  }, [])

  useEffect(() => {
    if (!stockHydratedRef.current) return
    // Skip first write after mount; effect closure can still hold pre-hydration seed state.
    if (!stockFirstWriteSkippedRef.current) {
      stockFirstWriteSkippedRef.current = true
      return
    }
    const { ok, nextVersion } = writeStockItemsWithVersion(items, itemsVersionRef.current)
    if (!ok) {
      // Sync version and retry once with latest version to avoid
      // overwriting local state by stale remote payload.
      itemsVersionRef.current = nextVersion
      const retry = writeStockItemsWithVersion(items, itemsVersionRef.current)
      if (retry.ok) {
        itemsVersionRef.current = retry.nextVersion
        return
      }
      setDispatchSuccess("บันทึกคลังชนกับการแก้ไขจากที่อื่น (version conflict) — ข้อมูลหน้าเดิมยังอยู่ ลองกดบันทึกอีกครั้ง")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    itemsVersionRef.current = nextVersion
    if (useDb) void writeDbBlob(DB_KEYS.stockItems, items)
  }, [items, useDb])

  useEffect(() => {
    if (!transactionsHydratedRef.current) return
    if (!transactionsFirstWriteSkippedRef.current) {
      transactionsFirstWriteSkippedRef.current = true
      return
    }
    writeStockTransactionsLedger(transactions)
    if (useDb) void writeDbBlob(DB_KEYS.stockTransactions, transactions)
  }, [transactions, useDb])

  useEffect(() => {
    if (!bookingsHydratedRef.current) return
    if (!bookingsFirstWriteSkippedRef.current) {
      bookingsFirstWriteSkippedRef.current = true
      return
    }
    writeStockBookingsLedger(bookings)
    if (useDb) void writeDbBlob(DB_KEYS.stockBookings, bookings)
  }, [bookings, useDb])

  useEffect(() => {
    if (!actionMenuId) return
    const closeMenu = () => setActionMenuId(null)
    window.addEventListener("click", closeMenu)
    return () => window.removeEventListener("click", closeMenu)
  }, [actionMenuId])

  const actionablePartsRequests = useMemo(
    () => partsRequests.filter((r) => r.status === "pending" || r.status === "approved"),
    [partsRequests],
  )
  const unreadStockNotifications = useMemo(
    () => stockNotifications.filter((n) => !n.read_at),
    [stockNotifications],
  )
  const visibleUnreadNotifications = useMemo(
    () => (showAllNotifications ? unreadStockNotifications : unreadStockNotifications.slice(0, 5)),
    [showAllNotifications, unreadStockNotifications],
  )

  function approvePartsRequest(req: ASPartsRequest) {
    const ok = updatePartsRequestStatus(req.id, "approved")
    if (!ok) return
    setPartsRequests(readPartsRequests([]))
  }

  function fulfillPartsRequest(req: ASPartsRequest) {
  const latest = readPartsRequests([]).find((r) => r.id === req.id)
  if (!latest || latest.status !== "approved") return
    const ok = updatePartsRequestStatus(req.id, "fulfilled")
    if (!ok) return
    setPartsRequests(readPartsRequests([]))
  }

  function markNotificationAsRead(id: string) {
    const ok = markStockNotificationRead(id)
    if (!ok) return
    setStockNotifications(readStockNotifications([]))
  }

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
    const id = newId("lr")
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
          ? {
              ...i,
              status: "in_stock",
              loaned_to: undefined,
              loan_due: undefined,
              loan_date: undefined,
              loan_approval_status: undefined,
              loan_approval_note: undefined,
              loan_approved_at: undefined,
              loan_approved_by: undefined,
            }
          : i,
      ),
    )
    setDispatchSuccess(`บันทึกคืนเครื่องของ ${item.loaned_to} เรียบร้อยแล้ว`)
    setTimeout(() => setDispatchSuccess(null), 3500)
  }

  function doStockOut(item: StockItem, qty: number, ref: string, note: string) {
    const take = Math.max(0, Math.floor(Number(qty)))
    if (take <= 0) return
    setItems((p) => {
      const cur = p.find((i) => i.id === item.id)
      if (!cur || cur.qty < take) {
        queueMicrotask(() => {
          setDispatchSuccess("จ่ายออกไม่สำเร็จ: จำนวนในคลังไม่พอ")
          setTimeout(() => setDispatchSuccess(null), 4000)
        })
        return p
      }
      const tx: StockTransaction = {
        id: newId("tx-out"),
        item_id: item.id,
        item_name: item.name,
        type: "out",
        qty: take,
        reference: ref,
        note,
        date: today,
        approved_by: "Stock",
      }
      queueMicrotask(() => setTransactions((pt) => [tx, ...pt]))
      return p.map((i) => (i.id === item.id ? { ...i, qty: i.qty - take } : i))
    })
  }

  function confirmSellStock(
    item: StockItem,
    payload: {
      customer_org: string
      customer_contact: string
      customer_po: string
      warranty: string
      pm_per_year: number
      calibrations_per_year: number
    },
  ) {
    if (item.status === "on_loan" || item.status === "pending_qc") {
      setDispatchSuccess("ตัดขายไม่ได้: เครื่องอยู่กับลูกค้า/Service (On Loan หรือ Pending QC)")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    if (!STATUSES_ALLOWED_SELL.includes(item.status)) {
      setDispatchSuccess("ตัดขายไม่ได้: เฉพาะ In Stock / Booking — ปลดการยืมหรือรอรับเข้าคลังก่อน")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    if (item.has_serial && !item.serial_number?.trim()) {
      setDispatchSuccess("ตัดขายไม่สำเร็จ: ต้องมี SN ก่อน")
      setTimeout(() => setDispatchSuccess(null), 4000)
      return
    }
    const org = payload.customer_org.trim()
    const po = payload.customer_po.trim()
    const contact = payload.customer_contact.trim()
    const warranty = payload.warranty.trim()
    const pmPerYear = Math.max(0, Math.floor(payload.pm_per_year || 0))
    const calPerYear = Math.max(0, Math.floor(payload.calibrations_per_year || 0))
    const nextOrgs = upsertOrganizationByName(readOrganizations([]), org, contact || undefined)
    writeOrganizations(nextOrgs)

    const nowIso = new Date().toISOString()
    if (item.serial_number) {
      const linkedModules = [
        ...(item.module_serials || []),
        ...(item.companion_serial ? [item.companion_serial] : []),
      ].filter(Boolean)
      linkedModules.forEach((moduleSn) => {
        const rec: ASModuleAssignment = {
          id: newId("ma-sold"),
          module_serial: moduleSn,
          from_parent_serial: item.serial_number,
          to_parent_serial: undefined,
          event: "sold",
          note: `Parent item sold (${item.name}) · PO ลูกค้า ${po}`,
          created_at: nowIso,
        }
        appendModuleAssignment(rec)
        setModuleAssignments((prev) => [rec, ...prev])
      })
    }

    const tx: StockTransaction = {
      id: newId("tx-sold"),
      item_id: item.id,
      item_name: item.name,
      type: "out",
      qty: item.qty,
      reference: "STATUS_SOLD",
      note: `ขายแล้ว · PO ลูกค้า: ${po}`,
      date: today,
      approved_by: "Stock",
      serial_number: item.serial_number,
      manufacturer: item.brand,
      model: item.model || item.name,
      customer_org: org,
      customer_contact: contact || undefined,
      customer_po: po,
    }
    setTransactions((p) => [tx, ...p])

    setItems((prev) =>
      prev.map((i) =>
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
              loan_approval_status: undefined,
              loan_approval_note: undefined,
              loan_approved_at: undefined,
              loan_approved_by: undefined,
              sold_to_org: org,
              sold_contact: contact || undefined,
              sold_customer_po: po,
              sold_warranty: warranty,
              sold_pm_per_year: pmPerYear,
              sold_calibrations_per_year: calPerYear,
              sold_calibration_plan_start: calPerYear > 0 ? today : undefined,
              sold_calibration_plan_end: calPerYear > 0 ? addYearsToISODate(today, 1) : undefined,
              sold_at: today,
            }
          : i,
      ),
    )
    if (item.serial_number && calPerYear > 0) {
      const baseDate = today
      const planEnd = addYearsToISODate(baseDate, 1)
      const existingAssets = readProactiveCalibrationAssets([])
      const remaining = existingAssets.filter(
        (a) => a.serial_number.trim().toLowerCase() !== item.serial_number?.trim().toLowerCase(),
      )
      const generated: ASProactiveCalibrationAsset[] = Array.from({ length: calPerYear }).map((_, idx) => {
        const dueDate = addMonthsToISODate(baseDate, Math.round(((idx + 1) * 12) / calPerYear))
        const previousDue = idx === 0 ? baseDate : addMonthsToISODate(baseDate, Math.round((idx * 12) / calPerYear))
        return {
          id: newId("pc-sold"),
          customer_org: org,
          customer_name: contact || undefined,
          manufacturer: item.brand,
          model: item.model || item.name,
          serial_number: item.serial_number || "—",
          last_calibration_date: previousDue,
          due_date: dueDate,
          note: `Auto plan from Sold (${idx + 1}/${calPerYear}) · PO ${po} · Plan ${baseDate} to ${planEnd}`,
          created_at: new Date().toISOString(),
        }
      })
      writeProactiveCalibrationAssets([...generated, ...remaining])
    }
    setDispatchSuccess(
      `ตัดขายแล้ว — ลูกค้า ${org} · PO ${po} · PM ${pmPerYear}/ปี · Cal ${calPerYear}/ปี (แผน Cal อิงค่า Cal เท่านั้น)`,
    )
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  function saveItem(data: Partial<StockItem>) {
    const qty = Math.max(0, Math.floor(Number(data.qty ?? 0)))
    const min_qty = Math.max(0, Math.floor(Number(data.min_qty ?? 0)))
    let normalized: Partial<StockItem> = { ...data, qty, min_qty }
    if (normalized.has_serial && normalized.qty !== 1) {
      normalized = { ...normalized, qty: 1 }
    }
    if (normalized.id) {
      setItems((p) =>
        p.map((i) => (i.id === normalized.id ? ({ ...i, ...normalized } as StockItem) : i)),
      )
    } else {
      setItems((p) => [...p, { id: newId("item"), status: "in_stock", ...normalized } as StockItem])
    }
  }

  function addTransaction(tx: StockTransaction) {
    setItems((p) => {
      const r = tryApplyStockTx(p, tx)
      if (!r.ok) {
        queueMicrotask(() => {
          setDispatchSuccess(r.error || "ธุรกรรมไม่สำเร็จ")
          setTimeout(() => setDispatchSuccess(null), 4500)
        })
        return p
      }
      queueMicrotask(() => {
        setTransactions((pt) => [tx, ...pt])
        if (tx.type === "in" && tx.customer_org && tx.loan_date && tx.loan_due) {
          const overdueDays = Math.max(0, diffDays(tx.loan_due, tx.date))
          const record: ASLoanReturnHistory = {
            id: newId("lr"),
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
        if (tx.set_status === "pending_qc") {
          appendStockDispatch({
            id: newId("sd-qc"),
            item_name: tx.model || tx.item_name,
            manufacturer: tx.manufacturer,
            model: tx.model || tx.item_name,
            serial_number: tx.serial_number || "—",
            customer_org: tx.customer_org?.trim() || "Stock — รับเข้า / Commissioning",
            customer_contact: tx.customer_contact?.trim() || "—",
            symptom: `Commissioning Test — ตรวจเช็คก่อนเข้า Stock (PO ${tx.reference})`,
            receive_channel: "พนักงาน",
            tracking_in: tx.reference || undefined,
            received_by: "Stock",
            job_type: "commissioning",
            routing: "overseas",
            dispatched_by: "Stock",
            dispatched_at: today,
            due_date: tx.due_date,
            stock_item_id: tx.item_id,
          })
          setDispatchSuccess(`ส่ง Commissioning / Pending QC เรียบร้อยแล้ว (${tx.reference})`)
          setTimeout(() => setDispatchSuccess(null), 4000)
        }
        upsertProactiveCalibrationFromInputProduct(tx)
      })
      return r.next
    })
  }

  function handleDispatch(form: DispatchForm) {
    appendStockDispatch({
      id: newId("sd"),
      item_name: form.item.name,
      manufacturer: form.item.brand,
      model: form.item.model || form.item.name,
      serial_number: form.item.serial_number || "—",
      customer_org: form.customer_org,
      customer_contact: form.customer_name,
      symptom: form.symptom,
      receive_channel: form.receive_channel,
      tracking_in: form.receive_channel === "ขนส่งเอกชน" ? form.tracking_in : undefined,
      received_by: form.receive_channel === "พนักงาน" ? form.received_by : undefined,
      job_type: form.job_type,
      dispatched_by: "Stock",
      dispatched_at: today,
      stock_item_id: form.item.id,
    })
    const jt =
      form.job_type === "repair"
        ? "Repair"
        : form.job_type === "calibration"
          ? "Calibration"
          : "Commissioning Test"
    setDispatchSuccess(`สร้างงาน ${jt} สำหรับ ${form.customer_org} เรียบร้อยแล้ว`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  /** Service ปิดงานแล้ว — Stock ยืนยันรับเข้าคลังเพื่อสถานะพร้อมจำหน่าย */
  function acceptStockReturn(job: ASServiceJob) {
    const receivedAt = new Date().toISOString()
    const currentItemsForTrace = tryReadJSON<StockItem[]>(AS_STORE_KEYS.stockItems) ?? []
    const preMatchedItem = currentItemsForTrace.find((it) => {
      const byId = Boolean(job.stock_item_id && it.id === job.stock_item_id)
      const bySn =
        Boolean(
          job.serial_number &&
          job.serial_number !== "—" &&
          it.serial_number?.trim().toLowerCase() === job.serial_number.trim().toLowerCase(),
        )
      const byPendingQcHeuristic =
        Boolean(
          !job.stock_item_id &&
          it.status === "pending_qc" &&
          (
            (job.serial_number && job.serial_number !== "—" && it.serial_number?.trim().toLowerCase() === job.serial_number.trim().toLowerCase()) ||
            (
              (!job.serial_number || job.serial_number === "—") &&
              (it.model || "").trim().toLowerCase() === (job.model || "").trim().toLowerCase() &&
              (it.brand || "").trim().toLowerCase() === (job.manufacturer || "").trim().toLowerCase()
            )
          ),
        )
      return byId || bySn || byPendingQcHeuristic
    })
    const preMatchStrategy = preMatchedItem
      ? job.stock_item_id && preMatchedItem.id === job.stock_item_id
        ? "by_stock_item_id"
        : job.serial_number && job.serial_number !== "—" && preMatchedItem.serial_number?.trim().toLowerCase() === job.serial_number.trim().toLowerCase()
          ? "by_serial_number"
          : "by_pending_qc_heuristic"
      : "fallback_create_new_item"
    const expectedVer = jobsVersionRef.current
    const allJobs = readJobs([])
    const nextJobs = allJobs.map((j) =>
      j.id === job.id
        ? {
            ...j,
            stock_return_pending: false,
            stock_return_received_at: receivedAt,
            status_logs: [
              ...(j.status_logs || []),
              {
                at: receivedAt,
                from: j.status,
                to: j.status,
                reason: `Stock ยืนยันรับเข้าคลัง — พร้อมจำหน่าย (${preMatchStrategy})`,
              },
            ],
          }
        : j,
    )
    const { ok, nextVersion } = writeJobsWithConcurrencyCheck(nextJobs, expectedVer)
    if (!ok) {
      jobsVersionRef.current = readJobsVersion()
      window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key: AS_STORE_KEYS.jobs } }))
      setDispatchSuccess("บันทึกไม่สำเร็จ: ข้อมูลงานถูกแก้ในแท็บอื่น — รีเฟรชแล้วลองอีกครั้ง")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    jobsVersionRef.current = nextVersion
    // Update stock atomically; if no linked item exists, recreate minimal in-stock item
    // to avoid "ปิดงานแล้วหาไม่เจอใน Stock" for older/missing linkage jobs.
    for (let i = 0; i < 3; i += 1) {
      const currentItems = tryReadJSON<StockItem[]>(AS_STORE_KEYS.stockItems) ?? []
      const expectedItemsVer = readStockItemsVersion()
      let matched = false
      const nextItems = currentItems.map((it) => {
        const byId = job.stock_item_id && it.id === job.stock_item_id
        const bySn =
          job.serial_number &&
          job.serial_number !== "—" &&
          it.serial_number?.trim().toLowerCase() === job.serial_number.trim().toLowerCase()
        const byPendingQcHeuristic =
          !job.stock_item_id &&
          it.status === "pending_qc" &&
          (
            (job.serial_number && job.serial_number !== "—" && it.serial_number?.trim().toLowerCase() === job.serial_number.trim().toLowerCase()) ||
            (
              (!job.serial_number || job.serial_number === "—") &&
              (it.model || "").trim().toLowerCase() === (job.model || "").trim().toLowerCase() &&
              (it.brand || "").trim().toLowerCase() === (job.manufacturer || "").trim().toLowerCase()
            )
          )
        if (byId || bySn || byPendingQcHeuristic) {
          matched = true
          const calReturnedDate = job.job_type === "calibration" ? today : undefined
          return {
            ...it,
            status: "in_stock" as const,
            qc_customer_org: undefined,
            qc_customer_contact: undefined,
            stocked_at: it.stocked_at || today,
            qty: Math.max(1, it.qty || 0),
            last_calibration_date: calReturnedDate || it.last_calibration_date,
            calibration_due_date: calReturnedDate ? addYearsToISODate(calReturnedDate, 1) : it.calibration_due_date,
          }
        }
        return it
      })
      const withFallback = matched
        ? nextItems
        : [
            {
              id: job.stock_item_id || newId("stk-ret"),
              name: job.model || job.serial_number || "Returned equipment",
              brand: job.manufacturer || "—",
              model: job.model || undefined,
              category: "sellable" as const,
              has_serial: Boolean(job.serial_number && job.serial_number !== "—"),
              serial_number: job.serial_number && job.serial_number !== "—" ? job.serial_number : undefined,
              qty: 1,
              min_qty: 0,
              unit: "เครื่อง",
              status: "in_stock" as const,
              stocked_at: today,
              last_calibration_date: job.calibration_date || undefined,
              calibration_due_date: job.due_date || undefined,
            },
            ...nextItems,
          ]
      const wrItems = writeStockItemsWithVersion(withFallback, expectedItemsVer)
      if (!wrItems.ok) continue
      itemsVersionRef.current = wrItems.nextVersion
      setItems(withFallback)
      break
    }
    setPendingStockReturns((p) => p.filter((j) => j.id !== job.id))
    setServiceRequestsFromStock((p) =>
      p
        .map((j) =>
          j.id === job.id
            ? { ...j, stock_return_pending: false, stock_return_received_at: receivedAt }
            : j,
        )
        .filter((j) => j.status !== "ปิดงาน" || j.stock_return_pending),
    )
    const updatedJob = nextJobs.find((j) => j.id === job.id)
    if (updatedJob?.stock_return_received_at) {
      setCompletedStockReturns((p) => [updatedJob, ...p.filter((x) => x.id !== job.id)])
    }
    setDispatchSuccess(`รับเข้าคลังจากงาน ${job.job_no} เรียบร้อย — พร้อมจำหน่าย [${preMatchStrategy}]`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  function openOutboundTraceCancel(job: ASServiceJob) {
    setTraceCancelReason("")
    setTraceCancelActionPlan("")
    setTraceActionDialog({ mode: "cancel", job })
  }

  function openOutboundTraceComplete(job: ASServiceJob) {
    setTraceCompleteNote("")
    setTraceCompleteConfirmChecked(false)
    setTraceActionDialog({ mode: "complete", job })
  }

  function confirmOutboundTraceCancel() {
    if (!traceActionDialog || traceActionDialog.mode !== "cancel") return
    const job = traceActionDialog.job
    if (!traceCancelReason.trim() || !traceCancelActionPlan.trim()) return
    const now = new Date().toISOString()
    const expectedVer = jobsVersionRef.current
    const all = readJobs([])
    const next = all.map((j) =>
      j.id !== job.id
        ? j
        : {
            ...j,
            status: "ยกเลิก",
            cancellation_reason: traceCancelReason.trim(),
            cancellation_action_plan: traceCancelActionPlan.trim(),
            stock_outbound_trace_archived: true,
            stock_outbound_trace_archived_at: now,
            status_logs: [
              ...(j.status_logs || []),
              {
                at: now,
                from: j.status,
                to: "ยกเลิก",
                reason: `${traceCancelReason.trim()} | Action Plan: ${traceCancelActionPlan.trim()} (Stock)`,
              },
            ],
          },
    )
    const w1 = writeJobsWithConcurrencyCheck(next as ASServiceJob[], expectedVer)
    if (!w1.ok) {
      jobsVersionRef.current = readJobsVersion()
      window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key: AS_STORE_KEYS.jobs } }))
      setDispatchSuccess("บันทึกไม่สำเร็จ: ข้อมูลงานถูกแก้ในแท็บอื่น — รีเฟรชแล้วลองอีกครั้ง")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    jobsVersionRef.current = w1.nextVersion
    appendStockOutboundTraceLog({
      id: newId("sot"),
      close_kind: "OUTBOUND_TRACE_CANCELLED",
      recorded_at: now,
      service_job_id: job.id,
      service_job_no: job.job_no,
      workstream_job_type: job.job_type,
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      service_status_at_action: job.status,
      cancellation_reason: traceCancelReason.trim(),
      cancellation_action_plan: traceCancelActionPlan.trim(),
    })
    setTraceActionDialog(null)
    setDispatchSuccess(`ยกเลิกการติดตาม ${job.job_no} แล้ว — บันทึกใน Service trace log`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  function confirmOutboundTraceComplete() {
    if (!traceActionDialog || traceActionDialog.mode !== "complete") return
    if (!traceCompleteConfirmChecked) return
    const job = traceActionDialog.job
    if (job.status !== "ปิดงาน" || job.stock_return_pending) {
      setDispatchSuccess("ยืนยันไม่สำเร็จ: งานต้องปิดใน Service และไม่รอรับเข้าคลัง (กรณีรอรับคืนให้กดยอมรับรับเข้า Stock ก่อน)")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    const now = new Date().toISOString()
    const expectedVer = jobsVersionRef.current
    const all = readJobs([])
    const next = all.map((j) =>
      j.id !== job.id
        ? j
        : {
            ...j,
            stock_outbound_trace_archived: true,
            stock_outbound_trace_archived_at: now,
            status_logs: [
              ...(j.status_logs || []),
              {
                at: now,
                from: j.status,
                to: j.status,
                reason: `Stock outbound trace archived (OUTBOUND_TRACE_COMPLETED)${traceCompleteNote.trim() ? ` — ${traceCompleteNote.trim()}` : ""}`,
              },
            ],
          },
    )
    const w2 = writeJobsWithConcurrencyCheck(next, expectedVer)
    if (!w2.ok) {
      jobsVersionRef.current = readJobsVersion()
      window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key: AS_STORE_KEYS.jobs } }))
      setDispatchSuccess("บันทึกไม่สำเร็จ: ข้อมูลงานถูกแก้ในแท็บอื่น — รีเฟรชแล้วลองอีกครั้ง")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    jobsVersionRef.current = w2.nextVersion
    appendStockOutboundTraceLog({
      id: newId("sot"),
      close_kind: "OUTBOUND_TRACE_COMPLETED",
      recorded_at: now,
      service_job_id: job.id,
      service_job_no: job.job_no,
      workstream_job_type: job.job_type,
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      service_status_at_action: job.status,
      completion_note: traceCompleteNote.trim() || undefined,
    })
    setTraceActionDialog(null)
    setDispatchSuccess(`ยืนยันงานเสร็จ ${job.job_no} — ย้ายไป Service trace log แล้ว`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  /** ปลดจองจากสต็อกจริง + ลบแถว booking metadata (ถ้ามี) — แหล่งความจริงคือ `items.status === reserved` */
  function releaseBookingByItemId(itemId: string) {
    if (!window.confirm("ปลดการจองรายการนี้? สถานะจะกลับเป็น In Stock")) return
    setItems((p) =>
      p.map((i) =>
        i.id === itemId
          ? { ...i, status: "in_stock", reserved_by_sales: undefined, reserved_for_customer: undefined }
          : i,
      ),
    )
    setBookings((p) => p.filter((b) => b.item_id !== itemId))
  }

  function addBooking(b: Booking) {
    setBookings(p => [...p, b])
    setItems(p => p.map(i => i.id === b.item_id ? { ...i, status:"reserved", reserved_by_sales:b.sales_name, reserved_for_customer:b.customer_name } : i))
  }

  function decideSEBookingRequest(req: Booking, decision: "approved" | "rejected") {
    const feedback =
      decision === "approved"
        ? "Stock อนุมัติ: มีสินค้าเพียงพอสำหรับ booking"
        : "Stock ปฏิเสธ: สินค้าไม่เพียงพอ/ยังไม่พร้อมจอง"
    const decidedAt = new Date().toISOString()
    setBookings((prev) =>
      prev.map((b) =>
        b.id === req.id
          ? {
              ...b,
              request_status: decision,
              stock_feedback: feedback,
              decided_at: decidedAt,
            }
          : b,
      ),
    )
    setDispatchSuccess(`${decision === "approved" ? "อนุมัติ" : "ปฏิเสธ"}คำขอจาก SE แล้ว`)
    setTimeout(() => setDispatchSuccess(null), 3000)
  }

  function receiveClaimReplacementFromStock(claim: ASCommissioningClaimCase, replacementSN: string, note: string) {
    const sn = replacementSN.trim()
    if (!sn) return
    const now = new Date().toISOString()
    const scope = claim.claim_scope ?? "whole_unit"
    const partHint =
      scope !== "whole_unit" && claim.claimed_component_label
        ? ` · ${claim.claimed_component_label}`
        : ""
    const parentHint = claim.parent_serial_number ? ` · parent SN ${claim.parent_serial_number}` : ""
    const replacementDispatch = {
      id: newId("disp"),
      customer_org: claim.customer_org,
      customer_contact: claim.customer_name || "",
      item_name: `${claim.model} (Replacement Claim)`,
      serial_number: sn,
      job_type: "commissioning" as const,
      symptom: `[CLAIM_CASE:${claim.id}] Replacement from overseas for claimed SN ${claim.old_serial_number}${partHint}${parentHint}. ${claim.failure_reason}`,
      dispatched_by: "Stock Team",
      dispatched_at: now,
    }
    appendStockDispatch(replacementDispatch)
    const updated = updateCommissioningClaimCase(claim.id, {
      status: "replacement_received",
      replacement_serial_number: sn,
      replacement_dispatch_id: replacementDispatch.id,
      replacement_received_at: now,
      replacement_note: note.trim() || undefined,
    })
    if (updated) {
      setClaimCases(readCommissioningClaimCases([]))
    }
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: claim.old_serial_number,
      model: claim.model,
      customer_org: claim.customer_org,
      job_id: claim.source_job_id,
      job_no: claim.source_job_no,
      event_kind: "replacement_received",
      status: "รอประเมิน",
      message: `Replacement received by Stock, SN ${sn}${note.trim() ? ` · ${note.trim()}` : ""}`,
      created_at: now,
    })
    setClaimReceiveTarget("")
    setClaimReplacementSerial("")
    setClaimReplacementNote("")
    setDispatchSuccess("รับเครื่องทดแทนแล้ว และส่งเข้า Service commissioning queue เรียบร้อย")
    setTimeout(() => setDispatchSuccess(null), 3500)
  }

  function quickLoanItem(item: StockItem, payload: { customer: string; dueDate: string; dealId?: string }) {
    if (!canOpenStockLoanForm(item)) {
      setDispatchSuccess("ยืมไม่ได้: Demo ยืมได้ทันที — สินค้าอื่นต้องได้รับอนุมัติก่อน")
      setTimeout(() => setDispatchSuccess(null), 4000)
      return
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "on_loan",
              loaned_to: payload.customer,
              loan_due: payload.dueDate,
              loan_date: today,
              loan_approval_status: undefined,
              loan_approval_note: undefined,
              loan_approved_at: undefined,
              loan_approved_by: undefined,
            }
          : i,
      ),
    )
    if (payload.dealId) {
      const session = readMockSession()
      appendSEDealActivity({
        deal_id: payload.dealId,
        activity_type: "demo_loan",
        source: "stock_loan",
        subject: `ยืมเครื่องออก: ${item.name}`,
        note: `ลูกค้า: ${payload.customer} · คืน ${payload.dueDate}`,
        occurred_on: today,
        actor_name: session.displayName?.trim() || session.userId,
        meta: { stock_item_name: item.name, serial_number: item.serial_number },
      })
    }
    setDispatchSuccess(`อัปเดตเป็น Loan แล้ว (${payload.customer})`)
    setTimeout(() => setDispatchSuccess(null), 2500)
  }

  function submitLoanApprovalRequest(item: StockItem, note: string) {
    setItems((p) =>
      p.map((i) =>
        i.id === item.id
          ? {
              ...i,
              loan_approval_status: "pending" as const,
              loan_approval_note: note.trim() || undefined,
              loan_approved_at: undefined,
              loan_approved_by: undefined,
            }
          : i,
      ),
    )
    setDispatchSuccess("บันทึกคำขออนุมัติยืมแล้ว — รอผู้อนุมัติกด «อนุมัติการยืม» ใน Quick Action")
    setTimeout(() => setDispatchSuccess(null), 4500)
  }

  function approveStockLoanRequest(item: StockItem) {
    if (item.loan_approval_status !== "pending") return
    const session = readMockSession()
    if (!canApproveStockLoan(session)) {
      setDispatchSuccess("ไม่มีสิทธิ์อนุมัติยืม — ต้องเป็น Admin / Approver (ตั้งค่าใน localStorage key as_mock_session)")
      setTimeout(() => setDispatchSuccess(null), 5000)
      return
    }
    const approvedAt = new Date().toISOString()
    const approvedBy = session.displayName?.trim() || session.userId
    setItems((p) =>
      p.map((i) =>
        i.id === item.id
          ? {
              ...i,
              loan_approval_status: "approved" as const,
              loan_approved_at: approvedAt,
              loan_approved_by: approvedBy,
            }
          : i,
      ),
    )
    setDispatchSuccess(`อนุมัติการยืมแล้วโดย ${approvedBy} — กด Loan เพื่อบันทึกการยืมออก`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  function rejectStockLoanRequest(item: StockItem) {
    if (item.loan_approval_status !== "pending") return
    setItems((p) =>
      p.map((i) =>
        i.id === item.id
          ? {
              ...i,
              loan_approval_status: undefined,
              loan_approval_note: undefined,
              loan_approved_at: undefined,
              loan_approved_by: undefined,
            }
          : i,
      ),
    )
    setDispatchSuccess("ปฏิเสธคำขออนุมัติยืมแล้ว")
    setTimeout(() => setDispatchSuccess(null), 3500)
  }

  function handleQuickAction(item: StockItem, action: string) {
    if (!action) return
    setActionMenuId(null)
    if (action === "send_job") {
      setDispatchDialog(item)
      return
    }
    if (action === "loan") {
      if (!canOpenStockLoanForm(item)) {
        setDispatchSuccess("ยืมไม่ได้ — สินค้าไม่ใช่ Demo ต้องขออนุมัติและได้รับอนุมัติก่อน")
        setTimeout(() => setDispatchSuccess(null), 4000)
        return
      }
      setLoanDialog(item)
      return
    }
    if (action === "request_loan_approval") {
      if (isLoanDemoCategory(item) || item.loan_approval_status) return
      if (item.status !== "in_stock" && item.status !== "reserved") return
      setLoanRequestItem(item)
      return
    }
    if (action === "approve_loan_request") {
      if (!window.confirm(`อนุมัติให้ยืม ${item.serial_number || item.name}?`)) return
      approveStockLoanRequest(item)
      return
    }
    if (action === "reject_loan_request") {
      rejectStockLoanRequest(item)
      return
    }
    if (action === "return_loan") {
      setReturnDemoDialog(item)
      return
    }
    if (action === "sell_stock") {
      if (item.status === "sold") return
      if (!STATUSES_ALLOWED_SELL.includes(item.status)) {
        setDispatchSuccess("ตัดขายได้เฉพาะ In Stock / Booking — ไม่รวม On Loan / Pending QC")
        setTimeout(() => setDispatchSuccess(null), 4500)
        return
      }
      setSellStockItem(item)
      return
    }
    if (action === "update_calibration") {
      if (!item.serial_number) return
      setCalibrationUpdateItem(item)
      setActionMenuId(null)
      return
    }
    if (action === "booking_item") {
      if (!item.has_serial || !item.serial_number) {
        setDispatchSuccess("Booking ต้องใช้สินค้าที่มี SN")
        setTimeout(() => setDispatchSuccess(null), 3500)
        return
      }
      if (item.status !== "in_stock" && item.status !== "reserved") {
        setDispatchSuccess("Booking ใช้ได้เมื่อสถานะ In Stock หรือ Booking เท่านั้น")
        setTimeout(() => setDispatchSuccess(null), 3500)
        return
      }
      setBookingPrefillItemId(item.id)
      setBookingDialog(true)
      return
    }
    if (action === "make_demo") {
      if (item.category === "demo") return
      if (!window.confirm("ตั้งประเภทรายการนี้เป็น Demo Unit? (ยังไม่เปลี่ยนสถานะ In Stock / Loan)")) return
      setItems((p) =>
        p.map((i) =>
          i.id === item.id
            ? { ...i, category: "demo" as StockCategory, loan_approval_status: undefined, loan_approval_note: undefined }
            : i,
        ),
      )
      setDispatchSuccess("อัปเดตประเภทเป็น Demo Unit แล้ว")
      setTimeout(() => setDispatchSuccess(null), 3000)
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
        id: newId("ma"),
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
        id: newId("ma-sep"),
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
  }

  function updateCalibrationForItem(item: StockItem, lastCalibrationDate: string) {
    const due = addYearsToISODate(lastCalibrationDate, 1)
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, last_calibration_date: lastCalibrationDate, calibration_due_date: due }
          : i,
      ),
    )
    if (item.serial_number) {
      const assets = readProactiveCalibrationAssets([])
      const key = item.serial_number.trim().toLowerCase()
      const existing = assets.find((a) => a.serial_number.trim().toLowerCase() === key)
      const nextRecord: ASProactiveCalibrationAsset = {
        id: existing?.id || newId("pc-upd"),
        customer_org: existing?.customer_org || item.sold_to_org || PROACTIVE_ORG_STOCK_INBOUND,
        customer_name: existing?.customer_name || item.sold_contact || undefined,
        manufacturer: item.brand,
        model: item.model || item.name,
        serial_number: item.serial_number,
        last_calibration_date: lastCalibrationDate,
        due_date: due,
        note: "Updated from Stock: Calibration returned from lab",
        created_at: existing?.created_at || new Date().toISOString(),
      }
      const nextAssets = existing
        ? assets.map((a) => (a.id === existing.id ? nextRecord : a))
        : [nextRecord, ...assets]
      writeProactiveCalibrationAssets(nextAssets)
    }
    setCalibrationUpdateItem(null)
    setDispatchSuccess(`Updated calibration for ${item.serial_number || item.name} (Next Due: ${due})`)
    setTimeout(() => setDispatchSuccess(null), 4000)
  }

  const catCounts = (Object.keys(CAT_LABELS) as StockCategory[]).reduce((acc, c) => { acc[c] = items.filter(i => i.category === c).length; return acc }, {} as Record<StockCategory, number>)

  const filteredDispatchHistory = useMemo(() => {
    const q = serviceHistorySearch.trim().toLowerCase()
    return dispatchAcceptedHistory.filter((h) => {
      const typeOk = serviceHistoryJobType === "all" || h.job_type === serviceHistoryJobType
      const text =
        `${h.serial_number} ${h.item_name} ${h.service_job_no} ${h.customer_org} ${h.symptom} ${h.model || ""}`.toLowerCase()
      return typeOk && (!q || text.includes(q))
    })
  }, [dispatchAcceptedHistory, serviceHistorySearch, serviceHistoryJobType])

  const filteredCompletedReturns = useMemo(() => {
    const q = serviceHistorySearch.trim().toLowerCase()
    return completedStockReturns.filter((j) => {
      const typeOk = serviceHistoryJobType === "all" || j.job_type === serviceHistoryJobType
      const text = `${j.serial_number} ${j.model} ${j.job_no} ${j.customer_org}`.toLowerCase()
      return typeOk && (!q || text.includes(q))
    })
  }, [completedStockReturns, serviceHistorySearch, serviceHistoryJobType])

  const filteredOutboundTraceLog = useMemo(() => {
    const q = serviceHistorySearch.trim().toLowerCase()
    return outboundTraceLog.filter((e) => {
      const typeOk = serviceHistoryJobType === "all" || e.workstream_job_type === serviceHistoryJobType
      const text =
        `${e.serial_number} ${e.model} ${e.service_job_no} ${e.customer_org} ${e.close_kind} ${e.cancellation_reason || ""} ${e.completion_note || ""}`.toLowerCase()
      return typeOk && (!q || text.includes(q))
    })
  }, [outboundTraceLog, serviceHistorySearch, serviceHistoryJobType])

  const serviceTraceLogTabCount =
    dispatchAcceptedHistory.length + completedStockReturns.length + outboundTraceLog.length

  /** รวมประวัติขาย: ธุรกรรม STATUS_SOLD + master ที่ Sold แต่ไม่มีแถวธุรกรรม (กรณีข้อมูลไม่ครบ) */
  const soldHistoryRows = useMemo(() => {
    const txs = transactions
      .filter((tx) => tx.reference === "STATUS_SOLD")
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    const txItemIds = new Set(txs.map((t) => t.item_id))
    const masterOnly = soldItems
      .filter((i) => !txItemIds.has(i.id))
      .map((item) => ({ kind: "master" as const, item, sortKey: item.sold_at || "" }))
    const withTx = txs.map((tx) => ({ kind: "tx" as const, tx, sortKey: tx.date }))
    return [...withTx, ...masterOnly].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
  }, [transactions, soldItems])

  const JOB_TYPE_LABELS: Record<ASServiceJob["job_type"], string> = {
    repair: "Repair",
    preventive_maintenance: "Preventive Maintenance",
    calibration: "Calibration",
    commissioning: "Commissioning Test",
  }

  const OUTBOUND_TRACE_CLOSE_LABELS: Record<ASStockOutboundTraceLogEntry["close_kind"], string> = {
    OUTBOUND_TRACE_COMPLETED: "Outbound trace completed",
    OUTBOUND_TRACE_CANCELLED: "Outbound trace cancelled",
  }

  const demoStockCount = items.filter((i) => i.category === "demo").length

  const stockTabHeroes: {
    id: Tab
    title: string
    subtitle: string
    count: number
    Icon: LucideIcon
    accent: { active: string; idle: string; panel: string }
  }[] = [
    {
      id: "all",
      title: "All Stock",
      subtitle: "มุมมองหลัก · Master & กรองหมวด",
      count: items.length,
      Icon: LayoutGrid,
      accent: {
        active: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/35",
        idle: "bg-sky-50/90 text-sky-700 ring-1 ring-sky-100/80 group-hover:bg-sky-100",
        panel: "from-sky-500/[0.07] via-white to-white",
      },
    },
    {
      id: "booking",
      title: "Booking",
      subtitle: "จองจาก Sales · SE Deal",
      count: reservedItems.length,
      Icon: Bookmark,
      accent: {
        active: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30",
        idle: "bg-amber-50/90 text-amber-800 ring-1 ring-amber-100/80 group-hover:bg-amber-100",
        panel: "from-amber-500/[0.08] via-white to-white",
      },
    },
    {
      id: "claim",
      title: "Claim",
      subtitle: "Commissioning / เคลม",
      count: activeClaimCases.length,
      Icon: ShieldCheck,
      accent: {
        active: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30",
        idle: "bg-violet-50/90 text-violet-800 ring-1 ring-violet-100/80 group-hover:bg-violet-100",
        panel: "from-violet-500/[0.08] via-white to-white",
      },
    },
    {
      id: "sold_history",
      title: "Sold",
      subtitle: "ประวัติตัดขาย",
      count: soldHistoryRows.length,
      Icon: History,
      accent: {
        active: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/28",
        idle: "bg-emerald-50/90 text-emerald-800 ring-1 ring-emerald-100/80 group-hover:bg-emerald-100",
        panel: "from-emerald-500/[0.07] via-white to-white",
      },
    },
    {
      id: "loan",
      title: "Loan",
      subtitle: "ยืมออก · ติดตามคืน",
      count: stockOnLoan.length,
      Icon: ArrowLeftRight,
      accent: {
        active: "bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/28",
        idle: "bg-cyan-50/90 text-cyan-800 ring-1 ring-cyan-100/80 group-hover:bg-cyan-100",
        panel: "from-cyan-500/[0.08] via-white to-white",
      },
    },
    {
      id: "demo",
      title: "Demo Tracker",
      subtitle: "Demo unit · ยืม/คืน",
      count: demoStockCount,
      Icon: Sparkles,
      accent: {
        active: "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-orange-400/30",
        idle: "bg-orange-50/90 text-orange-800 ring-1 ring-orange-100/80 group-hover:bg-orange-100",
        panel: "from-orange-500/[0.08] via-white to-white",
      },
    },
    {
      id: "service_history",
      title: "Service trace",
      subtitle: "Outbound · ประวัติส่งซ่อม",
      count: serviceTraceLogTabCount,
      Icon: Activity,
      accent: {
        active: "bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-md shadow-indigo-500/30",
        idle: "bg-indigo-50/90 text-indigo-800 ring-1 ring-indigo-100/80 group-hover:bg-indigo-100",
        panel: "from-indigo-500/[0.08] via-white to-white",
      },
    },
  ]

  return (
    <div className="h-full flex flex-col relative z-10 p-1">
      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600/80 mb-1">After Service · Stock</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">คลังสินค้า</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} รายการ
            {lowStock.length > 0 && (
              <>
                {" "}
                · <span className="text-red-600 font-semibold">{lowStock.length} ต่ำกว่า Minimum</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 justify-start sm:justify-end">
          <div className="inline-flex flex-col gap-2 rounded-2xl bg-white/90 p-1.5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-gray-900/[0.06] backdrop-blur-sm sm:flex-row sm:items-stretch sm:gap-1">
            <button
              type="button"
              onClick={() => setReceiveProductDialog(true)}
              className="group flex items-center gap-3 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-4 py-2.5 text-left text-white shadow-[0_4px_14px_rgba(5,150,105,0.35)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(5,150,105,0.42)] hover:brightness-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 shadow-inner">
                <ArrowDownCircle className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/95">รับเข้าคลัง</span>
                <span className="text-sm font-semibold tracking-tight">Input Product</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddDialog({ open: true, data: {} })}
              className="group flex items-center gap-3 rounded-xl border border-gray-200/90 bg-white px-4 py-2.5 text-left text-slate-800 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-slate-50/90 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200/80 transition-colors group-hover:bg-white group-hover:ring-slate-300">
                <Plus className="h-5 w-5 text-slate-600" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Master data</span>
                <span className="text-sm font-semibold tracking-tight text-slate-900">Item Master</span>
              </span>
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label="Open notifications"
                onClick={() => setNotificationPopoverOpen((v) => !v)}
                className="relative h-full min-h-[58px] px-4 rounded-xl border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
              >
                <Bell className="h-5 w-5" />
                {unreadStockNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadStockNotifications.length > 99 ? "99+" : unreadStockNotifications.length}
                  </span>
                )}
              </button>
              {notificationPopoverOpen && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-2xl border border-blue-100 bg-white shadow-xl z-30">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-800">Service Alerts</p>
                    {unreadStockNotifications.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllNotifications((v) => !v)}
                        className="text-[11px] font-bold text-blue-700 underline"
                      >
                        {showAllNotifications ? "Show less" : "Show all"}
                      </button>
                    )}
                  </div>
                  {unreadStockNotifications.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-gray-500">No new notifications</p>
                  ) : (
                    <div className="max-h-[320px] overflow-auto p-2 space-y-2">
                      {visibleUnreadNotifications.map((n) => (
                        <div key={n.id} className="rounded-xl border border-gray-100 px-3 py-2 bg-gray-50/40">
                          <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5">{n.message}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[10px] text-gray-500">{formatThDateTime(n.created_at)}</p>
                            <button
                              type="button"
                              onClick={() => markNotificationAsRead(n.id)}
                              className="px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-[10px] font-bold hover:bg-gray-100"
                            >
                              Mark read
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {dispatchSuccess && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl mb-4 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 font-semibold">{dispatchSuccess}</p>
        </div>
      )}

      {seOrderRequests.some((r) => !r.stock_po_verified) && (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 ring-1 ring-violet-100">
          <h2 className="text-sm font-bold text-violet-900 mb-1">Order Request จาก SE</h2>
          <p className="text-[11px] text-violet-800/90 mb-3 leading-relaxed">
            ตรวจเลข PO ลูกค้ากับอีเมลที่บริษัทได้รับ (ออเดอร์จริงออกนอกระบบ) — ติ๊กเมื่อตรงกัน
          </p>
          <div className="space-y-2">
            {seOrderRequests
              .filter((r) => !r.stock_po_verified)
              .map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/80 bg-white/90 p-3 text-xs shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-mono text-[10px] text-muted-foreground">{r.deal_no}</p>
                    <p className="font-semibold text-gray-900">{r.deal_title}</p>
                    <p className="text-muted-foreground">{r.customer_name}</p>
                    <p>
                      <span className="text-muted-foreground">PO ลูกค้า:</span>{" "}
                      <span className="font-mono font-medium">{r.customer_po_no}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">QT Admin:</span>{" "}
                      <span className="font-mono font-medium">{r.admin_quote_no}</span>
                    </p>
                    {r.note ? <p className="text-[11px] text-gray-600 pt-0.5">{r.note}</p> : null}
                    <p className="text-[10px] text-muted-foreground">SE: {r.owner}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 shrink-0 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-violet-400"
                      checked={!!r.stock_po_verified}
                      onChange={(e) => {
                        const session = readMockSession()
                        const by = session.displayName?.trim() || session.userId
                        setSEOrderRequestPoVerified(r.id, e.target.checked, by)
                        setSeOrderRequests(readSEOrderRequests([]))
                      }}
                    />
                    <span className="text-[11px] font-semibold text-violet-900 whitespace-nowrap">
                      PO ตรงกับอีเมลแล้ว
                    </span>
                  </label>
                </div>
              ))}
          </div>
        </div>
      )}

      {(nearDueLoans.length > 0 || overdueLoans.length > 0 || badCustomers.length > 0) && (
        <div className="glass-panel rounded-2xl p-3 mb-3 premium-glow">
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

      {pendingStockReturns.length > 0 && (
        <div className="glass-panel rounded-2xl p-3 mb-3 border-2 border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-bold text-amber-900">รับเครื่องกลับจาก Service (ปิดงานแล้ว)</p>
              <p className="text-xs text-amber-800 mt-0.5">
                กดยอมรับเพื่อบันทึกรับเข้าคลังและตั้งสถานะพร้อมจำหน่าย (In Stock)
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 text-xs font-bold shrink-0">
              {pendingStockReturns.length} รายการ
            </span>
          </div>
          <div className="space-y-2">
            {pendingStockReturns.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-amber-100 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-gray-500">{job.job_no}</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{job.model}</p>
                  <p className="text-xs text-gray-500 font-mono">SN: {job.serial_number}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{job.customer_org}</p>
                </div>
                <button
                  type="button"
                  onClick={() => acceptStockReturn(job)}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                >
                  ยอมรับรับเข้า Stock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(actionablePartsRequests.length > 0 || unreadStockNotifications.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
          <div className="glass-panel rounded-2xl p-3 border border-amber-200 bg-amber-50/40">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-amber-900">Parts Requests จาก Service</p>
              <span className="px-2 py-0.5 rounded-lg bg-amber-200 text-amber-900 text-xs font-bold">
                {actionablePartsRequests.length}
              </span>
            </div>
            {actionablePartsRequests.length === 0 ? (
              <p className="text-xs text-amber-800">ยังไม่มีคำขออะไหล่ค้าง</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                {actionablePartsRequests.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-amber-100 px-3 py-2">
                    <p className="text-xs font-mono text-gray-500">{r.job_no}</p>
                    <p className="text-sm font-semibold text-gray-900">{r.part_name} x{r.qty}</p>
                    <p className="text-xs text-gray-600">{r.model} · {r.customer_org}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      สถานะ: {r.status === "pending" ? "รออนุมัติ" : "อนุมัติแล้ว รอจ่าย"}
                    </p>
                    {r.note && <p className="text-xs text-gray-500 mt-0.5">โน้ต: {r.note}</p>}
                    <div className="mt-2">
                      {(() => {
                        const step =
                          r.status === "pending"
                            ? 0
                            : r.status === "approved"
                              ? 1
                              : r.status === "fulfilled"
                                ? 2
                                : -1
                        const labels = ["Pending", "Approved", "Fulfilled"]
                        return (
                          <>
                            <div className="flex items-center">
                              {[0, 1, 2].map((i) => (
                                <div key={i} className="flex items-center flex-1">
                                  <div
                                    className={`h-2.5 w-2.5 rounded-full ${
                                      step >= 0 && i <= step ? "bg-emerald-500" : "bg-gray-300"
                                    }`}
                                  />
                                  {i < 2 && (
                                    <div
                                      className={`h-0.5 flex-1 mx-1 ${
                                        step >= 0 && i < step ? "bg-emerald-500" : "bg-gray-200"
                                      }`}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              {labels.map((lb, i) => (
                                <span
                                  key={lb}
                                  className={`text-[10px] ${
                                    step >= 0 && i <= step ? "text-emerald-700 font-semibold" : "text-gray-400"
                                  }`}
                                >
                                  {lb}
                                </span>
                              ))}
                            </div>
                            {r.status === "rejected" && (
                              <p className="text-[10px] text-rose-600 mt-1 font-semibold">Rejected</p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {r.approved_at && <p className="text-[10px] text-gray-500">Approved at: {formatThDateTime(r.approved_at)}</p>}
                      {r.fulfilled_at && <p className="text-[10px] text-gray-500">Fulfilled at: {formatThDateTime(r.fulfilled_at)}</p>}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => approvePartsRequest(r)}
                        disabled={r.status !== "pending"}
                        className="px-2.5 py-1 rounded-lg bg-blue-500 disabled:bg-gray-300 text-white text-[11px] font-bold hover:bg-blue-600"
                      >
                        อนุมัติจ่าย
                      </button>
                      <button
                        type="button"
                        onClick={() => fulfillPartsRequest(r)}
                        disabled={r.status !== "approved"}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 disabled:bg-gray-300 text-white text-[11px] font-bold hover:bg-emerald-600"
                      >
                        จ่ายแล้ว
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">อนุมัติ {"->"} จ่ายของจริง</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-3 mb-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">สถานะงานที่ส่งไป Service</p>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold">รอรับโดย Service ({pendingInServiceInbox})</span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">กำลังดำเนินการ ({serviceRequestsFromStock.length})</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          เมื่อฝ่าย Service กดรับคิวจาก Stock แล้ว รายการจะหายจาก &quot;รอรับโดย Service&quot; และไปที่แท็บ{" "}
          <span className="font-semibold text-gray-700">Service trace log</span>
          {" · "}
          กด <span className="font-semibold">ยกเลิก</span> หรือ <span className="font-semibold">งานเสร็จ</span> ต้องยืนยันเสมอ
          แล้วจะบันทึกในประวัติ (close kind แยกจากประเภทงาน repair/calibration)
        </p>
        {serviceRequestsFromStock.length === 0 ? (
          <p className="text-xs text-gray-500 mt-2">ยังไม่มีงานจาก Stock ที่กำลังดำเนินการใน Service Request</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-[320px] overflow-y-auto pr-1">
            {serviceRequestsFromStock.map((job) => {
              const canCompleteTrace = job.status === "ปิดงาน" && !job.stock_return_pending
              return (
                <div key={job.id} className="bg-white/80 border border-white rounded-xl px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono text-gray-500">{job.job_no}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${statusColor[job.status]}`}>
                      {statusLabel[job.status]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{job.model}</p>
                  <p className="text-xs text-gray-500 truncate">{job.customer_org}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => openOutboundTraceCancel(job)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold hover:bg-gray-200 border border-gray-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={!canCompleteTrace}
                      title={
                        canCompleteTrace
                          ? "ยืนยันงานเสร็จและย้ายไป Service trace log"
                          : "ใช้ได้เมื่องานปิดใน Service และไม่รอรับเข้าคลัง"
                      }
                      onClick={() => openOutboundTraceComplete(job)}
                      className="px-2.5 py-1 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      งานเสร็จ
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stock view — Hero badges */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Navigation</p>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">มุมมองคลัง</h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md leading-snug">
            เลือกมุมมองแบบการ์ด — ตัวเลขสรุปจำนวนรายการที่เกี่ยวข้อง
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {stockTabHeroes.map((t) => {
            const active = tab === t.id
            const Icon = t.Icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "group relative flex flex-col rounded-3xl border-2 p-4 text-left transition-all duration-200 min-h-[132px]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
                  active
                    ? cn(
                        "border-slate-900/88 shadow-[0_14px_40px_-14px_rgba(15,23,42,0.35)] scale-[1.02] z-[1] bg-gradient-to-b",
                        t.accent.panel,
                      )
                    : "border-slate-200/90 bg-white/90 hover:border-slate-300 hover:bg-white hover:shadow-lg hover:-translate-y-0.5",
                )}
              >
                <div className="relative flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200",
                        active ? t.accent.active : t.accent.idle,
                        !active && "group-hover:scale-105",
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </span>
                    {active && (
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]"
                        aria-hidden
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-sm font-bold tracking-tight leading-tight",
                      active ? "text-slate-900" : "text-slate-800 group-hover:text-slate-900",
                    )}
                  >
                    {t.title}
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-[28px] font-black tabular-nums leading-none tracking-tight",
                      active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900",
                    )}
                  >
                    {t.count}
                  </p>
                  <p className="mt-2 text-[10px] font-medium text-slate-500 leading-snug line-clamp-2">{t.subtitle}</p>
                </div>
              </button>
            )
          })}
        </div>
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-gray-500 shrink-0">ตัวกรอง</span>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="text-xs rounded-xl border border-gray-200 px-2.5 py-1.5 bg-white min-w-[120px]"
              aria-label="Brand"
            >
              <option value="all">แบรนด์ทั้งหมด</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value as StockCategory | "all")}
              className="text-xs rounded-xl border border-gray-200 px-2.5 py-1.5 bg-white min-w-[130px]"
              aria-label="Category"
            >
              <option value="all">หมวดทั้งหมด</option>
              {(Object.keys(CAT_LABELS) as StockCategory[]).map((c) => (
                <option key={c} value={c}>{CAT_LABELS[c]}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ItemStatus | "all")}
              className="text-xs rounded-xl border border-gray-200 px-2.5 py-1.5 bg-white min-w-[130px]"
              aria-label="Status"
            >
              <option value="all">สถานะทั้งหมด</option>
              {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <span className="hidden sm:inline w-px h-5 bg-gray-200" aria-hidden />
            <span className="text-xs font-semibold text-gray-500 shrink-0">เรียง</span>
            <select
              value={stockTableSort}
              onChange={(e) => setStockTableSort(e.target.value as StockTableSort)}
              className="text-xs rounded-xl border border-gray-200 px-2.5 py-1.5 bg-white min-w-[200px]"
              aria-label="Sort order"
            >
              <option value="default">ตามระบบ (ไม่บังคับเก่าก่อน)</option>
              <option value="days_high">Days in stock: มาก → น้อย (ของเก่า)</option>
              <option value="days_low">Days in stock: น้อย → มาก (ของใหม่)</option>
              <option value="name_az">ชื่อ A–Z</option>
              <option value="qty_high">จำนวน มาก → น้อย</option>
            </select>
          </div>
          <div className="flex-1 overflow-auto rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Item / SN","Brand","Category","Qty","Min","Days In Stock","Calibration","Status","Quick Action"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                        h === "Quick Action" ? "min-w-[240px]" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
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
                      <td className="px-4 py-3 text-[10px] whitespace-nowrap leading-tight">
                        <div className="space-y-px">
                          <span className="block font-mono text-teal-800" title={item.last_calibration_date || "—"}>
                            Cal: {item.last_calibration_date ? formatThDateFromYMD(item.last_calibration_date) : "—"}
                          </span>
                          <span className="block font-mono text-amber-800" title={item.calibration_due_date || "—"}>
                            Due: {item.calibration_due_date ? formatThDateFromYMD(item.calibration_due_date) : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Pill label={STATUS_LABELS[item.status]} color={STATUS_COLORS[item.status]} />
                        {item.status === "sold" && item.sold_to_org && (
                          <p className="text-[11px] text-gray-600 mt-0.5 truncate max-w-[140px]" title={item.sold_to_org}>
                            ขาย: {item.sold_to_org}
                          </p>
                        )}
                        {item.status === "sold" && item.sold_customer_po && (
                          <p className="text-[10px] font-mono text-gray-500">PO {item.sold_customer_po}</p>
                        )}
                        {item.reserved_by_sales && <p className="text-xs text-orange-600 mt-0.5">By {item.reserved_by_sales}</p>}
                        {item.reserved_for_customer && <p className="text-xs text-gray-500">{item.reserved_for_customer}</p>}
                        {item.loaned_to && <p className="text-xs text-blue-600 mt-0.5">{item.loaned_to}</p>}
                        {!isLoanDemoCategory(item) && item.loan_approval_status === "pending" && (
                          <p className="text-[10px] font-semibold text-amber-700 mt-0.5">รออนุมัติยืม</p>
                        )}
                        {!isLoanDemoCategory(item) && item.loan_approval_status === "approved" && item.status !== "on_loan" && (
                          <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">อนุมัติยืมแล้ว</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionMenuId((prev) => (prev === item.id ? null : item.id))
                            }}
                            className="w-full min-w-[220px] inline-flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <span>Quick Action</span>
                            <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                          {actionMenuId === item.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-1 w-72 min-w-[18rem] rounded-xl border border-gray-200 bg-white shadow-lg z-20 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-150"
                            >
                              {(item.status === "in_stock" || item.status === "reserved" || item.status === "sold") && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "send_job") }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-blue-700 hover:bg-blue-50">
                                  Send Job
                                </button>
                              )}
                              {item.serial_number && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "update_calibration") }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-teal-700 hover:bg-teal-50">
                                  Update Calibration
                                </button>
                              )}
                              {item.status !== "sold" && (
                                <>
                              {item.status === "on_loan" ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "return_loan") }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-700 hover:bg-indigo-50">
                                  Return Loan
                                </button>
                              ) : (item.status === "in_stock" || item.status === "reserved") ? (
                                <>
                                  {isLoanDemoCategory(item) && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "loan") }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-700 hover:bg-indigo-50">
                                      Loan (Demo)
                                    </button>
                                  )}
                                  {!isLoanDemoCategory(item) && item.loan_approval_status === "approved" && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "loan") }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-700 hover:bg-indigo-50">
                                      Loan
                                    </button>
                                  )}
                                  {!isLoanDemoCategory(item) && item.loan_approval_status === "pending" && (
                                    <>
                                      <div className="px-2.5 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 rounded-lg border border-amber-100">
                                        Loan Approval Pending
                                      </div>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "approve_loan_request") }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                                        Approve Loan
                                      </button>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "reject_loan_request") }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
                                        Reject Request
                                      </button>
                                    </>
                                  )}
                                  {!isLoanDemoCategory(item) && !item.loan_approval_status && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleQuickAction(item, "request_loan_approval") }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-amber-900 hover:bg-amber-50">
                                      Request Loan Approval
                                    </button>
                                  )}
                                </>
                              ) : null}
                              {(item.status === "in_stock" || item.status === "reserved") && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleQuickAction(item, "sell_stock")
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
                                >
                                  Mark as Sold
                                </button>
                              )}
                              {(item.status === "in_stock" || item.status === "reserved") && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleQuickAction(item, "booking_item")
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-orange-800 hover:bg-orange-50"
                                >
                                  Create Booking
                                </button>
                              )}
                                </>
                              )}
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

          <div className="bg-white rounded-3xl border border-gray-100 p-5 mt-4 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
              <div>
                <h3 className="font-bold text-gray-900">Module assignments</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ประวัติย้าย/แยก Module (เช่น IDA6) จาก Quick Action — ไม่เกี่ยวกับ Loan
                </p>
              </div>
              <input
                value={moduleHistorySearch}
                onChange={(e) => setModuleHistorySearch(e.target.value)}
                className="w-full md:min-w-[280px] px-3 py-2 rounded-xl border border-gray-200 text-sm"
                placeholder="ค้น Module SN"
              />
            </div>
            <div className="space-y-2 max-h-[280px] overflow-auto">
              {moduleAssignments.length === 0 ? (
                <p className="text-sm text-gray-400">ยังไม่มีบันทึก</p>
              ) : (
                moduleAssignments
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
                      <p className="text-xs text-gray-500 mt-0.5">{formatThDateTime(m.created_at)}</p>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Booking ─────────────────────────────────────────────────────── */}
      {tab === "booking" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Booking — การจองสินค้า (Sales)</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                แสดงจากสต็อกจริง <code className="text-xs bg-gray-100 px-1 rounded">status = reserved</code> · วันที่จอง/หมายเหตุเพิ่มเติมมาจากบันทึกผ่านปุ่ม &quot;เพิ่ม Booking&quot; หรือ Quick Action (ถ้ามี)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-bold whitespace-nowrap">
                {reservedItems.length} รายการ
              </span>
              <button
                type="button"
                onClick={() => {
                  setBookingPrefillItemId(null)
                  setBookingDialog(true)
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-colors"
              >
                <Plus className="h-4 w-4" /> เพิ่ม Booking
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
            <Bookmark className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800 space-y-1">
              <p>
                <span className="font-semibold">แหล่งข้อมูล:</span> รายการด้านล่างมาจาก <strong>สินค้าในคลังที่สถานะจอง</strong> เท่านั้น
                (ไม่ซ้ำกับลิสต์ mock แยก) · กด &quot;ยกเลิก Booking&quot; จะปลด <code className="text-[11px] bg-white/80 px-1 rounded">reserved</code> และลบ metadata
                booking ที่ผูก <code className="text-[11px] bg-white/80 px-1 rounded">item_id</code> นั้น
              </p>
              <p className="text-orange-700/90">
                ถ้ามีการตั้ง <code className="text-[11px] bg-white/80 px-1 rounded">reserved</code> จากที่อื่นโดยไม่ผ่านฟอร์ม Booking การ์ดยังแสดง แต่วันที่จอง/หมายเหตุอาจเป็น &quot;—&quot;
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-indigo-200 p-4">
            <h4 className="font-semibold text-sm text-indigo-900 mb-2">คำขอ Booking จาก SE Deals</h4>
            {seBookingRequests.length === 0 ? (
              <p className="text-xs text-gray-500">ยังไม่มีคำขอจาก SE</p>
            ) : (
              <div className="space-y-2">
                {seBookingRequests
                  .sort((a, b) => (a.booked_date < b.booked_date ? 1 : -1))
                  .map((r) => (
                    <div key={r.id} className="rounded-2xl border border-indigo-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{r.item_name}</p>
                          <p className="text-xs text-gray-600">{r.customer_name} · {r.sales_name}</p>
                          {r.se_deal_id && <p className="text-[11px] text-gray-500 font-mono">SE Deal: {r.se_deal_id}</p>}
                        </div>
                        <Badge variant={r.request_status === "approved" ? "success" : r.request_status === "rejected" ? "destructive" : "warning"}>
                          {r.request_status || "pending"}
                        </Badge>
                      </div>
                      {r.note && <p className="text-xs text-gray-500 mt-1">{r.note}</p>}
                      {r.stock_feedback && <p className="text-xs text-indigo-700 mt-1">{r.stock_feedback}</p>}
                      {r.request_status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => decideSEBookingRequest(r, "approved")}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100"
                          >
                            อนุมัติ (ของพอ)
                          </button>
                          <button
                            type="button"
                            onClick={() => decideSEBookingRequest(r, "rejected")}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                          >
                            ปฏิเสธ (ของไม่พอ)
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {reservedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Bookmark className="h-16 w-16 mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีสินค้าสถานะจอง</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {reservedItems.map((item) => {
                const meta = bookings.find((b) => b.item_id === item.id)
                return (
                  <div key={item.id} className="p-5 bg-white rounded-3xl border-2 border-orange-200 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-bold text-gray-900">{item.name}</p>
                        {item.serial_number && <p className="font-mono text-xs text-blue-600 mt-0.5">SN: {item.serial_number}</p>}
                      </div>
                      <Pill label="Booking" color={STATUS_COLORS.reserved} />
                    </div>
                    <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 mb-3 space-y-2">
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">จองโดย (Booking by)</p>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        <span className="text-gray-600 text-xs">Sales:</span>
                        <span className="font-bold text-gray-900">{item.reserved_by_sales || meta?.sales_name || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        <span className="text-gray-600 text-xs">ลูกค้า:</span>
                        <span className="font-bold text-gray-900">{item.reserved_for_customer || meta?.customer_name || "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
                      <ClipboardList className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-500 text-xs">วันที่จอง: {meta?.booked_date || "—"}</span>
                      {meta?.note ? <span className="text-gray-400 text-xs">· {meta.note}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDispatchDialog(item)}
                        className="flex-1 min-w-[120px] py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1"
                      >
                        <Send className="h-3 w-3" /> Send to Services
                      </button>
                      {canOpenStockLoanForm(item) && (
                        <button
                          type="button"
                          onClick={() => handleQuickAction(item, "loan")}
                          className="flex-1 min-w-[100px] py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-xs font-semibold hover:bg-indigo-50"
                        >
                          {isLoanDemoCategory(item) ? "Loan (Demo)" : "Loan"}
                        </button>
                      )}
                      {!isLoanDemoCategory(item) && item.loan_approval_status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(item, "approve_loan_request")}
                            className="flex-1 min-w-[100px] py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100"
                          >
                            อนุมัติการยืม
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(item, "reject_loan_request")}
                            className="flex-1 min-w-[100px] py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                          >
                            ปฏิเสธคำขอ
                          </button>
                        </>
                      )}
                      {!isLoanDemoCategory(item) && !item.loan_approval_status && (
                        <button
                          type="button"
                          onClick={() => handleQuickAction(item, "request_loan_approval")}
                          className="flex-1 min-w-[120px] py-2 rounded-xl bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100"
                        >
                          ขออนุมัติยืม
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => releaseBookingByItemId(item.id)}
                        className="flex-1 min-w-[120px] py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100"
                      >
                        ยกเลิก Booking
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Claim (Commissioning failed) ─────────────────────────────── */}
      {tab === "claim" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
            <Bell className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-900 space-y-1">
              <p>
                ฟังก์ชันย่อย Claim ใน Stock: ติดตามเคส Commissioning ไม่ผ่าน แยกต่อเครื่อง/Module/Sensor ตาม SN และบันทึกรับเครื่องทดแทน
              </p>
              <p className="text-indigo-700/90">
                เมื่อรับเครื่องทดแทน ระบบจะส่งเข้าคิว Service (Commissioning) อัตโนมัติ เพื่อปิด cycle แบบ end-to-end
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px]">
              <label htmlFor="claim-scope-filter" className="block text-xs font-semibold text-gray-600 mb-1">
                ประเภท Claim
              </label>
              <select
                id="claim-scope-filter"
                value={claimFilterScope}
                onChange={(e) => setClaimFilterScope(e.target.value as typeof claimFilterScope)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="all">ทั้งหมด</option>
                <option value="whole_unit">ทั้งเครื่อง</option>
                <option value="module">Module / ชุดคู่</option>
                <option value="sensor">Sensor</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px] max-w-md">
              <label htmlFor="claim-sn-search" className="block text-xs font-semibold text-gray-600 mb-1">
                ค้นหา SN / Job / ลูกค้า
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="claim-sn-search"
                  value={claimSearchQuery}
                  onChange={(e) => setClaimSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  placeholder="SN เคลม, SN หลัก, Replacement, Job No, รุ่น..."
                />
              </div>
            </div>
          </div>
          {activeClaimCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <AlertTriangle className="h-16 w-16 mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีเคส Claim ที่เปิดอยู่</p>
            </div>
          ) : filteredActiveClaimCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-sm">ไม่มีเคสที่ตรงกับตัวกรองหรือคำค้น</p>
              <button
                type="button"
                onClick={() => {
                  setClaimFilterScope("all")
                  setClaimSearchQuery("")
                }}
                className="mt-2 text-xs font-bold text-indigo-600 underline"
              >
                ล้างตัวกรอง
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredActiveClaimCases.map((c) => (
                <div key={c.id} className="p-5 bg-white rounded-3xl border-2 border-indigo-200 shadow-sm">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{c.model}</p>
                      <p className="text-xs text-gray-500">{c.customer_org}</p>
                    </div>
                    <Badge variant={c.status === "replacement_received" || c.status === "replacement_commissioning" ? "success" : "warning"}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">
                    ขอบเขต:{" "}
                    <span className="font-semibold">
                      {c.claim_scope === "module"
                        ? "Module / ชุดคู่"
                        : c.claim_scope === "sensor"
                          ? "Sensor"
                          : "ทั้งเครื่อง"}
                    </span>
                  </p>
                  {c.parent_serial_number && (
                    <p className="text-xs text-gray-600 font-mono mt-1">SN หลัก: {c.parent_serial_number}</p>
                  )}
                  <p className="text-xs text-gray-600 font-mono mt-1">SN เคลม: {c.old_serial_number}</p>
                  {c.claimed_component_label && (
                    <p className="text-xs text-gray-600 mt-1">ชิ้นที่เคลม: {c.claimed_component_label}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">เหตุผล: {c.failure_reason}</p>
                  {c.claim_reference && <p className="text-xs text-gray-600 mt-1">Claim Ref: {c.claim_reference}</p>}
                  {c.replacement_serial_number && (
                    <p className="text-xs text-emerald-700 font-mono mt-1">Replacement SN: {c.replacement_serial_number}</p>
                  )}
                  {c.status === "sent_overseas" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_2fr_auto]">
                      <input
                        value={claimReceiveTarget === c.id ? claimReplacementSerial : ""}
                        onFocus={() => setClaimReceiveTarget(c.id)}
                        onChange={(e) => {
                          setClaimReceiveTarget(c.id)
                          setClaimReplacementSerial(e.target.value)
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono"
                        placeholder="New Replacement SN"
                      />
                      <input
                        value={claimReceiveTarget === c.id ? claimReplacementNote : ""}
                        onFocus={() => setClaimReceiveTarget(c.id)}
                        onChange={(e) => {
                          setClaimReceiveTarget(c.id)
                          setClaimReplacementNote(e.target.value)
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                        placeholder="หมายเหตุรับเข้า"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          receiveClaimReplacementFromStock(
                            c,
                            claimReceiveTarget === c.id ? claimReplacementSerial : "",
                            claimReceiveTarget === c.id ? claimReplacementNote : "",
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600"
                      >
                        รับเครื่องทดแทน
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Sold history ───────────────────────────────────────────────── */}
      {tab === "sold_history" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="glass-panel rounded-2xl p-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">Sold — มุมมองเดียว: </span>
            แถวมาจาก <strong>ธุรกรรม <code className="text-[11px] bg-white px-1 rounded">STATUS_SOLD</code></strong> (ตอนกด Sold ใน Quick Action) เป็นหลัก · ถ้ามีรายการ master สถานะ Sold
            แต่ไม่มีแถวธุรกรรม จะแสดงเพิ่มในคอลัมน์แหล่งว่า <strong>master</strong>
            · รายการ master ทั้งหมดดูได้ที่ All Stock (กรอง Sold)
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-gray-900">ประวัติการตัดขาย (รวม)</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {soldHistoryRows.length} แถว · เรียงจากวันที่ล่าสุด
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTab("all")
                  setFilterStatus("sold")
                  setSearch("")
                  setStockTableSort("default")
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 shrink-0"
              >
                เปิดในตาราง All Stock
              </button>
            </div>
            {soldHistoryRows.length === 0 ? (
              <p className="text-sm text-gray-400">ยังไม่มีประวัติการตัดขาย</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 max-h-[min(70vh,520px)] overflow-y-auto">
                <table className="w-full min-w-[920px] text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">แหล่ง</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">วันที่</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">สินค้า</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">SN</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">ลูกค้า</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">PO ลูกค้า</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">Warranty</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">จำนวน</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-500">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {soldHistoryRows.slice(0, 200).map((row) =>
                      row.kind === "tx" ? (
                        <tr key={row.tx.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">STATUS_SOLD</span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.tx.date}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.tx.item_name}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{row.tx.serial_number || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{row.tx.customer_org || "—"}</td>
                          <td className="px-3 py-2 font-mono text-gray-700">{row.tx.customer_po || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">—</td>
                          <td className="px-3 py-2 font-mono">{row.tx.qty}</td>
                          <td className="px-3 py-2 text-gray-500">{row.tx.note || "—"}</td>
                        </tr>
                      ) : (
                        <tr key={`m-${row.item.id}`} className="hover:bg-amber-50/50 bg-amber-50/30">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">master</span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.item.sold_at || "—"}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.item.name}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{row.item.serial_number || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{row.item.sold_to_org || "—"}</td>
                          <td className="px-3 py-2 font-mono text-gray-700">{row.item.sold_customer_po || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{row.item.sold_warranty || "—"}</td>
                          <td className="px-3 py-2 font-mono">{row.item.qty}</td>
                          <td className="px-3 py-2 text-amber-800">ไม่พบแถว STATUS_SOLD — ตรวจสอบธุรกรรม</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Loan ────────────────────────────────────────────────────────── */}
      {tab === "loan" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="glass-panel rounded-2xl p-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">แท็บ Loan = ยืม–คืนเท่านั้น: </span>
            <strong>Demo</strong> ยืมออกได้ทันที · สินค้าที่<strong>ไม่ใช่ Demo</strong>ต้อง<strong>ขออนุมัติยืม</strong>แล้วผู้อนุมัติกด
            <strong> อนุมัติการยืม</strong>ก่อนจึงจะกด Loan ได้
            · <strong>Return loan</strong> จาก Quick Action
            · <strong>Booking</strong> →{" "}
            <button type="button" className="text-orange-700 font-bold underline" onClick={() => setTab("booking")}>
              Booking
            </button>
            · <strong>Sold</strong> →{" "}
            <button type="button" className="text-slate-800 font-bold underline" onClick={() => setTab("sold_history")}>
              Sold
            </button>
            · ประวัติ <strong>Module</strong> อยู่แท็บ <strong>All Stock</strong> (ด้านล่างตาราง)
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 p-5 max-w-3xl">
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
                  <div key={item.id} className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {item.loaned_to || "—"} · Due: {item.loan_due || "—"}
                    </p>
                    {item.serial_number && <p className="text-xs font-mono text-blue-700 mt-0.5">SN: {item.serial_number}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickAction(item, "return_loan")}
                        className="px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600"
                      >
                        Return loan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                        <button
                          type="button"
                          onClick={() => setReturnDemoDialog(item)}
                          className="w-full py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600"
                        >
                          บันทึกคืน
                        </button>
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

      {/* ── Tab: ประวัติ Service (คิวที่ Service รับแล้ว + รับเข้าคลังแล้ว) ── */}
      {tab === "service_history" && (
        <div className="flex-1 overflow-y-auto space-y-6">
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900">ตัวกรอง</p>
            <div className="flex flex-wrap gap-3">
              <input
                value={serviceHistorySearch}
                onChange={(e) => setServiceHistorySearch(e.target.value)}
                placeholder="ค้นหา SN / Job / รุ่น / ลูกค้า"
                className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              />
              <select
                value={serviceHistoryJobType}
                onChange={(e) => setServiceHistoryJobType(e.target.value as ServiceJobTypeFilter)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="all">ทุกประเภทงาน</option>
                <option value="repair">Repair</option>
                <option value="calibration">Calibration</option>
                <option value="commissioning">Commissioning Test</option>
              </select>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-orange-600" />
              คิวที่ Service รับแล้ว ({filteredDispatchHistory.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              รายการที่เคยอยู่ใน inbox &quot;รอรับโดย Service&quot; และฝ่าย Service กดรับงานแล้ว
            </p>
            {filteredDispatchHistory.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-2xl">
                ไม่มีรายการตามตัวกรอง
              </p>
            ) : (
              <div className="space-y-2">
                {filteredDispatchHistory.map((h) => (
                  <div
                    key={h.dispatch_id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-gray-500">{h.service_job_no}</p>
                        <p className="text-sm font-bold text-gray-900">{h.model || h.item_name}</p>
                        <p className="text-xs font-mono text-blue-600">SN: {h.serial_number}</p>
                        <p className="text-xs text-gray-600 mt-1">{h.customer_org}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-800 text-[11px] font-bold">
                        {JOB_TYPE_LABELS[h.job_type]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{h.symptom}</p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      ส่งจาก Stock: {formatThDateTime(h.dispatched_at)} · Service รับ: {formatThDateTime(h.accepted_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              รับเข้าคลังแล้ว ({filteredCompletedReturns.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">งานจาก Stock ที่ปิดงานและ Stock ยืนยันรับสินค้าแล้ว</p>
            {filteredCompletedReturns.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-2xl">
                ยังไม่มีรายการรับเข้าคลังตามตัวกรอง
              </p>
            ) : (
              <div className="space-y-2">
                {filteredCompletedReturns.map((j) => (
                  <div key={j.id} className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-gray-500">{j.job_no}</p>
                        <p className="text-sm font-bold text-gray-900">{j.model}</p>
                        <p className="text-xs font-mono text-blue-600">SN: {j.serial_number}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        {JOB_TYPE_LABELS[j.job_type]}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-2 font-semibold">
                      รับเข้าคลัง: {j.stock_return_received_at ? formatThDateTime(j.stock_return_received_at) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-0.5 flex items-center gap-2">
              <Send className="h-4 w-4 text-slate-600" />
              Stock outbound trace log
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              ประวัติเมื่อ Stock ยืนยันจากวิดเจ็ตด้านบน — รหัสเหตุการณ์ภาษาอังกฤษ{" "}
              <span className="font-mono">OUTBOUND_TRACE_COMPLETED</span> /{" "}
              <span className="font-mono">OUTBOUND_TRACE_CANCELLED</span> แยกจาก workstream (
              Repair / Calibration / Commissioning)
            </p>
            {filteredOutboundTraceLog.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-2xl">
                ไม่มีรายการตามตัวกรอง
              </p>
            ) : (
              <div className="space-y-2">
                {filteredOutboundTraceLog.map((e) => (
                  <div key={e.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-mono text-violet-700 font-bold">{e.close_kind}</p>
                        <p className="text-xs font-mono text-gray-500">{e.service_job_no}</p>
                        <p className="text-sm font-bold text-gray-900">{e.model}</p>
                        <p className="text-xs font-mono text-blue-600">SN: {e.serial_number}</p>
                        <p className="text-xs text-gray-600 mt-1">{e.customer_org}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold">
                          {OUTBOUND_TRACE_CLOSE_LABELS[e.close_kind]}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-800 text-[10px] font-semibold">
                          workstream: {JOB_TYPE_LABELS[e.workstream_job_type]}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {formatThDateTime(e.recorded_at)} · Service status at action: {e.service_status_at_action}
                    </p>
                    {e.cancellation_reason && (
                      <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5 mt-2">
                        Reason: {e.cancellation_reason}
                      </p>
                    )}
                    {e.cancellation_action_plan && (
                      <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-2 py-1.5 mt-1">
                        Action plan: {e.cancellation_action_plan}
                      </p>
                    )}
                    {e.completion_note && (
                      <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5 mt-2">Note: {e.completion_note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {traceActionDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setTraceActionDialog(null)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 z-[61]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">
                {traceActionDialog.mode === "cancel" ? "ยืนยันยกเลิกการติดตาม" : "ยืนยันงานเสร็จ"}
              </h3>
              <button
                type="button"
                onClick={() => setTraceActionDialog(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 mb-4 text-sm">
              <p className="font-mono text-xs text-gray-500">{traceActionDialog.job.job_no}</p>
              <p className="font-semibold text-gray-900">{traceActionDialog.job.model}</p>
              <p className="text-xs text-gray-600">{traceActionDialog.job.customer_org}</p>
            </div>
            {traceActionDialog.mode === "cancel" ? (
              <>
                <p className="text-xs text-gray-600 mb-3">
                  ยกเลิกจะปิดงานใน Service (สถานะยกเลิก) และย้ายออกจากวิดเจ็ต — บันทึกเป็น{" "}
                  <span className="font-mono text-[11px]">OUTBOUND_TRACE_CANCELLED</span>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล *</label>
                <textarea
                  value={traceCancelReason}
                  onChange={(e) => setTraceCancelReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-3"
                  placeholder="เหตุผลการยกเลิก"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Plan *</label>
                <textarea
                  value={traceCancelActionPlan}
                  onChange={(e) => setTraceCancelActionPlan(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  placeholder="แผนแก้ไข / ขั้นตอนถัดไป"
                />
                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => setTraceActionDialog(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    disabled={!traceCancelReason.trim() || !traceCancelActionPlan.trim()}
                    onClick={confirmOutboundTraceCancel}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:bg-gray-300 hover:bg-red-600"
                  >
                    ยืนยันยกเลิก
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-600 mb-3">
                  ยืนยันแล้วรายการจะหายจาก &quot;กำลังดำเนินการ&quot; และบันทึกเป็น{" "}
                  <span className="font-mono text-[11px]">OUTBOUND_TRACE_COMPLETED</span>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
                <textarea
                  value={traceCompleteNote}
                  onChange={(e) => setTraceCompleteNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-3"
                  placeholder="เช่น ส่งมอบ Sales แล้ว"
                />
                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={traceCompleteConfirmChecked}
                    onChange={(e) => setTraceCompleteConfirmChecked(e.target.checked)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <span>ยืนยันว่างานเสร็จสมบูรณ์และนำออกจากรายการติดตาม</span>
                </label>
                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => setTraceActionDialog(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    disabled={!traceCompleteConfirmChecked}
                    onClick={confirmOutboundTraceComplete}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold disabled:bg-gray-300 hover:bg-blue-600"
                  >
                    ยืนยันงานเสร็จ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {dispatchDialog && (
        <DispatchDialog
          key={dispatchDialog.id}
          item={dispatchDialog}
          onClose={() => setDispatchDialog(null)}
          onConfirm={handleDispatch}
        />
      )}
      {addDialog.open && (
        <AddItemDialog
          key={addDialog.data?.id ?? "new-item"}
          item={addDialog.data}
          onClose={() => setAddDialog({ open: false, data: null })}
          onSave={saveItem}
        />
      )}
      {receiveProductDialog && (
        <ReceiveProductDialog
          todayISO={today}
          existingItems={items}
          onClose={() => setReceiveProductDialog(false)}
          onApply={addTransaction}
        />
      )}
      {sellStockItem && (
        <SellStockDialog
          item={sellStockItem}
          onClose={() => setSellStockItem(null)}
          onConfirm={(payload) => confirmSellStock(sellStockItem, payload)}
        />
      )}
      {calibrationUpdateItem && (
        <CalibrationUpdateDialog
          item={calibrationUpdateItem}
          onClose={() => setCalibrationUpdateItem(null)}
          onConfirm={(lastCalDate) => updateCalibrationForItem(calibrationUpdateItem, lastCalDate)}
        />
      )}
      {bookingDialog && (
        <AddBookingDialog
          items={items}
          existingBookings={bookings}
          prefillItemId={bookingPrefillItemId}
          onClose={() => {
            setBookingDialog(false)
            setBookingPrefillItemId(null)
          }}
          onSave={addBooking}
        />
      )}
      {returnDemoDialog && (
        <ReturnDemoDialog
          item={returnDemoDialog}
          todayISO={today}
          onClose={() => setReturnDemoDialog(null)}
          onConfirm={(loanDate) => handleReturnDemoConfirmed(returnDemoDialog, loanDate)}
        />
      )}
      {loanRequestItem && (
        <LoanRequestApprovalDialog
          item={loanRequestItem}
          onClose={() => setLoanRequestItem(null)}
          onConfirm={(note) => submitLoanApprovalRequest(loanRequestItem, note)}
        />
      )}
      {loanDialog && (
        <LoanDialog
          item={loanDialog}
          todayISO={today}
          priorApprovalRequired={!isLoanDemoCategory(loanDialog)}
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
