import { newId } from "@/lib/new-id"

export interface ASContact {
  id: string
  name: string
  position: string
  email: string
  tel: string
  is_primary: boolean
}

export interface ASOrganization {
  id: string
  name: string
  org_type: string
  org_format: string
  province: string
  region: string
  health_district: number
  one_qa: boolean
  contacts: ASContact[]
  created_at: string
}

export type ASJobType = "repair" | "preventive_maintenance" | "calibration" | "commissioning"
export type ASJobStatus =
  | "รอประเมิน"
  | "กำลังประเมิน"
  | "รอ Quotation Approve"
  | "รอ PO"
  | "ในคิว"
  | "กำลังซ่อม"
  | "รออะไหล่"
  | "QC"
  | "รอส่งคืน"
  | "ปิดงาน"
  | "ยกเลิก"

export type ASPriority = "urgent" | "high" | "normal"

export interface ASServiceJob {
  id: string
  job_no: string
  job_type: ASJobType
  status: ASJobStatus
  priority: ASPriority
  serial_number: string
  manufacturer: string
  model: string
  received_date: string
  tracking_in: string
  receive_channel: "พนักงาน" | "ขนส่งเอกชน"
  received_by?: string
  customer_name: string
  customer_org: string
  routing: "in_country" | "overseas"
  rma_code?: string
  lab_name?: string
  symptom_reported: string
  symptom_actual?: string
  fix_method?: string
  requires_approval: boolean
  quotation_approved?: boolean
  po_number?: string
  tracking_out?: string
  invoice_no?: string
  warranty_days?: string
  technician?: string
  assigned_engineer?: string
  fsm_state?: "DRAFT" | "ISSUED" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "CLOSED" | "ESCALATED"
  service_log?: {
    technician_name?: string
    service_date?: string
    findings?: string
    parts_replaced?: string
    test_result?: "PASS" | "FAIL"
    next_service_due_date?: string
  }
  calibration_date?: string
  due_date?: string
  /** SN ของ Oxygen Sensor หลังเปลี่ยน (งาน VT Calibration) — กรอกเมื่อมีการเปลี่ยน */
  oxygen_sensor_serial?: string
  /**
   * งาน Calibration กลุ่ม VT — เลือกชัดว่าเปลี่ยนหรือไม่เปลี่ยน Oxygen Sensor (FSM ใช้ค่านี้ก่อน; ถ้าไม่มีจะไล่จากข้อความเดิม)
   */
  vt_oxygen_sensor_action?: "replaced" | "no_change"
  /** แถวสต๊อกที่เลือกตัดจ่ายตอนเปลี่ยน O₂ (mock `as_stock_items.id`) */
  vt_oxygen_stock_item_id?: string
  source?: "manual" | "stock" | "se" | "proactive"
  source_dispatch_id?: string
  /** ลิงก์รายการใน Stock ตอนส่งออกจากคลัง (ใช้ตอนรับกลับ) */
  stock_item_id?: string
  /** งานจาก Stock ปิดโดย Service แล้ว แต่รอ Stock กดรับเข้าคลังเพื่อพร้อมจำหน่าย */
  stock_return_pending?: boolean
  stock_return_received_at?: string
  cancellation_reason?: string
  /** แผนแก้ไข/Action Plan เมื่อยกเลิกงาน (บังคับกรอก) */
  cancellation_action_plan?: string
  /** Stock นำออกจากวิดเจ็ต "กำลังดำเนินการ" แล้ว (ยกเลิก / งานเสร็จ) — บันทึกใน outbound trace log */
  stock_outbound_trace_archived?: boolean
  stock_outbound_trace_archived_at?: string
  status_logs?: {
    at: string
    from?: ASJobStatus
    to: ASJobStatus
    reason?: string
  }[]
  created_at: string
}

export interface ASStockDispatch {
  id: string
  item_name: string
  manufacturer?: string
  model?: string
  serial_number: string
  customer_org: string
  customer_contact: string
  symptom: string
  receive_channel?: "พนักงาน" | "ขนส่งเอกชน"
  tracking_in?: string
  received_by?: string
  job_type: ASJobType
  routing?: "in_country" | "overseas"
  // For calibration alerts in Service Monitor
  due_date?: string
  dispatched_by: string
  dispatched_at: string
  /** รหัสรายการใน Stock (mock) — ใช้จับคู่ตอนรับเครื่องกลับ */
  stock_item_id?: string
}

