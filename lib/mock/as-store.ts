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
  name_english?: string
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

/** แจ้งเตือน Sales — ดีลเปิดนานไม่มี Activity ตามเกณฑ์โอกาส */
export interface SESalesNeglectNotification {
  id: string
  deal_id: string
  deal_no: string
  owner?: string
  title: string
  message: string
  created_at: string
  read_at?: string
  /** กันซ้ำ (เช่น รอบสัปดาห์ / ช่วง 30–90 วัน) */
  dedupe_key: string
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
    | "claim_overseas_created"
    | "replacement_received"
    | "replacement_commissioning_started"
    | "claim_cycle_closed"
  status?: ASJobStatus
  message: string
  created_at: string
}

export interface ASCommissioningClaimCase {
  id: string
  source_job_id: string
  source_job_no: string
  customer_org: string
  customer_name?: string
  manufacturer: string
  model: string
  /** SN ของชิ้นที่เคลม (ทั้งเครื่อง = SN หลักของงาน; แยก module/sensor = SN ของชิ้นนั้น) */
  old_serial_number: string
  /** เมื่อเคลมเฉพาะ module/sensor — SN เครื่องหลัก/จอ ของงาน (อ้างอิงชุด) */
  parent_serial_number?: string
  /** ขอบเขตเคลม — ข้อมูลเก่าไม่มีฟิลด์นี้ถือเป็น whole_unit */
  claim_scope?: "whole_unit" | "module" | "sensor"
  /** เช่น Module 2, R/F Sensor */
  claimed_component_label?: string
  failure_reason: string
  claim_reference?: string
  status:
    | "pending_claim_submission"
    | "sent_overseas"
    | "replacement_received"
    | "replacement_commissioning"
    | "closed"
  failed_at: string
  sent_overseas_at?: string
  replacement_serial_number?: string
  replacement_dispatch_id?: string
  replacement_job_id?: string
  replacement_job_no?: string
  replacement_received_at?: string
  replacement_note?: string
  closed_at?: string
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

/** เป้าขายสูงสุดต่อเขตสุขภาพ (ปรับได้ตามตลาด) + มอบหมาย Sales หลัก */
export interface SEHealthDistrictTarget {
  district: number
  annual_cap_thb: number
  /** ชื่อต้องอยู่ใน se_owners */
  primary_owner: string
}

/** หนึ่งขั้น Pipeline — โอกาสปิดการขายขั้นต่ำต่อ stage (ใช้ทั้ง Booking + Quote funnel) */
export interface SEPipelineStageRule {
  name: string
  /** โอกาสปิดการขายขั้นต่ำ (%) เมื่อดีลอยู่ stage นี้ — ขอ Booking / นับ Quote funnel เมื่อโอกาสดีล ≥ ค่านี้ */
  min_closing_probability: number
}

/** แกนเรดาร์ Potential Performance — `key` ใช้เก็บคะแนนใน `se_potential_performance_scores` */
export interface SEPotentialPerformanceAxis {
  key: string
  label: string
}

/** ชื่อ SE (ตรง se_owners) → แกน key → คะแนน 0–100 */
export type SEPotentialPerformanceScores = Record<string, Record<string, number>>

export interface SESettings {
  se_owners: string[]
  /** ตัวเลือกสาเหตุที่แพ้ — ใช้ตอนปิดดีล Lost (Pipeline / Deals) */
  se_lost_reasons: string[]
  /** Segment ลูกค้าเชิงตลาด (Large Hospital Gov, OEM, Private Hospital ฯลฯ) — ใช้บนดีล + ตั้งที่ Settings */
  se_customer_segments: string[]
  /** แกนเรดาร์ SE Dashboard (Potential Performance) — ตั้งชื่อแกนได้ */
  se_potential_performance_axes: SEPotentialPerformanceAxis[]
  /** คะแนนต่อคน × แกน — ตั้งที่ Settings → SE */
  se_potential_performance_scores: SEPotentialPerformanceScores
  se_pipeline_stages: SEPipelineStageRule[]
  /**
   * เป้ารวมบริษัท (รายได้) ≈ sum(annual_cap เขต) × ค่านี้ — เช่น 0.85 = ใช้ 85% ของผลรวมเขตเป็นเป้าจริง
   */
  company_achieve_factor: number
  /** สัดส่วนแบ่งเป้าตาม Segment (รวมกันควร = 100; ถ้าไม่ครบระบบ normalize) */
  segment_mix_public_hospital_pct: number
  segment_mix_other_pct: number
  segment_mix_buffer_pct: number
  /** เป้า 13 เขต — แก้ได้ทีละเขต */
  health_district_targets: SEHealthDistrictTarget[]
  /**
   * เมื่อ SE ติ๊ก "ดีลในมือ" — โอกาสปิดขั้นต่ำ (%) ระบบจะบังคับอย่างน้อยเท่านี้ (กันเล่น safe ใน forecast)
   */
  se_in_hand_min_probability: number
}

/** รายการเครื่อง/รุ่นใน 1 ดีล (นอกจากแถวหลัก product_model) */
export interface SEDealProductLine {
  product_model: string
  manufacturer?: string
}

export interface SEDeal {
  id: string
  deal_no: string
  customer_name: string
  title: string
  product_model?: string
  manufacturer?: string
  /** เครื่อง/รุ่นเพิ่มใน 1 ดีล — แถวหลักยังใช้ product_model + manufacturer */
  product_lines?: SEDealProductLine[]
  stage: string
  value: number
  probability: number
  expected_close_date: string
  owner: string
  /** รพ.ภาครัฐ (lookup) | อื่นๆ (เลือกจังหวัดเอง) — ลูกค้าใหม่ / บางดีลเก่า */
  customer_segment?: "public_hospital" | "other"
  /** Segment จาก Settings → se_customer_segments */
  market_segment?: string
  /** ชื่อจดทะเบียน/ชื่ออังกฤษ (ถ้ามี) — คู่กับ customer_name ภาษาไทย */
  customer_name_english?: string
  region?: string
  province?: string
  /** เลขเขตสุขภาพ 1–13 ตาม mapping จังหวัดในระบบ */
  health_district?: number
  /** วันที่ตั้งใจติดตามถัดไป (ใช้เช็ค stale ร่วมกับ Activity) YYYY-MM-DD */
  next_followup_on?: string
  /** เลขที่ใบเสนอราคาจาก Admin ที่ลูกค้า/บริษัทได้รับ (กรอกบนดีล) */
  admin_quote_no?: string
  /** ยืนยันบน SE Dashboard ว่ากำลังประมูล E-bidding จริง — รายการขึ้นอัตโนมัติเมื่อมูลค่าดีลเปิด ≥ เกณฑ์ใน lib/se/se-ebidding.ts */
  on_ebidding?: boolean
  /** SE ยืนยันว่าเป็นงานในมือ / คาดปิดแน่ — ต้องใช้โอกาส ≥ se_in_hand_min_probability */
  declared_in_hand?: boolean
  /** เมื่อโอกาสต่ำกว่า min ของ stage — บังคับอธิบาย (audit) */
  below_stage_prob_note?: string
  /** เมื่อ stage = Lost — เลือกจาก Settings → se_lost_reasons หรือข้อความที่กำหนด */
  lost_reason?: string
  lost_reason_note?: string
  /** สร้างดีล — ใช้คำนวณ “ครั้งสัมผัสล่าสุด” ร่วมกับ Activity */
  created_at?: string
}

/** คำขอออเดอร์จาก SE หลังดีล Won — Stock ตรวจ PO กับอีเมล (เฟส 1) */
export interface SEOrderRequest {
  id: string
  deal_id: string
  deal_no: string
  customer_name: string
  deal_title: string
  /** เลข PO ลูกค้า */
  customer_po_no: string
  /** snapshot เลข QT Admin ณ ตอนสร้างคำขอ */
  admin_quote_no: string
  owner: string
  created_at: string
  note?: string
  /** Stock ติ๊กว่า PO ตรงกับที่ได้รับทางอีเมล */
  stock_po_verified?: boolean
  stock_po_verified_at?: string
  stock_po_verified_by?: string
}

/** Activity ต่อดีล — manual + ระบบสร้างอัตโนมัติ (เฟส 1) */
export type SEDealActivityType =
  | "call"
  | "email"
  | "meeting"
  | "demo"
  | "demo_loan"
  | "training_request"
  | "stock_booking"
  | "service_request"
  | "order_request"
  | "other"

export type SEDealActivitySource =
  | "manual"
  | "stock_loan"
  | "pipeline_booking"
  | "se_service_request"
  | "se_order_request"

export interface SEDealActivityRecord {
  id: string
  deal_id: string
  activity_type: SEDealActivityType
  source: SEDealActivitySource
  subject: string
  note: string
  /** วันที่เหตุการณ์ (YYYY-MM-DD) */
  occurred_on: string
  actor_name?: string
  created_at: string
  meta?: {
    stock_item_name?: string
    serial_number?: string
    ref_no?: string
    request_type?: string
  }
}

/** คำขอบริการจาก SE (persist mock) */
export interface SEServiceRequestStored {
  id: string
  ref_no: string
  customer_name: string
  deal_title: string
  /** ผูกดีลเพื่อ Activity / รายงาน */
  deal_id?: string
  request_type: "installation" | "training" | "maintenance" | "consultation"
  description: string
  status: "pending" | "scheduled" | "completed" | "cancelled"
  scheduled_date: string
  owner: string
  created_at: string
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
  seDeals: "se_deals",
  seDealActivities: "as_se_deal_activities",
  seServiceRequests: "se_service_requests",
  seOrderRequests: "se_order_requests",
  productCatalog: "product_catalog",
  moduleAssignments: "as_module_assignments",
  asWorkflowSettings: "as_workflow_settings",
  seIncomingRequests: "as_se_incoming_requests",
  partsRequests: "as_parts_requests",
  stockNotifications: "as_stock_notifications",
  /** SE — แจ้งเตือนดีลไม่มีการติดต่อ (เพิกเฉย) ตามเกณฑ์โอกาสปิด */
  seSalesNeglectNotifications: "se_sales_neglect_notifications",
  equipmentHistory: "as_equipment_history",
  oxygenSensorHistory: "as_oxygen_sensor_history",
  commissioningClaimCases: "as_commissioning_claim_cases",
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

export function defaultHealthDistrictTargets(): SEHealthDistrictTarget[] {
  return Array.from({ length: 13 }, (_, i) => ({
    district: i + 1,
    annual_cap_thb: 0,
    primary_owner: "",
  }))
}

export function defaultSEPipelineStages(): SEPipelineStageRule[] {
  const open = { min_closing_probability: 70 }
  return [
    { name: "lead", ...open },
    { name: "qualified", ...open },
    { name: "proposal", ...open },
    /** ชื่อมีคำว่า forecast — ใช้เขตแดนกับ stage อื่นสำหรับการยืนยัน ECD เมื่อโอกาส ≥ 80% */
    { name: "forecast", ...open },
    { name: "negotiation", ...open },
    { name: "won", min_closing_probability: 100 },
    /** ดีลปิดแล้ว — โอกาสปิดเชิงชนะ = 0; ไม่ใช้ค่านี้คำนวณ Win rate (ดูสาเหตุแพ้แยก) */
    { name: "lost", min_closing_probability: 0 },
  ]
}

export const DEFAULT_SE_LOST_REASONS: string[] = [
  "แพ้คู่แข่ง",
  "แพ้เรื่องราคา",
  "ลูกค้าไม่ซื้อ / ชะลอโครงการ",
  "งบประมาณไม่พอ",
  "สเปกหรือเงื่อนไขไม่ตรง",
  "อื่นๆ (ระบุในหมายเหตุ)",
]

export const DEFAULT_SE_CUSTOMER_SEGMENTS: string[] = [
  "โรงพยาบาลรัฐขนาดใหญ่ (Large Hospital — Government)",
  "โรงพยาบาลเอกชน (Private Hospital)",
  "คลินิก / ศูนย์บริการ",
  "OEM / ผู้ผลิต",
  "ตัวแทนจำหน่าย / Distributor",
  "หน่วยงานรัฐ (ไม่ใช่ รพ.)",
  "อื่นๆ",
]

export const DEFAULT_SE_POTENTIAL_PERFORMANCE_AXES: SEPotentialPerformanceAxis[] = [
  { key: "responsibility", label: "Responsibility" },
  { key: "target", label: "Target" },
  { key: "pipeline", label: "Pipeline" },
  { key: "closing", label: "Closing" },
  { key: "follow_up", label: "Follow-up" },
  { key: "collaboration", label: "Collaboration" },
]

/** ค่าเริ่มต้น — ตั้งค่าได้ที่ Settings → SE Module */
export const DEFAULT_SE_SETTINGS: SESettings = {
  se_owners: [],
  se_lost_reasons: [...DEFAULT_SE_LOST_REASONS],
  se_customer_segments: [...DEFAULT_SE_CUSTOMER_SEGMENTS],
  se_potential_performance_axes: [...DEFAULT_SE_POTENTIAL_PERFORMANCE_AXES],
  se_potential_performance_scores: {},
  se_pipeline_stages: defaultSEPipelineStages(),
  company_achieve_factor: 0.85,
  segment_mix_public_hospital_pct: 55,
  segment_mix_other_pct: 30,
  segment_mix_buffer_pct: 15,
  health_district_targets: defaultHealthDistrictTargets(),
  se_in_hand_min_probability: 88,
}

function mergeHealthDistrictTargets(
  stored: SEHealthDistrictTarget[] | undefined,
): SEHealthDistrictTarget[] {
  const base = defaultHealthDistrictTargets()
  if (!Array.isArray(stored) || stored.length === 0) return base
  return base.map((b) => {
    const hit = stored.find((x) => Number(x.district) === b.district)
    if (!hit) return b
    return {
      district: b.district,
      annual_cap_thb: Math.max(0, Number(hit.annual_cap_thb) || 0),
      primary_owner: typeof hit.primary_owner === "string" ? hit.primary_owner.trim() : "",
    }
  })
}

function mergePotentialPerformanceAxes(value: Partial<SESettings>, fb: SESettings): SEPotentialPerformanceAxis[] {
  const raw = value.se_potential_performance_axes
  if (!Array.isArray(raw) || raw.length === 0) return fb.se_potential_performance_axes.map((x) => ({ ...x }))
  const out: SEPotentialPerformanceAxis[] = []
  for (const x of raw) {
    if (!x || typeof x !== "object") continue
    const key = String((x as SEPotentialPerformanceAxis).key ?? "").trim()
    const label = String((x as SEPotentialPerformanceAxis).label ?? "").trim()
    if (!key || !label) continue
    out.push({ key, label })
  }
  return out.length > 0 ? out : fb.se_potential_performance_axes.map((x) => ({ ...x }))
}

function mergePotentialPerformanceScores(value: Partial<SESettings>, fb: SESettings): SEPotentialPerformanceScores {
  const raw = value.se_potential_performance_scores
  if (raw === undefined || raw === null) return { ...fb.se_potential_performance_scores }
  if (typeof raw !== "object" || Array.isArray(raw)) return { ...fb.se_potential_performance_scores }
  const out: SEPotentialPerformanceScores = {}
  for (const [owner, axes] of Object.entries(raw as Record<string, unknown>)) {
    const o = owner.trim()
    if (!o) continue
    if (!axes || typeof axes !== "object" || Array.isArray(axes)) continue
    const inner: Record<string, number> = {}
    for (const [k, v] of Object.entries(axes as Record<string, unknown>)) {
      const nk = String(k).trim()
      if (!nk) continue
      const n = Number(v)
      if (!Number.isFinite(n)) continue
      inner[nk] = Math.min(100, Math.max(0, Math.round(n)))
    }
    if (Object.keys(inner).length > 0) out[o] = inner
  }
  return out
}

type LegacySESettingsBlob = {
  se_stages?: string[]
  booking_request_min_probability?: number
  quotation_pipeline_min_probability?: number
}

type LegacyStageRuleBlob = {
  booking_min_probability?: number
  quotation_pipeline_min_probability?: number
  min_closing_probability?: number
}

function mergeSEPipelineStages(value: Partial<SESettings>, fb: SESettings): SEPipelineStageRule[] {
  const v = value as Partial<SESettings> & LegacySESettingsBlob
  const raw = v.se_pipeline_stages
  if (
    Array.isArray(raw) &&
    raw.length > 0 &&
    raw.every((x) => x && typeof x === "object" && typeof (x as SEPipelineStageRule).name === "string")
  ) {
    const seen = new Set<string>()
    const out: SEPipelineStageRule[] = []
    for (const r of raw) {
      const name = String(r.name).trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      const legacy = r as LegacyStageRuleBlob & { name: string }
      let minClose = Number(legacy.min_closing_probability)
      if (!Number.isFinite(minClose)) {
        const b = Number(legacy.booking_min_probability)
        const q = Number(legacy.quotation_pipeline_min_probability)
        const hasB = Number.isFinite(b)
        const hasQ = Number.isFinite(q)
        minClose = hasB && hasQ ? Math.max(b, q) : hasB ? b : hasQ ? q : 70
      }
      out.push({
        name,
        min_closing_probability: Math.min(100, Math.max(0, minClose)),
      })
    }
    if (out.length > 0) return out
  }
  const oldStages = v.se_stages
  const globBook =
    typeof v.booking_request_min_probability === "number" && Number.isFinite(v.booking_request_min_probability)
      ? Math.min(100, Math.max(0, v.booking_request_min_probability))
      : 70
  const globQuote =
    typeof v.quotation_pipeline_min_probability === "number" &&
    Number.isFinite(v.quotation_pipeline_min_probability)
      ? Math.min(100, Math.max(0, v.quotation_pipeline_min_probability))
      : 50
  if (Array.isArray(oldStages) && oldStages.length > 0) {
    const mergedGlob = Math.max(globBook, globQuote)
    return oldStages.map((name) => {
      const n = String(name).trim()
      const l = n.toLowerCase()
      const closedWon = /won|ชนะ/.test(l)
      const closedLost = /lost|แพ้/.test(l)
      if (closedWon) {
        return { name: n, min_closing_probability: 100 }
      }
      if (closedLost) {
        return { name: n, min_closing_probability: 0 }
      }
      return {
        name: n,
        min_closing_probability: mergedGlob,
      }
    })
  }
  return fb.se_pipeline_stages.length > 0 ? fb.se_pipeline_stages : defaultSEPipelineStages()
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

export function readSESalesNeglectNotifications(fallback: SESalesNeglectNotification[] = []) {
  return readStore<SESalesNeglectNotification[]>(KEYS.seSalesNeglectNotifications, fallback)
}

export function writeSESalesNeglectNotifications(value: SESalesNeglectNotification[]) {
  writeStore(KEYS.seSalesNeglectNotifications, value)
}

/** กันซ้ำด้วย dedupe_key เดียวกัน */
export function appendSESalesNeglectNotification(item: SESalesNeglectNotification): boolean {
  const current = readSESalesNeglectNotifications([])
  if (current.some((n) => n.dedupe_key === item.dedupe_key)) return false
  writeSESalesNeglectNotifications([item, ...current])
  return true
}

export function markSESalesNeglectNotificationRead(id: string, at: string = new Date().toISOString()): boolean {
  const current = readSESalesNeglectNotifications([])
  let changed = false
  const next = current.map((n) => {
    if (n.id !== id || n.read_at) return n
    changed = true
    return { ...n, read_at: at }
  })
  if (!changed) return false
  writeSESalesNeglectNotifications(next)
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

export function readCommissioningClaimCases(fallback: ASCommissioningClaimCase[]) {
  return readStore<ASCommissioningClaimCase[]>(KEYS.commissioningClaimCases, fallback)
}

export function writeCommissioningClaimCases(value: ASCommissioningClaimCase[]) {
  writeStore(KEYS.commissioningClaimCases, value)
}

export function appendCommissioningClaimCase(entry: ASCommissioningClaimCase) {
  const current = readCommissioningClaimCases([])
  if (current.some((e) => e.id === entry.id)) return
  writeCommissioningClaimCases([entry, ...current])
}

export function updateCommissioningClaimCase(id: string, patch: Partial<ASCommissioningClaimCase>) {
  const current = readCommissioningClaimCases([])
  let changed = false
  const next = current.map((c) => {
    if (c.id !== id) return c
    changed = true
    return { ...c, ...patch }
  })
  if (!changed) return false
  writeCommissioningClaimCases(next)
  return true
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

/**
 * รวม partial (จาก localStorage หรือฟอร์ม) เป็น SESettings เต็ม — clamp ตัวเลข + เติม 13 เขต
 */
/**
 * ค่า SE settings สำหรับ `useState` รอบแรกให้ตรงกับ SSR — ห้ามอ่าน localStorage ใน initializer
 * (กัน hydration mismatch) · หลัง mount ค่อย `setState(readSESettings())`
 */
export function initialSESettingsForSSR(): SESettings {
  return parseSESettingsBlob(DEFAULT_SE_SETTINGS, DEFAULT_SE_SETTINGS)
}

export function parseSESettingsBlob(value: Partial<SESettings>, fb: SESettings = DEFAULT_SE_SETTINGS): SESettings {
  const achieve =
    typeof value.company_achieve_factor === "number" && Number.isFinite(value.company_achieve_factor)
      ? Math.min(1, Math.max(0, value.company_achieve_factor))
      : fb.company_achieve_factor
  const mixPub =
    typeof value.segment_mix_public_hospital_pct === "number" && Number.isFinite(value.segment_mix_public_hospital_pct)
      ? Math.max(0, value.segment_mix_public_hospital_pct)
      : fb.segment_mix_public_hospital_pct
  const mixOth =
    typeof value.segment_mix_other_pct === "number" && Number.isFinite(value.segment_mix_other_pct)
      ? Math.max(0, value.segment_mix_other_pct)
      : fb.segment_mix_other_pct
  const mixBuf =
    typeof value.segment_mix_buffer_pct === "number" && Number.isFinite(value.segment_mix_buffer_pct)
      ? Math.max(0, value.segment_mix_buffer_pct)
      : fb.segment_mix_buffer_pct
  const lostReasonsRaw = Array.isArray(value.se_lost_reasons)
    ? value.se_lost_reasons.map((s) => String(s).trim()).filter(Boolean)
    : fb.se_lost_reasons
  const customerSegRaw = Array.isArray(value.se_customer_segments)
    ? value.se_customer_segments.map((s) => String(s).trim()).filter(Boolean)
    : fb.se_customer_segments
  const inHandMin =
    typeof value.se_in_hand_min_probability === "number" && Number.isFinite(value.se_in_hand_min_probability)
      ? Math.min(100, Math.max(0, value.se_in_hand_min_probability))
      : fb.se_in_hand_min_probability
  return {
    se_owners: Array.isArray(value.se_owners) ? value.se_owners.map((s) => String(s)) : fb.se_owners,
    se_lost_reasons: lostReasonsRaw.length > 0 ? lostReasonsRaw : fb.se_lost_reasons,
    se_customer_segments: customerSegRaw.length > 0 ? customerSegRaw : fb.se_customer_segments,
    se_potential_performance_axes: mergePotentialPerformanceAxes(value, fb),
    se_potential_performance_scores: mergePotentialPerformanceScores(value, fb),
    se_pipeline_stages: mergeSEPipelineStages(value, fb),
    company_achieve_factor: achieve,
    segment_mix_public_hospital_pct: mixPub,
    segment_mix_other_pct: mixOth,
    segment_mix_buffer_pct: mixBuf,
    health_district_targets: mergeHealthDistrictTargets(value.health_district_targets),
    se_in_hand_min_probability: inHandMin,
  }
}

export function readSESettings(fallback: SESettings = DEFAULT_SE_SETTINGS) {
  const value = readStore<Partial<SESettings>>(KEYS.seSettings, fallback)
  return parseSESettingsBlob(value, fallback)
}

/** ก่อน writeSESettings — normalize จาก state ในหน้า Settings */
export function coerceSESettingsForWrite(input: SESettings): SESettings {
  return parseSESettingsBlob(input, DEFAULT_SE_SETTINGS)
}

export function writeSESettings(value: SESettings) {
  writeStore(KEYS.seSettings, value)
}

export function readSEDeals(fallback: SEDeal[]) {
  return readStore<SEDeal[]>(KEYS.seDeals, fallback)
}

export function writeSEDeals(value: SEDeal[]) {
  writeStore(KEYS.seDeals, value)
}

export function readSEDealActivities(fallback: SEDealActivityRecord[] = []) {
  return readStore<SEDealActivityRecord[]>(KEYS.seDealActivities, fallback)
}

export function writeSEDealActivities(value: SEDealActivityRecord[]) {
  writeStore(KEYS.seDealActivities, value)
}

export function appendSEDealActivity(
  entry: Omit<SEDealActivityRecord, "id" | "created_at"> & Partial<Pick<SEDealActivityRecord, "id" | "created_at">>,
): SEDealActivityRecord {
  const id = entry.id ?? newId("sea")
  const created_at = entry.created_at ?? new Date().toISOString()
  const full: SEDealActivityRecord = {
    id,
    created_at,
    deal_id: entry.deal_id,
    activity_type: entry.activity_type,
    source: entry.source,
    subject: entry.subject,
    note: entry.note ?? "",
    occurred_on: entry.occurred_on,
    actor_name: entry.actor_name,
    meta: entry.meta,
  }
  const cur = readSEDealActivities([])
  writeSEDealActivities([full, ...cur])
  return full
}

export function readSEServiceRequests(fallback: SEServiceRequestStored[] = []) {
  return readStore<SEServiceRequestStored[]>(KEYS.seServiceRequests, fallback)
}

export function writeSEServiceRequests(value: SEServiceRequestStored[]) {
  writeStore(KEYS.seServiceRequests, value)
}

export function readSEOrderRequests(fallback: SEOrderRequest[] = []) {
  return readStore<SEOrderRequest[]>(KEYS.seOrderRequests, fallback)
}

export function writeSEOrderRequests(value: SEOrderRequest[]) {
  writeStore(KEYS.seOrderRequests, value)
}

export function appendSEOrderRequest(row: SEOrderRequest) {
  const cur = readSEOrderRequests([])
  writeSEOrderRequests([row, ...cur])
}

export function setSEOrderRequestPoVerified(id: string, verified: boolean, verifiedBy: string) {
  const at = new Date().toISOString()
  const cur = readSEOrderRequests([])
  writeSEOrderRequests(
    cur.map((r) =>
      r.id === id
        ? {
            ...r,
            stock_po_verified: verified,
            stock_po_verified_at: verified ? at : undefined,
            stock_po_verified_by: verified ? verifiedBy : undefined,
          }
        : r,
    ),
  )
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
