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

export type ASJobType = "repair" | "calibration"
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
  calibration_date?: string
  due_date?: string
  source?: "manual" | "stock" | "se" | "proactive"
  source_dispatch_id?: string
  cancellation_reason?: string
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
  job_type: ASJobType
  routing?: "in_country" | "overseas"
  // For calibration alerts in Service Monitor
  due_date?: string
  dispatched_by: string
  dispatched_at: string
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
  created_at: string
}

export interface ASDropdownConfig {
  stock_models: string[]
  stock_manufacturers: string[]
  calibration_labs: string[]
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
}

const KEYS = {
  jobs: "as_service_jobs",
  orgs: "as_organizations",
  stockDispatches: "as_stock_dispatches",
  loanReturns: "as_loan_return_history",
  repairToCalRequests: "as_repair_to_cal_requests",
  proactiveCalibrationAssets: "as_proactive_calibration_assets",
  dropdownConfig: "as_dropdown_config",
  stockItems: "as_stock_items",
  globalSettings: "global_settings",
  seSettings: "se_settings",
  productCatalog: "product_catalog",
  moduleAssignments: "as_module_assignments",
  asWorkflowSettings: "as_workflow_settings",
  seIncomingRequests: "as_se_incoming_requests",
} as const

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
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  app_name: "TreatMed OS",
  default_currency: "THB",
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
}

function hasWindow() {
  return typeof window !== "undefined"
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
    return fallback
  }
}

export function writeStore<T>(key: string, value: T) {
  if (!hasWindow()) return
  const nextRaw = JSON.stringify(value)
  const prevRaw = window.localStorage.getItem(key)
  if (prevRaw === nextRaw) return
  window.localStorage.setItem(key, nextRaw)
  window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key } }))
}

export function readJobs(fallback: ASServiceJob[]) {
  return readStore<ASServiceJob[]>(KEYS.jobs, fallback)
}

export function writeJobs(value: ASServiceJob[]) {
  writeStore(KEYS.jobs, value)
}

export function readOrganizations(fallback: ASOrganization[]) {
  return readStore<ASOrganization[]>(KEYS.orgs, fallback)
}

export function writeOrganizations(value: ASOrganization[]) {
  writeStore(KEYS.orgs, value)
}

export function readStockDispatches(fallback: ASStockDispatch[]) {
  return readStore<ASStockDispatch[]>(KEYS.stockDispatches, fallback)
}

export function writeStockDispatches(value: ASStockDispatch[]) {
  writeStore(KEYS.stockDispatches, value)
}

export function appendStockDispatch(dispatch: ASStockDispatch) {
  const current = readStockDispatches([])
  writeStockDispatches([dispatch, ...current])
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

export function readProactiveCalibrationAssets(fallback: ASProactiveCalibrationAsset[]) {
  return readStore<ASProactiveCalibrationAsset[]>(KEYS.proactiveCalibrationAssets, fallback)
}

export function writeProactiveCalibrationAssets(value: ASProactiveCalibrationAsset[]) {
  writeStore(KEYS.proactiveCalibrationAssets, value)
}

export function readDropdownConfig(fallback: ASDropdownConfig = DEFAULT_AS_DROPDOWN_CONFIG) {
  return readStore<ASDropdownConfig>(KEYS.dropdownConfig, fallback)
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

export function readGlobalSettings(fallback: GlobalSettings = DEFAULT_GLOBAL_SETTINGS) {
  return readStore<GlobalSettings>(KEYS.globalSettings, fallback)
}

export function writeGlobalSettings(value: GlobalSettings) {
  writeStore(KEYS.globalSettings, value)
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
  return readStore<ASWorkflowSettings>(KEYS.asWorkflowSettings, fallback)
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
    id: Date.now().toString(),
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
            id: `${Date.now()}-c1`,
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