/** คิวส่ง Service ที่ฝ่าย Service กดรับแล้ว — เก็บประวัติฝั่ง Stock */
export interface ASStockDispatchHistoryEntry {
  dispatch_id: string
  stock_item_id?: string
  item_name: string
  manufacturer?: string
  model?: string
  serial_number: string
  customer_org: string
  customer_contact: string
  symptom: string
  receive_channel?: "พนักงาน" | "ขนส่งเอกชน"
  tracking_in?: string
  received_by?: string
  job_type: ASJobType
  routing?: "in_country" | "overseas"
  due_date?: string
  dispatched_by: string
  dispatched_at: string
  accepted_at: string
  service_job_id: string
  service_job_no: string
}

/**
 * การปิดการติดตามงานส่ง Service ฝั่ง Stock — ใช้ close_kind ภาษาอังกฤษแยกจาก job_type (repair/calibration/commissioning)
 */
export type ASStockOutboundTraceCloseKind = "OUTBOUND_TRACE_COMPLETED" | "OUTBOUND_TRACE_CANCELLED"

export interface ASStockOutboundTraceLogEntry {
  id: string
  close_kind: ASStockOutboundTraceCloseKind
  recorded_at: string
  service_job_id: string
  service_job_no: string
  /** ประเภทงาน Service (metadata) — ไม่สับสนกับ close_kind */
  workstream_job_type: ASJobType
  serial_number: string
  model: string
  customer_org: string
  service_status_at_action: ASJobStatus
  cancellation_reason?: string
  cancellation_action_plan?: string
  completion_note?: string
}

export interface ASLoanReturnHistory {
  id: string
  customer_org: string
  equipment_name?: string
  loan_date: string
  due_date: string
  returned_at: string
  overdue_days: number
  // e.g. "demo_return", "receive_return"
  source: string
  created_at: string
}

export interface ASRepairToCalRequest {
  id: string
  source_job_id: string
  source_job_no: string
  serial_number: string
  manufacturer: string
  model: string
  customer_org: string
  customer_name: string
  routing: "in_country" | "overseas"
  priority: ASPriority
  symptom_reported: string
  requested_at: string
  created_at: string
}

export interface ASIncomingSERequest {
  id: string
  customer_org: string
  equipment: string
  issue_description: string
  requested_by: string
  requested_at: string
  priority: ASPriority
}

export interface ASPartsRequest {
  id: string
  job_id: string
  job_no: string
  serial_number: string
  model: string
  customer_org: string
  requested_by: string
  part_name: string
  qty: number
  note?: string
  requested_at: string
  status: "pending" | "approved" | "rejected" | "fulfilled"
  approved_at?: string
  fulfilled_at?: string
  rejected_at?: string
}

export interface ASStockNotification {
  id: string
  kind: "job_status_changed" | "parts_requested" | "job_escalated" | "job_failed_commissioning"
  job_id: string
  job_no: string
  title: string
  message: string
  created_at: string
  read_at?: string
}

export interface ASEquipmentHistoryEntry {
  id: string
  serial_number: string
  model: string
  customer_org: string
  job_id: string
  job_no: string
  event_kind:
    | "job_created"
    | "status_changed"
    | "parts_requested"
    | "job_cancelled"
    | "job_escalated"
    | "commissioning_failed"
  status?: ASJobStatus
  message: string
  created_at: string
}

export interface ASOxygenSensorHistoryEntry {
  id: string
  job_id: string
  job_no: string
  serial_number: string
  /** SN ของ Oxygen Sensor ที่บันทึกตอน Service (ถ้ามี) */
  oxygen_sensor_serial?: string
  model: string
  job_type: ASJobType
  changed: boolean
  note: string
  stock_item_id?: string
  stock_item_name?: string
  stock_qty_before?: number
  stock_qty_after?: number
  created_at: string
}

export interface ASProactiveCalibrationAsset {
  id: string
  customer_org: string
  customer_name?: string
  manufacturer: string
  model: string
  serial_number: string
  last_calibration_date?: string
  due_date: string
  note?: string
  retired_at?: string
  retired_reason?: string
  created_at: string
}

export interface ASDropdownConfig {
  stock_models: string[]
  stock_manufacturers: string[]
  calibration_labs: string[]
  service_technicians: string[]
}

export interface ASStockSnapshotItem {
  id: string
  name: string
  brand: string
  model?: string
  qty: number
  status: string
  category: string
  unit: string
  serial_number?: string
  stocked_at?: string
}

export interface ASModuleAssignment {
  id: string
  module_serial: string
  from_parent_serial?: string
  to_parent_serial?: string
  event: "received_link" | "reassigned" | "separated" | "sold"
  note?: string
  created_at: string
}

export interface GlobalSettings {
  app_name: string
  default_currency: string
}

export interface KPISettingEntry {
  id: string
  module: "sales" | "repair" | "calibration" | "stock" | "other"
  kpi_name: string
  formula: string
  target: string
  reset_cycle: "monthly" | "quarterly" | "per_deal" | "per_job" | "per_transaction" | "custom"
}

export interface KPISettings {
  items: KPISettingEntry[]
}

export interface SESettings {
  se_customers: string[]
  se_owners: string[]
}

export interface ProductCatalogGroup {
  code: string
  label: string
  manufacturer: string
  models: string[]
}

export interface ASWorkflowSettings {
  service_statuses: ASJobStatus[]
  calibration_statuses: ASJobStatus[]
}

/** localStorage keys — exported for cross-tab sync / init without write side-effects */
export const AS_STORE_KEYS = {
  jobs: "as_service_jobs",
  orgs: "as_organizations",
  stockDispatches: "as_stock_dispatches",
  stockDispatchHistory: "as_stock_dispatch_history",
  stockOutboundTraceLog: "as_stock_outbound_trace_log",
  loanReturns: "as_loan_return_history",
  repairToCalRequests: "as_repair_to_cal_requests",
  proactiveCalibrationAssets: "as_proactive_calibration_assets",
  dropdownConfig: "as_dropdown_config",
  stockItems: "as_stock_items",
  /** Stock page ledger rows (matches UI `StockTransaction`) */
  stockTransactions: "as_stock_transactions",
  /** Stock page booking rows (matches UI `Booking`) */
  stockBookings: "as_stock_bookings",
  /** Optimistic concurrency for stock snapshot (integer string) */
  stockItemsVersion: "as_stock_items_version",
  globalSettings: "global_settings",
  kpiSettings: "kpi_settings",
  seSettings: "se_settings",
  productCatalog: "product_catalog",
  moduleAssignments: "as_module_assignments",
  asWorkflowSettings: "as_workflow_settings",
  seIncomingRequests: "as_se_incoming_requests",
  partsRequests: "as_parts_requests",
  stockNotifications: "as_stock_notifications",
  equipmentHistory: "as_equipment_history",
  oxygenSensorHistory: "as_oxygen_sensor_history",
  /** Optimistic concurrency counter for `as_service_jobs` (multi-tab mock) */
  jobsVersion: "as_service_jobs_version",
} as const

const KEYS = AS_STORE_KEYS

export const DEFAULT_AS_DROPDOWN_CONFIG: ASDropdownConfig = {
  stock_models: [
    "ProSim 8",
    "ProSim 4",
    "RaySafe X2 Solo",
    "ESA 615",
    "IDA6 Infusion Module",
  ],
  stock_manufacturers: [
    "Fluke Biomedical",
    "RaySafe",
    "TreatMed",
  ],
  calibration_labs: ["NIMT", "TNI", "มจธ."],
  service_technicians: ["ช่างสมชาย", "ช่างวิทยา"],
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  app_name: "TreatMed OS",
  default_currency: "THB",
}

export const DEFAULT_KPI_SETTINGS: KPISettings = {
  items: [
    { id: "kpi-sales-win-rate", module: "sales", kpi_name: "Win Rate", formula: "Closed Won / Total Deals × 100", target: ">= 40%", reset_cycle: "monthly" },
    { id: "kpi-sales-forecast-accuracy", module: "sales", kpi_name: "Forecast Accuracy", formula: "Actual Revenue / Forecasted × 100", target: ">= 85%", reset_cycle: "monthly" },
    { id: "kpi-sales-deal-cycle-time", module: "sales", kpi_name: "Deal Cycle Time", formula: "Closed Date - Start Date (days)", target: "<= 90 days", reset_cycle: "per_deal" },
    { id: "kpi-repair-tat", module: "repair", kpi_name: "TAT", formula: "วันที่เสร็จ - วันที่รับเครื่อง", target: "<= 14 วัน", reset_cycle: "per_job" },
    { id: "kpi-repair-first-time-fix-rate", module: "repair", kpi_name: "First-time Fix Rate", formula: "แก้สำเร็จครั้งเดียว / ทั้งหมด × 100", target: ">= 80%", reset_cycle: "monthly" },
    { id: "kpi-calibration-on-time-cal-rate", module: "calibration", kpi_name: "On-time Cal Rate", formula: "ส่ง cert ตรงเวลา / ทั้งหมด × 100", target: ">= 95%", reset_cycle: "monthly" },
    { id: "kpi-calibration-proactive-conversion", module: "calibration", kpi_name: "Proactive Cal Conversion", formula: "เครื่องที่แจ้งเตือนแล้ว cal จริง / ทั้งหมด × 100", target: ">= 60%", reset_cycle: "quarterly" },
    { id: "kpi-stock-inventory-accuracy", module: "stock", kpi_name: "Inventory Accuracy", formula: "รายการที่ตรงจริง / ทั้งหมด × 100", target: ">= 98%", reset_cycle: "monthly" },
    { id: "kpi-stock-avg-receiving-time", module: "stock", kpi_name: "Avg. Receiving Time", formula: "เวลาเฉลี่ยรับเครื่องเข้าระบบ (ชม.)", target: "<= 4 ชม.", reset_cycle: "per_transaction" },
    { id: "kpi-stock-avg-receiving-time-private-logistics", module: "stock", kpi_name: "Avg. Receiving Time (ขนส่งเอกชน)", formula: "เวลาเฉลี่ยรับเครื่องเข้าระบบเมื่อ receive_channel = ขนส่งเอกชน (ชม.)", target: "<= 4 ชม.", reset_cycle: "per_transaction" },
    { id: "kpi-stock-avg-receiving-time-staff", module: "stock", kpi_name: "Avg. Receiving Time (พนักงานรับเอง)", formula: "เวลาเฉลี่ยรับเครื่องเข้าระบบเมื่อ receive_channel = พนักงาน (ชม.)", target: "<= 2 ชม.", reset_cycle: "per_transaction" },
  ],
}

export const DEFAULT_SE_SETTINGS: SESettings = {
  se_customers: [
    "โรงพยาบาลกรุงเทพ",
    "โรงพยาบาลรามาธิบดี",
    "โรงพยาบาลศิริราช",
    "โรงพยาบาลสมิติเวช",
    "โรงพยาบาลมหาราชนครเชียงใหม่",
    "คลินิกสุขภาพดี",
  ],
  se_owners: ["คุณอนันต์", "คุณนภา", "คุณรัตนา"],
}

export const DEFAULT_PRODUCT_CATALOG: ProductCatalogGroup[] = [
  {
    code: "FBC",
    label: "Fluke Biomedical (FBC)",
    manufacturer: "Fluke Biomedical",
    models: [
      "ESA609", "ESA612", "ESA615", "ESA620", "ESA712", "ESA715",
      "IMP6K", "IMP7K", "IMP7010",
      "DPM2Plus", "QAES III", "VT650", "VT900A", "VAPOR",
      "IDA1s", "IDA6-1ch", "IDA6-2ch", "IDA6-3ch", "IDA6-4ch",
      "ProSim2", "ProSim3", "ProSim4", "ProSim4 + SPOTLIGHT", "ProSim8", "ProSim8P",
      "SPOT Module", "SPOTLight", "PS320", "PS410", "MFH-1",
      "ProSim8 + SPOT Module", "ProSim8P + SPOT Module", "ProSim8 + SPOTLight", "ProSim8P + SPOTLight",
      "Acculung II", "INCU II", "INDEX II",
    ],
  },
  {
    code: "RAYS",
    label: "RaySafe",
    manufacturer: "RaySafe",
    models: [
      "X2", "X2 Solo", "452 Full kit", "452 Ambient", "451B", "451P", "Pro-Digi",
      "R/F Sensor", "Volt Sensor", "MAM Sensor", "Light Sensor", "CT Sensor", "Survey Sensor",
      "Thin X RAD", "Thin X Intra", "DXR+",
      "i3", "i3 Dosimeter",
    ],
  },
  {
    code: "OTH",
    label: "Others",
    manufacturer: "Other",
    models: ["87V", "GL260", "SmartLung Adult 1", "DFG-RS5", "440", "O2+AE"],
  },
]

export const DEFAULT_AS_WORKFLOW_SETTINGS: ASWorkflowSettings = {
  service_statuses: [
    "รอประเมิน",
    "กำลังประเมิน",
    "รอ Quotation Approve",
    "รอ PO",
    "ในคิว",
    "กำลังซ่อม",
    "รออะไหล่",
    "QC",
    "รอส่งคืน",
    "ปิดงาน",
    "ยกเลิก",
  ],
  calibration_statuses: [
    "รอประเมิน",
    "กำลังประเมิน",
    "ในคิว",
    "QC",
    "รอส่งคืน",
    "ปิดงาน",
    "ยกเลิก",
  ],
}

function hasWindow() {
  return typeof window !== "undefined"
}

/** Read JSON from localStorage without initializing missing keys (for cross-tab sync). */
export function tryReadJSON<T>(key: string): T | null {
  if (!hasWindow()) return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Compare-and-swap write: only writes if stored version equals `expectedVersion`.
 * Bump `stockItemsVersion` on success. Use to reduce lost updates across tabs (mock phase).
 */
export function writeStockItemsWithVersion<T extends { id: string }>(
  items: T[],
  expectedVersion: number | null,
): { ok: boolean; nextVersion: number } {
  if (!hasWindow()) return { ok: false, nextVersion: expectedVersion ?? 0 }
  const verRaw = window.localStorage.getItem(KEYS.stockItemsVersion)
  const currentVer = verRaw ? parseInt(verRaw, 10) : 0
  const safeVer = Number.isFinite(currentVer) ? currentVer : 0
  if (expectedVersion !== null && safeVer !== expectedVersion) {
    return { ok: false, nextVersion: safeVer }
  }
  const nextVer = safeVer + 1
  window.localStorage.setItem(KEYS.stockItems, JSON.stringify(items))
  window.localStorage.setItem(KEYS.stockItemsVersion, String(nextVer))
  window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key: KEYS.stockItems } }))
  return { ok: true, nextVersion: nextVer }
}

export function readStockItemsVersion(): number {
  if (!hasWindow()) return 0
  const verRaw = window.localStorage.getItem(KEYS.stockItemsVersion)
  const n = verRaw ? parseInt(verRaw, 10) : 0
  return Number.isFinite(n) ? n : 0
}

export function readStore<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    window.localStorage.setItem(key, JSON.stringify(fallback))
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    // Self-heal corrupted payload to prevent repeated parse failures.
    window.localStorage.setItem(key, JSON.stringify(fallback))
    window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key } }))
    return fallback
  }
}

export function writeStore<T>(key: string, value: T): boolean {
  if (!hasWindow()) return false
  const nextRaw = JSON.stringify(value)
  const prevRaw = window.localStorage.getItem(key)
  if (prevRaw === nextRaw) return false
  window.localStorage.setItem(key, nextRaw)
  window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key } }))
  return true
}

export function readJobs(fallback: ASServiceJob[]) {
  return readStore<ASServiceJob[]>(KEYS.jobs, fallback)
}

export function readJobsVersion(): number {
  if (!hasWindow()) return 0
  const n = parseInt(window.localStorage.getItem(KEYS.jobsVersion) || "0", 10)
  return Number.isFinite(n) ? n : 0
}

/** Every jobs write bumps version (for cross-tab detection). */
export function writeJobs(value: ASServiceJob[]) {
  if (!hasWindow()) return
  const v = readJobsVersion()
  const changed = writeStore(KEYS.jobs, value)
  if (!changed) return
  window.localStorage.setItem(KEYS.jobsVersion, String(v + 1))
}

/**
 * Write jobs only if `as_service_jobs_version` still equals `expectedVersion`.
 * Call sites: Stock page mutations that must not silently overwrite another tab.
 */
export function writeJobsWithConcurrencyCheck(
  jobs: ASServiceJob[],
  expectedVersion: number,
): { ok: boolean; nextVersion: number } {
  if (!hasWindow()) return { ok: false, nextVersion: expectedVersion }
  const cur = readJobsVersion()
  if (cur !== expectedVersion) return { ok: false, nextVersion: cur }
  const changed = writeStore(KEYS.jobs, jobs)
  if (!changed) return { ok: true, nextVersion: cur }
  const next = cur + 1
  window.localStorage.setItem(KEYS.jobsVersion, String(next))
  return { ok: true, nextVersion: next }
}

export function readOrganizations(fallback: ASOrganization[]) {
  return readStore<ASOrganization[]>(KEYS.orgs, fallback)
}

export function writeOrganizations(value: ASOrganization[]) {
  writeStore(KEYS.orgs, value)
}

/** Synthetic org names from Stock / proactive / commissioning (`customer_org`). Keep in store for jobs; hide on ทะเบียนลูกค้า. */
export function isInternalStockCustomerOrgName(name: string): boolean {
  return name.trim().startsWith("Stock —")
}

export function readStockDispatches(fallback: ASStockDispatch[]) {
  return readStore<ASStockDispatch[]>(KEYS.stockDispatches, fallback)
}

export function writeStockDispatches(value: ASStockDispatch[]) {
  writeStore(KEYS.stockDispatches, value)
}

export function appendStockDispatch(dispatch: ASStockDispatch) {
  const current = readStockDispatches([])
  const duplicate = current.some(
    (d) =>
      d.job_type === dispatch.job_type &&
      d.serial_number === dispatch.serial_number &&
      (d.stock_item_id || "") === (dispatch.stock_item_id || "") &&
      d.customer_org.trim().toLowerCase() === dispatch.customer_org.trim().toLowerCase() &&
      d.symptom.trim().toLowerCase() === dispatch.symptom.trim().toLowerCase(),
  )
  if (duplicate) return
  let next = dispatch
  if (current.some((d) => d.id === next.id)) {
    next = { ...dispatch, id: newId("sd") }
  }
  writeStockDispatches([next, ...current])
}

export function readStockDispatchHistory(fallback: ASStockDispatchHistoryEntry[]) {
  return readStore<ASStockDispatchHistoryEntry[]>(KEYS.stockDispatchHistory, fallback)
}

export function writeStockDispatchHistory(value: ASStockDispatchHistoryEntry[]) {
  writeStore(KEYS.stockDispatchHistory, value)
}

export function appendStockDispatchHistory(entry: ASStockDispatchHistoryEntry) {
  const current = readStockDispatchHistory([])
  if (current.some((e) => e.dispatch_id === entry.dispatch_id)) return
  writeStockDispatchHistory([entry, ...current])
}

export function readStockOutboundTraceLog(fallback: ASStockOutboundTraceLogEntry[]) {
  return readStore<ASStockOutboundTraceLogEntry[]>(KEYS.stockOutboundTraceLog, fallback)
}

export function writeStockOutboundTraceLog(value: ASStockOutboundTraceLogEntry[]) {
  writeStore(KEYS.stockOutboundTraceLog, value)
}

export function appendStockOutboundTraceLog(entry: ASStockOutboundTraceLogEntry) {
  const current = readStockOutboundTraceLog([])
  if (current.some((e) => e.id === entry.id)) return
  writeStockOutboundTraceLog([entry, ...current])
}

export function readLoanReturnHistory(fallback: ASLoanReturnHistory[]) {
  return readStore<ASLoanReturnHistory[]>(KEYS.loanReturns, fallback)
}

export function writeLoanReturnHistory(value: ASLoanReturnHistory[]) {
  writeStore(KEYS.loanReturns, value)
}

export function appendLoanReturnHistory(record: ASLoanReturnHistory) {
  const current = readLoanReturnHistory([])
  writeLoanReturnHistory([record, ...current])
}

export function readRepairToCalRequests(fallback: ASRepairToCalRequest[]) {
  return readStore<ASRepairToCalRequest[]>(KEYS.repairToCalRequests, fallback)
}

export function writeRepairToCalRequests(value: ASRepairToCalRequest[]) {
  writeStore(KEYS.repairToCalRequests, value)
}

export function appendRepairToCalRequest(req: ASRepairToCalRequest) {
  const current = readRepairToCalRequests([])
  writeRepairToCalRequests([req, ...current])
}

export function removeRepairToCalRequest(id: string) {
  const current = readRepairToCalRequests([])
  writeRepairToCalRequests(current.filter((r) => r.id !== id))
}

export function readIncomingSERequests(fallback: ASIncomingSERequest[]) {
  return readStore<ASIncomingSERequest[]>(KEYS.seIncomingRequests, fallback)
}

export function writeIncomingSERequests(value: ASIncomingSERequest[]) {
  writeStore(KEYS.seIncomingRequests, value)
}

export function appendIncomingSERequest(req: ASIncomingSERequest) {
  const current = readIncomingSERequests([])
  writeIncomingSERequests([req, ...current])
}

export function removeIncomingSERequest(id: string) {
  const current = readIncomingSERequests([])
  writeIncomingSERequests(current.filter((r) => r.id !== id))
}

export function readPartsRequests(fallback: ASPartsRequest[]) {
  return readStore<ASPartsRequest[]>(KEYS.partsRequests, fallback)
}

export function writePartsRequests(value: ASPartsRequest[]) {
  writeStore(KEYS.partsRequests, value)
}

export function appendPartsRequest(req: ASPartsRequest) {
  const current = readPartsRequests([])
  if (current.some((r) => r.id === req.id)) return
  writePartsRequests([req, ...current])
}

export function updatePartsRequestStatus(
  id: string,
  status: ASPartsRequest["status"],
): boolean {
  const current = readPartsRequests([])
  const now = new Date().toISOString()
  let changed = false
  const next = current.map((r) => {
    if (r.id !== id) return r
    changed = true
    if (status === "approved") {
      return { ...r, status, approved_at: r.approved_at || now }
    }
    if (status === "fulfilled") {
      return { ...r, status, fulfilled_at: r.fulfilled_at || now }
    }
    if (status === "rejected") {
      return { ...r, status, rejected_at: r.rejected_at || now }
    }
    return { ...r, status }
  })
  if (!changed) return false
  writePartsRequests(next)
  return true
}

export function readStockNotifications(fallback: ASStockNotification[]) {
  return readStore<ASStockNotification[]>(KEYS.stockNotifications, fallback)
}

export function writeStockNotifications(value: ASStockNotification[]) {
  writeStore(KEYS.stockNotifications, value)
}

export function appendStockNotification(item: ASStockNotification) {
  const current = readStockNotifications([])
  if (current.some((n) => n.id === item.id)) return
  writeStockNotifications([item, ...current])
}

export function markStockNotificationRead(id: string, at: string = new Date().toISOString()): boolean {
  const current = readStockNotifications([])
  let changed = false
  const next = current.map((n) => {
    if (n.id !== id || n.read_at) return n
    changed = true
    return { ...n, read_at: at }
  })
  if (!changed) return false
  writeStockNotifications(next)
  return true
}

export function readEquipmentHistory(fallback: ASEquipmentHistoryEntry[]) {
  return readStore<ASEquipmentHistoryEntry[]>(KEYS.equipmentHistory, fallback)
}

export function writeEquipmentHistory(value: ASEquipmentHistoryEntry[]) {
  writeStore(KEYS.equipmentHistory, value)
}

export function appendEquipmentHistory(entry: ASEquipmentHistoryEntry) {
  const current = readEquipmentHistory([])
  if (current.some((e) => e.id === entry.id)) return
  writeEquipmentHistory([entry, ...current])
}

export function readOxygenSensorHistory(fallback: ASOxygenSensorHistoryEntry[]) {
  return readStore<ASOxygenSensorHistoryEntry[]>(KEYS.oxygenSensorHistory, fallback)
}

export function writeOxygenSensorHistory(value: ASOxygenSensorHistoryEntry[]) {
  writeStore(KEYS.oxygenSensorHistory, value)
}

export function appendOxygenSensorHistory(entry: ASOxygenSensorHistoryEntry) {
  const current = readOxygenSensorHistory([])
  if (current.some((e) => e.id === entry.id)) return
  writeOxygenSensorHistory([entry, ...current])
}

export function readProactiveCalibrationAssets(fallback: ASProactiveCalibrationAsset[]) {
  return readStore<ASProactiveCalibrationAsset[]>(KEYS.proactiveCalibrationAssets, fallback)
}

export function writeProactiveCalibrationAssets(value: ASProactiveCalibrationAsset[]) {
  writeStore(KEYS.proactiveCalibrationAssets, value)
}

export function readDropdownConfig(fallback: ASDropdownConfig = DEFAULT_AS_DROPDOWN_CONFIG) {
  const value = readStore<Partial<ASDropdownConfig>>(KEYS.dropdownConfig, fallback)
  return {
    stock_models: Array.isArray(value.stock_models) ? value.stock_models : fallback.stock_models,
    stock_manufacturers: Array.isArray(value.stock_manufacturers) ? value.stock_manufacturers : fallback.stock_manufacturers,
    calibration_labs: Array.isArray(value.calibration_labs) ? value.calibration_labs : fallback.calibration_labs,
    service_technicians: Array.isArray(value.service_technicians) ? value.service_technicians : fallback.service_technicians,
  }
}

export function writeDropdownConfig(value: ASDropdownConfig) {
  writeStore(KEYS.dropdownConfig, value)
}

export function readStockItems(fallback: ASStockSnapshotItem[]) {
  return readStore<ASStockSnapshotItem[]>(KEYS.stockItems, fallback)
}

export function writeStockItems(value: ASStockSnapshotItem[]) {
  writeStore(KEYS.stockItems, value)
}

/** Persist Stock page transaction ledger (full JSON shape from UI). */
export function readStockTransactionsLedger<T = unknown[]>(fallback: T): T {
  return readStore<T>(KEYS.stockTransactions, fallback)
}

export function writeStockTransactionsLedger<T>(value: T) {
  writeStore(KEYS.stockTransactions, value)
}

export function readStockBookingsLedger<T = unknown[]>(fallback: T): T {
  return readStore<T>(KEYS.stockBookings, fallback)
}

export function writeStockBookingsLedger<T>(value: T) {
  writeStore(KEYS.stockBookings, value)
}

export function readGlobalSettings(fallback: GlobalSettings = DEFAULT_GLOBAL_SETTINGS) {
  return readStore<GlobalSettings>(KEYS.globalSettings, fallback)
}

export function writeGlobalSettings(value: GlobalSettings) {
  writeStore(KEYS.globalSettings, value)
}

export function readKPISettings(fallback: KPISettings = DEFAULT_KPI_SETTINGS) {
  return readStore<KPISettings>(KEYS.kpiSettings, fallback)
}

export function writeKPISettings(value: KPISettings) {
  writeStore(KEYS.kpiSettings, value)
}

export function readSESettings(fallback: SESettings = DEFAULT_SE_SETTINGS) {
  return readStore<SESettings>(KEYS.seSettings, fallback)
}

export function writeSESettings(value: SESettings) {
  writeStore(KEYS.seSettings, value)
}

export function readProductCatalog(fallback: ProductCatalogGroup[] = DEFAULT_PRODUCT_CATALOG) {
  return readStore<ProductCatalogGroup[]>(KEYS.productCatalog, fallback)
}

export function writeProductCatalog(value: ProductCatalogGroup[]) {
  writeStore(KEYS.productCatalog, value)
}

export function readModuleAssignments(fallback: ASModuleAssignment[]) {
  return readStore<ASModuleAssignment[]>(KEYS.moduleAssignments, fallback)
}

export function writeModuleAssignments(value: ASModuleAssignment[]) {
  writeStore(KEYS.moduleAssignments, value)
}

export function appendModuleAssignment(value: ASModuleAssignment) {
  const current = readModuleAssignments([])
  writeModuleAssignments([value, ...current])
}

export function readASWorkflowSettings(fallback: ASWorkflowSettings = DEFAULT_AS_WORKFLOW_SETTINGS) {
  const value = readStore<Partial<ASWorkflowSettings>>(KEYS.asWorkflowSettings, fallback)
  const service = Array.isArray(value.service_statuses) && value.service_statuses.length > 0
    ? value.service_statuses
    : fallback.service_statuses
  const calibration = Array.isArray(value.calibration_statuses) && value.calibration_statuses.length > 0
    ? value.calibration_statuses
    : service
  return {
    service_statuses: service as ASJobStatus[],
    calibration_statuses: calibration as ASJobStatus[],
  }
}

export function writeASWorkflowSettings(value: ASWorkflowSettings) {
  writeStore(KEYS.asWorkflowSettings, value)
}

export function upsertOrganizationByName(
  orgs: ASOrganization[],
  orgName: string,
  contactName?: string,
) {
  const normalized = orgName.trim().toLowerCase()
  const existing = orgs.find((o) => o.name.trim().toLowerCase() === normalized)
  if (existing) return orgs

  const next: ASOrganization = {
    id: newId("org"),
    name: orgName,
    org_type: "New",
    org_format: "",
    province: "",
    region: "",
    health_district: 0,
    one_qa: false,
    contacts: contactName
      ? [
          {
            id: newId("ct"),
            name: contactName,
            position: "",
            email: "",
            tel: "",
            is_primary: true,
          },
        ]
      : [],
    created_at: new Date().toISOString(),
  }
  return [next, ...orgs]
}
