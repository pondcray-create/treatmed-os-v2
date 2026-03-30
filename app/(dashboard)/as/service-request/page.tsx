"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, Plus, ChevronRight, X, Wrench, FlaskConical, Clock, CheckCircle2, Copy, Check, Building2, User, Hash, FileText, Trash2, Bell, Inbox, Users, ClipboardCheck, Package, Send } from "lucide-react"
import {
  AS_STORE_KEYS,
  readProactiveCalibrationAssets,
  readASWorkflowSettings,
  appendPartsRequest,
  appendStockNotification,
  appendEquipmentHistory,
  appendStockDispatch,
  appendCommissioningClaimCase,
  readEquipmentHistory,
  readCommissioningClaimCases,
  readIncomingSERequests,
  readJobs,
  readJobsVersion,
  readPartsRequests,
  readRepairToCalRequests,
  readOrganizations,
  readDropdownConfig,
  readStockDispatches,
  appendStockDispatchHistory,
  appendRepairToCalRequest,
  removeIncomingSERequest,
  removeRepairToCalRequest,
  upsertOrganizationByName,
  writeJobs,
  writeJobsWithConcurrencyCheck,
  writeIncomingSERequests,
  writeOrganizations,
  writePartsRequests,
  writeProactiveCalibrationAssets,
  writeRepairToCalRequests,
  writeStockDispatches,
  writeCommissioningClaimCases,
  type ASProactiveCalibrationAsset,
  type ASServiceJob as ServiceJob,
  type ASStockDispatch as StockDispatch,
  type ASRepairToCalRequest as RepairToCalRequest,
  type ASIncomingSERequest,
  type ASOrganization,
  type ASPartsRequest,
  type ASEquipmentHistoryEntry,
  type ASCommissioningClaimCase,
} from "@/lib/mock/as-store"
import { filterModuleClaimLabels, filterSensorClaimLabels, getReceiveModuleSpec } from "@/lib/receive-module-spec"
import {
  STATUS_FLOW,
  getCalibrationAlertLevel,
  getNextWorkflowStatus,
  getSlaState,
  getTransitionBlockReason,
  getWorkflowProgressIndex,
} from "@/lib/mock/as-logic"
import { formatThDateFromYMD, formatThDateTime, thDateInputBeHint } from "@/lib/format-th-datetime"
import { newId } from "@/lib/new-id"
import { useAuth } from "@/hooks/useAuth"
import {
  applyOfflineJobPatchById,
  clearOfflineJobPatches,
  enqueueOfflineJobPatchWithBaseStatus,
  flushOfflineJobPatches,
  type OfflineMutation,
  removeOfflineJobPatchById,
  readOfflineJobPatches,
} from "@/lib/mock/offline-queue"
import { useJobStateMachine } from "@/hooks/useJobStateMachine"
import {
  applyVTOxygenSensorEffectsOnCalibrationClose,
  getVTOxygenSensorPickOptions,
  getVTOxygenSensorStockRollup,
  type JobActorRole,
  type JobFsmState,
} from "@/lib/as-job-fsm"

type JobType = "repair" | "preventive_maintenance" | "calibration" | "commissioning"
type Priority = "urgent" | "high" | "normal"
type Routing = "in_country" | "overseas"
type MainTab = "jobs" | "commissioning" | "from_stock" | "from_se" | "from_repair_cal"
/** งาน Commissioning Test (รับเข้า / ตรวจเช็คก่อนเข้า Stock) — ไม่ใช่ Calibration ทั่วไป */
const COMMISSIONING_STATUS_FLOW: ServiceJob["status"][] = ["ในคิว", "กำลังประเมิน", "ปิดงาน"]

function isCommissioningTestJob(job: ServiceJob): boolean {
  if (job.job_type === "commissioning") return true
  if (job.source === "stock" && job.job_type === "calibration") {
    const s = job.symptom_reported
    return s.includes("QC ก่อนเข้า Stock") || s.includes("Commissioning Test")
  }
  return false
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-red-700">ยกเลิกงาน</h3>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 p-3 rounded-xl border border-red-100 bg-red-50">
          <p className="text-xs text-red-600">Job</p>
          <p className="text-sm font-semibold text-gray-900">{job.job_no} · {job.model}</p>
        </div>
        <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 mb-1.5">เหตุผลการยกเลิก *</label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          className={`${inp} resize-none`}
          placeholder="ระบุเหตุผล เช่น ลูกค้ายกเลิก, ข้อมูลผิดพลาด, รวมงานกับใบงานอื่น"
        />
        <label htmlFor="cancel-action-plan" className="block text-sm font-medium text-gray-700 mb-1.5 mt-3">Action Plan การแก้ไข / ขั้นตอนถัดไป *</label>
        <p className="text-xs text-gray-500 mb-1.5">ระบุว่าจะดำเนินการอย่างไรต่อ เช่น แจ้งลูกค้า, ส่งคืน Stock, เปิดงานใหม่, ติดตามอะไหล่</p>
        <textarea
          id="cancel-action-plan"
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

type ClaimScopeUI = "whole_unit" | "module" | "sensor"

function CommissioningFailDialog({
  job,
  reason,
  claimRef,
  claimScope,
  componentLabel,
  componentSerial,
  onReasonChange,
  onClaimRefChange,
  onClaimScopeChange,
  onComponentLabelChange,
  onComponentSerialChange,
  onClose,
  onConfirm,
}: {
  job: ServiceJob
  reason: string
  claimRef: string
  claimScope: ClaimScopeUI
  componentLabel: string
  componentSerial: string
  onReasonChange: (value: string) => void
  onClaimRefChange: (value: string) => void
  onClaimScopeChange: (value: ClaimScopeUI) => void
  onComponentLabelChange: (value: string) => void
  onComponentSerialChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const inp = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
  const spec = getReceiveModuleSpec(job.model)
  const moduleOpts = filterModuleClaimLabels(spec.componentLabels)
  const sensorOpts = filterSensorClaimLabels(spec.componentLabels)
  const scopeOpts =
    claimScope === "module" ? moduleOpts : claimScope === "sensor" ? sensorOpts : []
  const needsComponent = claimScope !== "whole_unit"
  const confirmDisabled =
    !reason.trim() ||
    (needsComponent && (!componentLabel.trim() || !componentSerial.trim()))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-amber-700">Commissioning ไม่ผ่าน</h3>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 p-3 rounded-xl border border-amber-100 bg-amber-50">
          <p className="text-xs text-amber-700">Job</p>
          <p className="text-sm font-semibold text-gray-900">{job.job_no} · {job.model}</p>
          <p className="text-xs font-mono text-amber-800 mt-1">SN หลัก: {job.serial_number}</p>
        </div>
        <label htmlFor="commissioning-fail-reason" className="block text-sm font-medium text-gray-700 mb-1.5">
          เหตุผลที่ไม่ผ่าน *
        </label>
        <textarea
          id="commissioning-fail-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          className={`${inp} resize-none`}
          placeholder="เช่น ค่า pressure leak เกินเกณฑ์, flow sensor ผิดพลาด"
        />
        <p className="text-xs text-gray-500 mt-1.5">ระบบจะส่งกลับ Stock พร้อมเหตุผลนี้อัตโนมัติ</p>
        <p className="block text-sm font-medium text-gray-700 mt-3 mb-1.5">ขอบเขตการเคลม</p>
        <div className="flex flex-col gap-2 mb-3">
          {(
            [
              ["whole_unit", "ทั้งเครื่อง (SN หลักของงาน)"] as const,
              ["module", "เฉพาะ Module / ชุดคู่ (เช่น IDA6 module, SPOT)"] as const,
              ["sensor", "เฉพาะ Sensor (เช่น X2 R/F, CT, …)"] as const,
            ] as const
          ).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="radio"
                name="claim-scope"
                checked={claimScope === val}
                onChange={() => {
                  onClaimScopeChange(val)
                  onComponentLabelChange("")
                  onComponentSerialChange("")
                }}
                className="rounded-full border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              {label}
            </label>
          ))}
        </div>
        {needsComponent && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 space-y-2 mb-3">
            <p className="text-xs text-amber-800">
              ระบุชิ้นที่เสียและ SN ของชิ้นนั้น (Stock / Claim dashboard จะกรองตามประเภทและค้นหา SN ได้)
            </p>
            {scopeOpts.length > 0 ? (
              <>
                <label htmlFor="claim-component-label" className="block text-xs font-medium text-gray-600">
                  Component *
                </label>
                <select
                  id="claim-component-label"
                  value={componentLabel}
                  onChange={(e) => onComponentLabelChange(e.target.value)}
                  className={inp}
                >
                  <option value="">— เลือก —</option>
                  {scopeOpts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="claim-component-label-free" className="block text-xs font-medium text-gray-600">
                  ชื่อชิ้นที่เคลม (ระบุเอง) *
                </label>
                <input
                  id="claim-component-label-free"
                  value={componentLabel}
                  onChange={(e) => onComponentLabelChange(e.target.value)}
                  className={inp}
                  placeholder="เช่น Module 2, CT Sensor"
                />
              </>
            )}
            <label htmlFor="claim-component-serial" className="block text-xs font-medium text-gray-600">
              Serial ของชิ้นที่เคลม *
            </label>
            <input
              id="claim-component-serial"
              value={componentSerial}
              onChange={(e) => onComponentSerialChange(e.target.value)}
              className={`${inp} font-mono`}
              placeholder="SN ชิ้นที่เสีย"
            />
          </div>
        )}
        <label htmlFor="commissioning-claim-ref" className="block text-sm font-medium text-gray-700 mt-3 mb-1.5">
          Claim/RMA Reference (ถ้ามี)
        </label>
        <input
          id="commissioning-claim-ref"
          value={claimRef}
          onChange={(e) => onClaimRefChange(e.target.value)}
          className={inp}
          placeholder="เช่น CLM-FBC-2026-001"
        />
        <p className="text-xs text-gray-500 mt-1">
          ระบบสร้างเคส Claim ต่างประเทศแบบ end-to-end — SN ที่อ้างอิงเคลมจะเป็นชิ้นที่เลือก (หรือ SN หลักถ้าเคลมทั้งเครื่อง)
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">
            ปิด
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 disabled:bg-gray-300 text-white text-sm font-bold hover:bg-amber-600"
          >
            ยืนยันส่งกลับ Stock
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
        <span className="text-[10px] text-gray-400 leading-tight" title={job.received_date}>
          {formatThDateFromYMD(job.received_date)}
        </span>
      </div>
    </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-purple-500" /> Draft Quotation</h2>
          <button aria-label="ปิดหน้าต่าง" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="h-4 w-4" /></button>
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
                  <button type="button" onClick={()=>removeLine(l.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={addLine} className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs font-semibold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">+ เพิ่มรายการ</button>
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
          <button type="button" onClick={copyDraft}
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              ช่องทางรับ: {d.receive_channel ?? "พนักงาน"}
            </span>
            {d.receive_channel === "ขนส่งเอกชน" && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Tracking: {d.tracking_in?.trim() || "—"}
              </span>
            )}
            {d.receive_channel === "พนักงาน" && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                ผู้รับ: {d.received_by?.trim() || "—"}
              </span>
            )}
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
  claimCases,
  claimReceiveTarget,
  claimReplacementSerial,
  claimReplacementNote,
  onChangeClaimReceiveTarget,
  onChangeClaimReplacementSerial,
  onChangeClaimReplacementNote,
  onReceiveReplacement,
  onAcceptDispatch,
  onOpenJob,
}: {
  dispatches: StockDispatch[]
  jobs: ServiceJob[]
  claimCases: ASCommissioningClaimCase[]
  claimReceiveTarget: string
  claimReplacementSerial: string
  claimReplacementNote: string
  onChangeClaimReceiveTarget: (id: string) => void
  onChangeClaimReplacementSerial: (value: string) => void
  onChangeClaimReplacementNote: (value: string) => void
  onReceiveReplacement: (claim: ASCommissioningClaimCase, replacementSN: string, note: string) => void
  onAcceptDispatch: (d: StockDispatch) => void
  onOpenJob: (j: ServiceJob) => void
}) {
  const pending = dispatches.filter(
    (d) => d.job_type === "commissioning" && !jobs.some((j) => j.source_dispatch_id === d.id),
  )
  const activeJobs = jobs
    .filter((j) => isCommissioningTestJob(j))
    .filter((j) => j.status !== "ปิดงาน" && j.status !== "ยกเลิก")
  const activeClaims = claimCases.filter((c) => c.status !== "closed")

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

      <section>
        <h2 className="text-base font-bold text-gray-900 mb-1">Claim ต่างประเทศ (Commissioning ไม่ผ่าน)</h2>
        <p className="text-sm text-gray-500 mb-4">
          วงจร End-to-End: Fail {"->"} Claim Overseas {"->"} Receive Replacement SN {"->"} Commissioning ใหม่ {"->"} Close
        </p>
        {activeClaims.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center border border-gray-100 rounded-2xl">ยังไม่มีเคส Claim ที่เปิดอยู่</p>
        ) : (
          <div className="space-y-3">
            {activeClaims.map((c) => (
              <div key={c.id} className="rounded-2xl border border-orange-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-900">{c.model} · {c.customer_org}</p>
                  <Pill label={c.status} color="bg-orange-100 text-orange-700" />
                </div>
                <p className="mt-1 text-xs text-gray-600">
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
                  <p className="mt-1 text-xs text-gray-600 font-mono">SN หลัก: {c.parent_serial_number}</p>
                )}
                <p className="mt-1 text-xs text-gray-600 font-mono">SN เคลม: {c.old_serial_number}</p>
                {c.claimed_component_label && (
                  <p className="mt-1 text-xs text-gray-600">ชิ้นที่เคลม: {c.claimed_component_label}</p>
                )}
                <p className="mt-1 text-xs text-gray-600">เหตุขัดข้อง: {c.failure_reason}</p>
                {c.claim_reference && <p className="mt-1 text-xs text-gray-600">Claim Ref: {c.claim_reference}</p>}
                {c.replacement_serial_number && (
                  <p className="mt-1 text-xs text-emerald-700 font-mono">Replacement SN: {c.replacement_serial_number}</p>
                )}
                {c.replacement_job_no && (
                  <p className="mt-1 text-xs text-blue-700">Replacement Job: {c.replacement_job_no}</p>
                )}
                {c.status === "sent_overseas" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_2fr_auto]">
                    <input
                      value={claimReceiveTarget === c.id ? claimReplacementSerial : ""}
                      onFocus={() => onChangeClaimReceiveTarget(c.id)}
                      onChange={(e) => {
                        onChangeClaimReceiveTarget(c.id)
                        onChangeClaimReplacementSerial(e.target.value)
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono"
                      placeholder="New Replacement SN"
                    />
                    <input
                      value={claimReceiveTarget === c.id ? claimReplacementNote : ""}
                      onFocus={() => onChangeClaimReceiveTarget(c.id)}
                      onChange={(e) => {
                        onChangeClaimReceiveTarget(c.id)
                        onChangeClaimReplacementNote(e.target.value)
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                      placeholder="หมายเหตุการรับเข้า"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onReceiveReplacement(
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
      </section>
    </div>
  )
}

// ── From SE Tab ────────────────────────────────────────────────────────────────
function FromSETab({
  requests,
  onRouteToStock,
}: {
  requests: SERequest[]
  onRouteToStock: (r: SERequest) => void
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
      <p className="text-sm text-gray-500">คำขอบริการจาก SE ต้องผ่าน Stock ตาม SOP: ส่งเข้า Stock ก่อน แล้ว Service รับงานจากแท็บ "รับงานจาก Stock"</p>
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
                onClick={() => onRouteToStock(r)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <Send className="h-4 w-4" /> ส่งเข้า Stock
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
function ServiceRequestPageContent() {
  const { profile } = useAuth()
  const actorRole: JobActorRole =
    profile?.role === "admin"
      ? "supervisor"
      : profile?.role === "as_service" || profile?.role === "as_staff"
        ? "service_engineer"
        : "stock_admin"
  const fsm = useJobStateMachine(actorRole)
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<ServiceJob[]>([])
  const [selected, setSelected] = useState<ServiceJob | null>(MOCK_JOBS[0])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all"|JobType>("all")
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด")
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
  const [workflowSettings, setWorkflowSettings] = useState(readASWorkflowSettings())
  const [cancelDialogJob, setCancelDialogJob] = useState<ServiceJob | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelActionPlan, setCancelActionPlan] = useState("")
  const [commissioningFailDialogJob, setCommissioningFailDialogJob] = useState<ServiceJob | null>(null)
  const [commissioningFailReason, setCommissioningFailReason] = useState("")
  const [commissioningFailClaimRef, setCommissioningFailClaimRef] = useState("")
  const [commissioningFailScope, setCommissioningFailScope] = useState<ClaimScopeUI>("whole_unit")
  const [commissioningFailComponentLabel, setCommissioningFailComponentLabel] = useState("")
  const [commissioningFailComponentSerial, setCommissioningFailComponentSerial] = useState("")
  const [commissioningClaimCases, setCommissioningClaimCases] = useState<ASCommissioningClaimCase[]>([])
  const [claimReceiveTarget, setClaimReceiveTarget] = useState<string>("")
  const [claimReplacementSerial, setClaimReplacementSerial] = useState("")
  const [claimReplacementNote, setClaimReplacementNote] = useState("")
  const [partsReqPartName, setPartsReqPartName] = useState("")
  const [partsReqQty, setPartsReqQty] = useState(1)
  const [partsReqNote, setPartsReqNote] = useState("")
  const [myQueueOnly, setMyQueueOnly] = useState<boolean>(profile?.role === "as_service" || profile?.role === "as_staff")
  const [equipmentHistory, setEquipmentHistory] = useState<ASEquipmentHistoryEntry[]>([])
  const [partsRequests, setPartsRequests] = useState<ASPartsRequest[]>([])
  const [offlineQueuedCount, setOfflineQueuedCount] = useState(0)
  const [offlineConflictCount, setOfflineConflictCount] = useState(0)
  const [offlineQueueItems, setOfflineQueueItems] = useState<OfflineMutation[]>([])
  const [transitionError, setTransitionError] = useState<string>("")
  const [vtOxygenStock, setVtOxygenStock] = useState(() => getVTOxygenSensorStockRollup())
  const [stockDropdownConfig, setStockDropdownConfig] = useState(readDropdownConfig())
  // Pilot safety: always try DB first; fallback to local when API/DB is unavailable.
  const useDb = true
  const DB_KEYS = {
    stockDispatches: "as:stock_dispatches",
    repairToCalRequests: "as:repair_to_cal_requests",
    partsRequests: "as:parts_requests",
    commissioningClaimCases: "as:commissioning_claim_cases",
    seIncomingRequests: "as:se_incoming_requests",
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

  useEffect(() => {
    const bootstrap = async () => {
      let loadedJobs = readJobs(MOCK_JOBS)
      if (useDb) {
        try {
          const res = await fetch("/api/as/jobs")
          if (res.ok) {
            const dbJobs = (await res.json()) as ServiceJob[]
            if (dbJobs.length > 0) {
              loadedJobs = dbJobs
              // Hybrid safety: keep localStorage in sync for pages not migrated yet.
              writeJobs(dbJobs)
            } else if (loadedJobs.length > 0) {
              // First-time bootstrap from local to DB.
              await fetch("/api/as/jobs", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ jobs: loadedJobs }),
              })
            }
          }
        } catch {
          // keep local fallback
        }
      }
      const loadedDispatches = readStockDispatches(MOCK_STOCK_DISPATCHES)
      let loadedRepairToCal = readRepairToCalRequests([])
      let loadedPartsReq = readPartsRequests([])
      let loadedClaimCases = readCommissioningClaimCases([])
      let loadedSEReq = readIncomingSERequests(MOCK_SE_REQUESTS)

      if (useDb) {
        const [dbDispatches, dbRepair, dbParts, dbClaims, dbSeReq] = await Promise.all([
          readDbBlob<StockDispatch[]>(DB_KEYS.stockDispatches),
          readDbBlob<RepairToCalRequest[]>(DB_KEYS.repairToCalRequests),
          readDbBlob<ASPartsRequest[]>(DB_KEYS.partsRequests),
          readDbBlob<ASCommissioningClaimCase[]>(DB_KEYS.commissioningClaimCases),
          readDbBlob<SERequest[]>(DB_KEYS.seIncomingRequests),
        ])
        if (Array.isArray(dbDispatches) && dbDispatches.length > 0) {
          setStockDispatches(dbDispatches)
          writeStockDispatches(dbDispatches)
        } else {
          void writeDbBlob(DB_KEYS.stockDispatches, loadedDispatches)
          setStockDispatches(loadedDispatches)
        }
        if (Array.isArray(dbRepair) && dbRepair.length > 0) {
          loadedRepairToCal = dbRepair
          writeRepairToCalRequests(dbRepair)
        } else {
          void writeDbBlob(DB_KEYS.repairToCalRequests, loadedRepairToCal)
        }
        if (Array.isArray(dbParts) && dbParts.length > 0) {
          loadedPartsReq = dbParts
          writePartsRequests(dbParts)
        } else {
          void writeDbBlob(DB_KEYS.partsRequests, loadedPartsReq)
        }
        if (Array.isArray(dbClaims) && dbClaims.length > 0) {
          loadedClaimCases = dbClaims
          writeCommissioningClaimCases(dbClaims)
        } else {
          void writeDbBlob(DB_KEYS.commissioningClaimCases, loadedClaimCases)
        }
        if (Array.isArray(dbSeReq) && dbSeReq.length > 0) {
          loadedSEReq = dbSeReq
          writeIncomingSERequests(dbSeReq)
        } else {
          void writeDbBlob(DB_KEYS.seIncomingRequests, loadedSEReq)
        }
      } else {
        setStockDispatches(loadedDispatches)
      }
      setJobs(loadedJobs)
      setRepairToCalRequests(loadedRepairToCal)
      setPartsRequests(loadedPartsReq)
      setCommissioningClaimCases(loadedClaimCases)
      setSERequests(loadedSEReq)
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
      setWorkflowSettings(readASWorkflowSettings())
      setVtOxygenStock(getVTOxygenSensorStockRollup())
      setStockDropdownConfig(readDropdownConfig())
    }
    void bootstrap()
  }, [useDb])

  useEffect(() => {
    if (!hydrated) return
    writeJobs(jobs)
    if (useDb) {
      void fetch("/api/as/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobs }),
      })
    }
  }, [jobs, hydrated, useDb])

  useEffect(() => {
    if (!hydrated) return
    writeStockDispatches(stockDispatches)
    if (useDb) void writeDbBlob(DB_KEYS.stockDispatches, stockDispatches)
  }, [stockDispatches, hydrated])

  useEffect(() => {
    if (!hydrated) return
    writeCommissioningClaimCases(commissioningClaimCases)
    if (useDb) void writeDbBlob(DB_KEYS.commissioningClaimCases, commissioningClaimCases)
  }, [commissioningClaimCases, hydrated])

  useEffect(() => {
    if (!hydrated || !useDb) return
    void writeDbBlob(DB_KEYS.repairToCalRequests, repairToCalRequests)
  }, [repairToCalRequests, hydrated, useDb])

  useEffect(() => {
    if (!hydrated || !useDb) return
    void writeDbBlob(DB_KEYS.partsRequests, partsRequests)
  }, [partsRequests, hydrated, useDb])

  useEffect(() => {
    if (!hydrated || !useDb) return
    void writeDbBlob(DB_KEYS.seIncomingRequests, seRequests)
  }, [seRequests, hydrated, useDb])

  useEffect(() => {
    if (!hydrated) return
    const sync = () => {
      setStockDispatches(readStockDispatches([]))
      setJobs(readJobs([]))
      setRepairToCalRequests(readRepairToCalRequests([]))
      setPartsRequests(readPartsRequests([]))
      setCommissioningClaimCases(readCommissioningClaimCases([]))
      setSERequests(readIncomingSERequests(MOCK_SE_REQUESTS))
      setWorkflowSettings(readASWorkflowSettings())
      setEquipmentHistory(readEquipmentHistory([]))
      setVtOxygenStock(getVTOxygenSensorStockRollup())
      setStockDropdownConfig(readDropdownConfig())
    }
    const allowedKeys = new Set<string>([
      AS_STORE_KEYS.jobs,
      AS_STORE_KEYS.jobsVersion,
      AS_STORE_KEYS.stockDispatches,
      AS_STORE_KEYS.stockItems,
      AS_STORE_KEYS.stockItemsVersion,
      AS_STORE_KEYS.repairToCalRequests,
      AS_STORE_KEYS.partsRequests,
      AS_STORE_KEYS.commissioningClaimCases,
      AS_STORE_KEYS.seIncomingRequests,
      AS_STORE_KEYS.asWorkflowSettings,
      AS_STORE_KEYS.equipmentHistory,
      AS_STORE_KEYS.dropdownConfig,
      AS_STORE_KEYS.stockItems,
    ])
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && !allowedKeys.has(ev.key)) return
      sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key && !allowedKeys.has(key)) return
      sync()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [hydrated])

  useEffect(() => {
    if (!hydrated || commissioningClaimCases.length === 0) return
    let changed = false
    const next = commissioningClaimCases.map((c) => {
      if (c.status === "closed" || !c.replacement_job_id) return c
      const replacementJob = jobs.find((j) => j.id === c.replacement_job_id)
      if (!replacementJob || replacementJob.status !== "ปิดงาน") return c
      changed = true
      appendEquipmentHistory({
        id: newId("eh"),
        serial_number: c.replacement_serial_number || replacementJob.serial_number,
        model: replacementJob.model,
        customer_org: replacementJob.customer_org,
        job_id: replacementJob.id,
        job_no: replacementJob.job_no,
        event_kind: "claim_cycle_closed",
        status: replacementJob.status,
        message: `Claim cycle closed from old SN ${c.old_serial_number}`,
        created_at: new Date().toISOString(),
      })
      return { ...c, status: "closed" as const, closed_at: new Date().toISOString() }
    })
    if (changed) setCommissioningClaimCases(next)
  }, [hydrated, commissioningClaimCases, jobs])

  useEffect(() => {
    const onOnline = () => {
      const q = readOfflineJobPatches()
      setOfflineQueuedCount(q.length)
      setOfflineQueueItems(q)
      const live = readJobs([])
      const conflicts = q.filter((m) => {
        const job = live.find((j) => j.id === m.payload.job_id)
        if (!job) return true
        if (!m.payload.base_status) return false
        return job.status !== m.payload.base_status
      }).length
      setOfflineConflictCount(conflicts)
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("as-store-updated", onOnline)
    onOnline()
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("as-store-updated", onOnline)
    }
  }, [])

  useEffect(() => {
    if (profile?.role === "as_service" || profile?.role === "as_staff") setMyQueueOnly(true)
  }, [profile?.role])

  function getStatusFlowByJobType(jobType: JobType): ServiceJob["status"][] {
    if (jobType === "commissioning") return ["ในคิว", "กำลังประเมิน", "ปิดงาน"]
    if (jobType === "calibration" || jobType === "preventive_maintenance") {
      const flow = workflowSettings.calibration_statuses || []
      return flow.length > 0 ? flow : workflowSettings.service_statuses
    }
    return workflowSettings.service_statuses.length > 0 ? workflowSettings.service_statuses : STATUS_FLOW
  }

  function upsertProactiveFromCalibration(job: ServiceJob) {
    if (!job.serial_number?.trim()) return
    const assets = readProactiveCalibrationAssets([])
    const key = job.serial_number.trim().toLowerCase()
    const existing = assets.find((a) => a.serial_number.trim().toLowerCase() === key)
    // If customer retired/disposed this SN, stop proactive chain.
    if (existing?.retired_at) return
    const calDate = (job.calibration_date || "").trim()
    if (!calDate) return
    const dueDate = addOneYear(calDate)
    const nextRecord: ASProactiveCalibrationAsset = {
      id: existing?.id || newId("pc-job"),
      customer_org: existing?.customer_org || job.customer_org || "Unknown",
      customer_name: existing?.customer_name || job.customer_name || undefined,
      manufacturer: job.manufacturer || existing?.manufacturer || "—",
      model: job.model || existing?.model || "—",
      serial_number: job.serial_number,
      last_calibration_date: calDate,
      due_date: dueDate,
      note: `Auto-updated from Calibration close (${job.job_no})`,
      created_at: existing?.created_at || new Date().toISOString(),
      retired_at: existing?.retired_at,
      retired_reason: existing?.retired_reason,
    }
    const next = existing ? assets.map((a) => (a.id === existing.id ? nextRecord : a)) : [nextRecord, ...assets]
    writeProactiveCalibrationAssets(next)
  }

  function applyOfflineQueueNow() {
    const q = readOfflineJobPatches()
    if (q.length === 0) return
    flushOfflineJobPatches((jobId, patch) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                ...patch,
                status_logs: [
                  ...(j.status_logs || []),
                  {
                    at: new Date().toISOString(),
                    from: j.status,
                    to: (patch.status as ServiceJob["status"]) || j.status,
                    reason: "Flushed from offline queue",
                  },
                ],
              }
            : j,
        ),
      )
    })
    setOfflineQueuedCount(0)
    setOfflineConflictCount(0)
    setOfflineQueueItems([])
  }

  function discardOfflineQueueNow() {
    clearOfflineJobPatches()
    setOfflineQueuedCount(0)
    setOfflineConflictCount(0)
    setOfflineQueueItems([])
  }

  function applyOfflineQueueItem(itemId: string) {
    const ok = applyOfflineJobPatchById(itemId, (jobId, patch) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                ...patch,
                status_logs: [
                  ...(j.status_logs || []),
                  {
                    at: new Date().toISOString(),
                    from: j.status,
                    to: (patch.status as ServiceJob["status"]) || j.status,
                    reason: "Applied single offline queue item",
                  },
                ],
              }
            : j,
        ),
      )
    })
    if (!ok) return
    const q = readOfflineJobPatches()
    setOfflineQueueItems(q)
    setOfflineQueuedCount(q.length)
    const live = readJobs([])
    const conflicts = q.filter((m) => {
      const job = live.find((j) => j.id === m.payload.job_id)
      if (!job) return true
      if (!m.payload.base_status) return false
      return job.status !== m.payload.base_status
    }).length
    setOfflineConflictCount(conflicts)
  }

  function rejectOfflineQueueItem(itemId: string) {
    const ok = removeOfflineJobPatchById(itemId)
    if (!ok) return
    const q = readOfflineJobPatches()
    setOfflineQueueItems(q)
    setOfflineQueuedCount(q.length)
    const live = readJobs([])
    const conflicts = q.filter((m) => {
      const job = live.find((j) => j.id === m.payload.job_id)
      if (!job) return true
      if (!m.payload.base_status) return false
      return job.status !== m.payload.base_status
    }).length
    setOfflineConflictCount(conflicts)
  }

  const commissioningTabBadge = useMemo(() => {
    const pending = stockDispatches.filter(
      (d) => d.job_type === "commissioning" && !jobs.some((j) => j.source_dispatch_id === d.id),
    ).length
    const open = jobs.filter(
      (j) => isCommissioningTestJob(j) && j.status !== "ปิดงาน" && j.status !== "ยกเลิก",
    ).length
    return pending + open
  }, [stockDispatches, jobs])

  const totalIncoming = stockDispatches.length + seRequests.length + repairToCalRequests.length

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    const matchQueue = !myQueueOnly || !profile?.full_name || (j.technician || "").trim() === profile.full_name.trim()
    return matchQueue &&
      (j.job_no.toLowerCase().includes(q) || j.model.toLowerCase().includes(q) || j.serial_number.toLowerCase().includes(q) || j.customer_org.toLowerCase().includes(q)) &&
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

  function notifyStockJobStatus(job: ServiceJob, toStatus: ServiceJob["status"], reason?: string) {
    if (job.source !== "stock") return
    appendStockNotification({
      id: newId("ntf"),
      kind: "job_status_changed",
      job_id: job.id,
      job_no: job.job_no,
      title: `อัปเดตสถานะ ${job.job_no}`,
      message: `${job.model} · สถานะใหม่: ${toStatus}${reason ? ` · ${reason}` : ""}`,
      created_at: new Date().toISOString(),
    })
  }

  function requestPartsForSelected(job: ServiceJob) {
    const partName = partsReqPartName.trim()
    const qty = Number(partsReqQty)
    if (!partName || !Number.isFinite(qty) || qty <= 0) return
    const req: ASPartsRequest = {
      id: newId("pr"),
      job_id: job.id,
      job_no: job.job_no,
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      requested_by: job.technician?.trim() || "Service Engineer",
      part_name: partName,
      qty,
      note: partsReqNote.trim() || undefined,
      requested_at: new Date().toISOString(),
      status: "pending",
    }
    appendPartsRequest(req)
    appendStockNotification({
      id: newId("ntf"),
      kind: "parts_requested",
      job_id: job.id,
      job_no: job.job_no,
      title: `ขออะไหล่ ${job.job_no}`,
      message: `${req.part_name} x${req.qty} (${job.model})`,
      created_at: new Date().toISOString(),
    })
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      job_id: job.id,
      job_no: job.job_no,
      event_kind: "parts_requested",
      status: "รออะไหล่",
      message: `Request parts: ${req.part_name} x${req.qty}`,
      created_at: new Date().toISOString(),
    })
    const updated: ServiceJob =
      job.status === "รออะไหล่"
        ? job
        : {
            ...job,
            status: "รออะไหล่",
            status_logs: [
              ...(job.status_logs || []),
              { at: new Date().toISOString(), from: job.status, to: "รออะไหล่", reason: `Request parts: ${req.part_name} x${req.qty}` },
            ],
          }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)))
    setSelected(updated)
    setPartsReqPartName("")
    setPartsReqQty(1)
    setPartsReqNote("")
  }

  function escalateSelectedJob(job: ServiceJob) {
    const reason = "Escalate ไปทีมผู้ผลิต/ผู้เชี่ยวชาญ"
    const updated: ServiceJob = {
      ...job,
      status: "ยกเลิก",
      cancellation_reason: reason,
      cancellation_action_plan: "ส่งต่องานให้ทีมผู้ผลิต (Escalated)",
      status_logs: [
        ...(job.status_logs || []),
        { at: new Date().toISOString(), from: job.status, to: "ยกเลิก", reason },
      ],
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)))
    setSelected(updated)
    if (job.source === "stock") {
      appendStockNotification({
        id: newId("ntf"),
        kind: "job_escalated",
        job_id: job.id,
        job_no: job.job_no,
        title: `Escalated ${job.job_no}`,
        message: `${job.model} ถูกส่งต่อไปทีมผู้ผลิต`,
        created_at: new Date().toISOString(),
      })
    }
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      job_id: job.id,
      job_no: job.job_no,
      event_kind: "job_escalated",
      status: "ยกเลิก",
      message: reason,
      created_at: new Date().toISOString(),
    })
  }

  function failCommissioningToRepair(
    job: ServiceJob,
    reasonInput?: string,
    claimRefInput?: string,
    claimOpts?: {
      claim_scope: ClaimScopeUI
      claimed_component_label?: string
      claimed_component_serial?: string
    },
  ) {
    if (!isCommissioningTestJob(job)) return
    const reason = (reasonInput || "").trim()
    if (!reason || !reason.trim()) return
    const scope = claimOpts?.claim_scope ?? "whole_unit"
    const compLabel = (claimOpts?.claimed_component_label || "").trim()
    const compSerial = (claimOpts?.claimed_component_serial || "").trim()
    if (scope !== "whole_unit" && (!compLabel || !compSerial)) return
    const updated: ServiceJob = {
      ...job,
      status: "ยกเลิก",
      fsm_state: "ESCALATED",
      cancellation_reason: reason.trim(),
      cancellation_action_plan: "ส่งกลับ Stock พร้อมเหตุผล",
      stock_return_pending: true,
      status_logs: [
        ...(job.status_logs || []),
        {
          at: new Date().toISOString(),
          from: job.status,
          to: "ยกเลิก",
          reason: `Commissioning failed: ${reason.trim()}`,
        },
      ],
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)))
    setSelected(updated)
    if (job.source === "stock") {
      appendStockNotification({
        id: newId("ntf"),
        kind: "job_failed_commissioning",
        job_id: job.id,
        job_no: job.job_no,
        title: `Commissioning ไม่ผ่าน ${job.job_no}`,
        message: `${job.model} · เหตุผล: ${reason.trim()}`,
        created_at: new Date().toISOString(),
      })
    }
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      job_id: job.id,
      job_no: job.job_no,
      event_kind: "commissioning_failed",
      status: "ยกเลิก",
      message: `Commissioning failed, return to Stock: ${reason.trim()}`,
      created_at: new Date().toISOString(),
    })
    const claimCase: ASCommissioningClaimCase = {
      id: newId("clm"),
      source_job_id: job.id,
      source_job_no: job.job_no,
      customer_org: job.customer_org,
      customer_name: job.customer_name,
      manufacturer: job.manufacturer,
      model: job.model,
      claim_scope: scope,
      parent_serial_number: scope !== "whole_unit" ? job.serial_number : undefined,
      old_serial_number: scope === "whole_unit" ? job.serial_number : compSerial,
      claimed_component_label: scope !== "whole_unit" ? compLabel : undefined,
      failure_reason: reason.trim(),
      claim_reference: claimRefInput?.trim() || undefined,
      status: "sent_overseas",
      failed_at: new Date().toISOString(),
      sent_overseas_at: new Date().toISOString(),
    }
    appendCommissioningClaimCase(claimCase)
    setCommissioningClaimCases((prev) => [claimCase, ...prev.filter((x) => x.id !== claimCase.id)])
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: claimCase.old_serial_number,
      model: job.model,
      customer_org: job.customer_org,
      job_id: job.id,
      job_no: job.job_no,
      event_kind: "claim_overseas_created",
      status: "ยกเลิก",
      message: `Overseas claim (${scope})${claimCase.claim_reference ? ` ${claimCase.claim_reference}` : ""}: ${reason.trim()}${scope !== "whole_unit" ? ` · ${compLabel} SN ${compSerial}` : ""}`,
      created_at: new Date().toISOString(),
    })
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
    notifyStockJobStatus(job, "ยกเลิก", reason.trim())
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: job.serial_number,
      model: job.model,
      customer_org: job.customer_org,
      job_id: job.id,
      job_no: job.job_no,
      event_kind: "job_cancelled",
      status: "ยกเลิก",
      message: `${reason.trim()} | ${actionPlan.trim()}`,
      created_at: new Date().toISOString(),
    })
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineJobPatchWithBaseStatus(
        job.id,
        { status: "ยกเลิก", cancellation_reason: reason.trim(), cancellation_action_plan: actionPlan.trim() },
        job.status,
      )
    }
  }

  function receiveClaimReplacement(claim: ASCommissioningClaimCase, replacementSN: string, note: string) {
    const sn = replacementSN.trim()
    if (!sn) return
    const now = new Date().toISOString()
    const scope = claim.claim_scope ?? "whole_unit"
    const partHint =
      scope !== "whole_unit" && claim.claimed_component_label
        ? ` · ${claim.claimed_component_label}`
        : ""
    const parentHint = claim.parent_serial_number ? ` · parent SN ${claim.parent_serial_number}` : ""
    const replacementDispatch: StockDispatch = {
      id: newId("disp"),
      customer_org: claim.customer_org,
      customer_contact: claim.customer_name || "",
      item_name: `${claim.model} (Replacement Claim)`,
      serial_number: sn,
      job_type: "commissioning",
      symptom: `[CLAIM_CASE:${claim.id}] Replacement from overseas for claimed SN ${claim.old_serial_number}${partHint}${parentHint}. ${claim.failure_reason}`,
      dispatched_by: "Stock Team",
      dispatched_at: now,
    }
    appendStockDispatch(replacementDispatch)
    setStockDispatches((prev) => [replacementDispatch, ...prev.filter((x) => x.id !== replacementDispatch.id)])
    setCommissioningClaimCases((prev) =>
      prev.map((c) =>
        c.id === claim.id
          ? {
              ...c,
              status: "replacement_received",
              replacement_serial_number: sn,
              replacement_dispatch_id: replacementDispatch.id,
              replacement_received_at: now,
              replacement_note: note.trim() || undefined,
            }
          : c,
      ),
    )
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: claim.old_serial_number,
      model: claim.model,
      customer_org: claim.customer_org,
      job_id: claim.source_job_id,
      job_no: claim.source_job_no,
      event_kind: "replacement_received",
      status: "รอประเมิน",
      message: `Replacement received SN ${sn}${note.trim() ? ` · ${note.trim()}` : ""}`,
      created_at: now,
    })
    setClaimReceiveTarget("")
    setClaimReplacementSerial("")
    setClaimReplacementNote("")
  }

  function workflowCanonicalOrder(): ServiceJob["status"][] {
    return workflowSettings.service_statuses.length > 0 ? workflowSettings.service_statuses : STATUS_FLOW
  }

  function canAdvance(job: ServiceJob) {
    if (isCommissioningTestJob(job)) {
      return (
        COMMISSIONING_STATUS_FLOW.includes(job.status) ||
        job.status === "รอประเมิน" ||
        job.status === "กำลังซ่อม" ||
        job.status === "QC" ||
        job.status === "รอส่งคืน"
      ) && job.status !== "ปิดงาน"
    }
    const flow = getStatusFlowByJobType(job.job_type).filter((s) => s !== "ยกเลิก") as ServiceJob["status"][]
    const next = getNextWorkflowStatus(job.status, flow, workflowCanonicalOrder())
    if (!next) return false
    return getTransitionBlockReason(job) == null
  }

  function advanceBlockedHint(job: ServiceJob): string | null {
    if (isCommissioningTestJob(job)) return null
    const flow = getStatusFlowByJobType(job.job_type).filter((s) => s !== "ยกเลิก") as ServiceJob["status"][]
    const next = getNextWorkflowStatus(job.status, flow, workflowCanonicalOrder())
    const gate = getTransitionBlockReason(job)
    if (gate) return gate
    if (!next) {
      return "อยู่ขั้นสุดท้ายของ workflow แล้ว หรือสถานะไม่อยู่ใน flow ประเภทงานนี้ (ตรวจ Settings → Calibration / Service statuses)"
    }
    return null
  }

  function advanceStatus(job: ServiceJob) {
    setTransitionError("")
    if (isCommissioningTestJob(job)) {
      const nextStatus: ServiceJob["status"] =
        job.status === "ในคิว"
          ? "กำลังประเมิน"
          : job.status === "กำลังประเมิน"
            ? "ปิดงาน"
            : job.status === "กำลังซ่อม" || job.status === "QC" || job.status === "รอส่งคืน"
              ? "ปิดงาน"
            : job.status === "รอประเมิน"
              ? "กำลังประเมิน"
              : job.status
      if (nextStatus === job.status) {
        setTransitionError("Commissioning ใช้ flow: ในคิว -> กำลังประเมิน -> ผ่าน")
        return
      }
      const updated: ServiceJob = {
        ...job,
        status: nextStatus,
        fsm_state: nextStatus === "ปิดงาน" ? "COMPLETED" : "IN_PROGRESS",
        stock_return_pending: nextStatus === "ปิดงาน" ? true : job.stock_return_pending,
        status_logs: [
          ...(job.status_logs || []),
          {
            at: new Date().toISOString(),
            from: job.status,
            to: nextStatus,
            reason: `Commissioning flow: ${job.status} -> ${nextStatus}`,
          },
        ],
      }
      // Persist immediately to avoid unrelated store events
      // overriding local optimistic state before save.
      for (let i = 0; i < 3; i += 1) {
        const baseJobs = readJobs([])
        const expectedVer = readJobsVersion()
        const nextJobs = baseJobs.map((j) => (j.id === job.id ? updated : j))
        const wr = writeJobsWithConcurrencyCheck(nextJobs, expectedVer)
        if (!wr.ok) continue
        setJobs(nextJobs)
        setSelected(updated)
        notifyStockJobStatus(job, nextStatus, nextStatus === "ปิดงาน" ? "Commissioning ผ่าน" : "เริ่มประเมิน")
        return
      }
      setTransitionError("บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่")
      return
    }
    const gate = getTransitionBlockReason(job)
    if (gate) {
      setTransitionError(gate)
      return
    }
    const flow = getStatusFlowByJobType(job.job_type).filter((s) => s !== "ยกเลิก") as ServiceJob["status"][]
    const nextStatus = getNextWorkflowStatus(job.status, flow, workflowCanonicalOrder())
    if (!nextStatus) return
    if (
      (job.job_type === "calibration" || job.job_type === "preventive_maintenance") &&
      nextStatus === "ปิดงาน" &&
      !job.calibration_date?.trim()
    ) {
      setTransitionError("งาน Calibration/PM ก่อนปิดงานต้องกรอก Calibration Date เพื่อเชื่อม Proactive")
      return
    }

    const updated: ServiceJob = {
      ...job,
      due_date:
        (job.job_type === "calibration" || job.job_type === "preventive_maintenance") && nextStatus === "ปิดงาน" && job.calibration_date
          ? addOneYear(job.calibration_date)
          : job.due_date,
      status: nextStatus,
      // Keep FSM state for compatibility, but status order comes from Settings.
      fsm_state:
        nextStatus === "ปิดงาน"
          ? "COMPLETED"
          : nextStatus === "ยกเลิก"
            ? "ESCALATED"
            : "IN_PROGRESS",
      stock_return_pending: nextStatus === "ปิดงาน" ? true : job.stock_return_pending,
      status_logs: [
        ...(job.status_logs || []),
        {
          at: new Date().toISOString(),
          from: job.status,
          to: nextStatus,
          reason: `Workflow Settings flow: ${job.status} -> ${nextStatus}`,
        },
      ],
    }

    for (let i = 0; i < 3; i += 1) {
      const baseJobs = readJobs([])
      const expectedVer = readJobsVersion()
      const nextJobs = baseJobs.map((j) => (j.id === job.id ? updated : j))
      const wr = writeJobsWithConcurrencyCheck(nextJobs, expectedVer)
      if (!wr.ok) continue
      if ((updated.job_type === "calibration" || updated.job_type === "preventive_maintenance") && updated.status === "ปิดงาน") {
        upsertProactiveFromCalibration(updated)
      }
      if (nextStatus === "ปิดงาน") applyVTOxygenSensorEffectsOnCalibrationClose(updated)
      setJobs(nextJobs)
      setSelected(updated)
      notifyStockJobStatus(job, nextStatus, `อัปเดตสถานะตาม Settings flow`)
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineJobPatchWithBaseStatus(job.id, { status: nextStatus }, job.status)
      }
      return
    }
    setTransitionError("บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่")
  }

  // Accept dispatched job from Stock → create a new ServiceJob
  function acceptStockDispatch(d: StockDispatch) {
    const liveDispatches = readStockDispatches([])
    const stillPending = liveDispatches.some((x) => x.id === d.id)
    if (!stillPending) return
    const nowIso = new Date().toISOString()
    const today = todayYmdInBangkok()
    const newJob: ServiceJob = {
      id: newId("job"),
      job_no: `JOB-${new Date().getFullYear()}-${newId("n").slice(-6).toUpperCase()}`,
      job_type: d.job_type,
      status: d.job_type === "commissioning" ? "ในคิว" : "รอประเมิน",
      priority: "normal",
      serial_number: d.serial_number,
      manufacturer: d.manufacturer || "—",
      model: d.model || d.item_name,
      received_date: today,
      tracking_in: d.tracking_in?.trim() || "—",
      receive_channel: d.receive_channel ?? "พนักงาน",
      received_by: d.received_by?.trim() || undefined,
      customer_name: d.customer_contact,
      customer_org: d.customer_org,
      routing: (d.routing || "in_country") as Routing,
      symptom_reported: d.symptom,
      requires_approval: true,
      source: "stock",
      source_dispatch_id: d.id,
      stock_item_id: d.stock_item_id,
      due_date: d.due_date,
      status_logs: [
        {
          at: nowIso,
          to: d.job_type === "commissioning" ? "ในคิว" : "รอประเมิน",
          reason: `Accepted from Stock (${d.id})`,
        },
      ],
      created_at: today,
    }

    for (let i = 0; i < 3; i += 1) {
      const baseJobs = readJobs([])
      const alreadyAccepted = baseJobs.some(
      (j) => j.source === "stock" && j.source_dispatch_id === d.id,
      )
      if (alreadyAccepted) {
        const latestDispatches = readStockDispatches([])
        const pruned = latestDispatches.filter((x) => x.id !== d.id)
        writeStockDispatches(pruned)
        setStockDispatches(pruned)
        setJobs(baseJobs)
        return
      }
      const expectedVer = readJobsVersion()
      const nextJobs = [newJob, ...baseJobs]
      const wr = writeJobsWithConcurrencyCheck(nextJobs, expectedVer)
      if (!wr.ok) continue

      const latestDispatches = readStockDispatches([])
      const nextDispatches = latestDispatches.filter((x) => x.id !== d.id)
      writeStockDispatches(nextDispatches)
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
        receive_channel: d.receive_channel,
        tracking_in: d.tracking_in,
        received_by: d.received_by,
        job_type: d.job_type,
        routing: d.routing,
        due_date: d.due_date,
        dispatched_by: d.dispatched_by,
        dispatched_at: d.dispatched_at,
        accepted_at: nowIso,
        service_job_id: newJob.id,
        service_job_no: newJob.job_no,
      })
      setJobs(nextJobs)
      setStockDispatches(nextDispatches)
      setSearch("")
      setFilterType("all")
      setFilterStatus("ทั้งหมด")
      setSelected(newJob)
      setMainTab("jobs")
      const linkedClaim = commissioningClaimCases.find((c) => c.replacement_dispatch_id === d.id)
      if (linkedClaim) {
        setCommissioningClaimCases((prev) =>
          prev.map((c) =>
            c.id === linkedClaim.id
              ? {
                  ...c,
                  status: "replacement_commissioning",
                  replacement_job_id: newJob.id,
                  replacement_job_no: newJob.job_no,
                }
              : c,
          ),
        )
        appendEquipmentHistory({
          id: newId("eh"),
          serial_number: linkedClaim.replacement_serial_number || newJob.serial_number,
          model: newJob.model,
          customer_org: newJob.customer_org,
          job_id: newJob.id,
          job_no: newJob.job_no,
          event_kind: "replacement_commissioning_started",
          status: newJob.status,
          message: `Replacement commissioning started (old SN ${linkedClaim.old_serial_number})`,
          created_at: nowIso,
        })
      }
      const orgs = readOrganizations([])
      writeOrganizations(upsertOrganizationByName(orgs, d.customer_org, d.customer_contact))
      return
    }
  }

  // Accept SE request → create a new ServiceJob
  function routeSERequestToStock(r: SERequest) {
    const serial = r.equipment.includes("SN:") ? r.equipment.split("SN:")[1].trim() : "—"
    const model = r.equipment.split("—")[0].trim() || r.equipment.trim() || "—"
    appendStockDispatch({
      id: newId("dp-se"),
      item_name: model,
      manufacturer: "—",
      model,
      serial_number: serial || "—",
      customer_org: r.customer_org,
      customer_contact: r.requested_by,
      symptom: `[From SE] ${r.issue_description}`,
      receive_channel: "พนักงาน",
      job_type: "repair",
      routing: "in_country",
      dispatched_by: "SE->Stock",
      dispatched_at: new Date().toISOString(),
    })
    setSERequests((prev) => prev.filter((x) => x.id !== r.id))
    removeIncomingSERequest(r.id)
    const orgs = readOrganizations([])
    writeOrganizations(upsertOrganizationByName(orgs, r.customer_org, r.requested_by))
    setMainTab("from_stock")
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
    const today = todayYmdInBangkok()
    const newJob: ServiceJob = {
      id: newId("job"),
      job_no: `JOB-${new Date().getFullYear()}-${newId("n").slice(-6).toUpperCase()}`,
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
      created_at: today,
    }
    for (let i = 0; i < 3; i += 1) {
      const baseJobs = readJobs([])
      const alreadyAccepted = baseJobs.some(
        (j) => j.job_type === "calibration" && j.source_dispatch_id === req.id,
      )
      if (alreadyAccepted) {
        setJobs(baseJobs)
        setRepairToCalRequests((prev) => prev.filter((r) => r.id !== req.id))
        removeRepairToCalRequest(req.id)
        return
      }
      const expectedVer = readJobsVersion()
      const nextJobs = [newJob, ...baseJobs]
      const wr = writeJobsWithConcurrencyCheck(nextJobs, expectedVer)
      if (!wr.ok) continue
      setJobs(nextJobs)
      setRepairToCalRequests((prev) => prev.filter((r) => r.id !== req.id))
      removeRepairToCalRequest(req.id)
      setSearch("")
      setFilterType("all")
      setFilterStatus("ทั้งหมด")
      setSelected(newJob)
      setMainTab("jobs")
      return
    }
  }

  const sel = selected
  const isVTOxygenCalibration =
    !!sel &&
    sel.job_type === "calibration" &&
    !isCommissioningTestJob(sel) &&
    (sel.model || "").toUpperCase().includes("VT")
  const FSM_FLOW: JobFsmState[] = [
    "DRAFT",
    "ISSUED",
    "ASSIGNED",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "COMPLETED",
    "CLOSED",
    "ESCALATED",
  ]
  const LEGACY_PROGRESS_FLOW: ServiceJob["status"][] = (sel ? getStatusFlowByJobType(sel.job_type) : workflowSettings.service_statuses).filter((s) => s !== "ยกเลิก")
  const currentFsmState: JobFsmState = sel?.fsm_state || "ISSUED"
  const oxygenChoicesLocked =
    !!sel &&
    (sel.status === "ปิดงาน" ||
      sel.status === "ยกเลิก" ||
      currentFsmState === "COMPLETED" ||
      currentFsmState === "CLOSED")
  const progressFlow = sel
    ? (LEGACY_PROGRESS_FLOW.length > 0 ? LEGACY_PROGRESS_FLOW : STATUS_FLOW)
    : LEGACY_PROGRESS_FLOW.length > 0
      ? LEGACY_PROGRESS_FLOW
      : STATUS_FLOW
  const selectedJobFlow = sel ? getStatusFlowByJobType(sel.job_type) : workflowSettings.service_statuses
  const technicianOptions = useMemo(() => {
    const base = Array.isArray(stockDropdownConfig.service_technicians) ? stockDropdownConfig.service_technicians : []
    const uniq = new Set(base.map((x) => x.trim()).filter(Boolean))
    const cur = (sel?.technician || "").trim()
    if (cur) uniq.add(cur)
    return [...uniq].sort((a, b) => a.localeCompare(b, "th"))
  }, [sel?.technician, stockDropdownConfig.service_technicians])

  const statusFilterOptions = useMemo(() => {
    if (filterType !== "all") return getStatusFlowByJobType(filterType)
    const merged = jobs.flatMap((j) => getStatusFlowByJobType(j.job_type))
    return Array.from(new Set(merged))
  }, [filterType, jobs, workflowSettings])
  const currentProgressIdx =
    sel == null
      ? 0
      : Math.max(0, getWorkflowProgressIndex(sel.status, progressFlow, workflowCanonicalOrder()))
  const oxygenPickOptions = useMemo(() => getVTOxygenSensorPickOptions(), [vtOxygenStock])

  const proactiveId = searchParams.get("proactive_id")
  const deepLinkJobId = searchParams.get("job_id")
  const deepLinkJobNo = searchParams.get("job_no")

  useEffect(() => {
    if (!proactiveId || jobs.length === 0) return
    const target = jobs.find((j) => j.source === "proactive" && j.source_dispatch_id === proactiveId)
    if (!target) return
    setSelected(target)
    setMainTab("jobs")
  }, [proactiveId, jobs])

  useEffect(() => {
    if (jobs.length === 0) return
    if (!deepLinkJobId && !deepLinkJobNo) return
    const target =
      jobs.find((j) => (deepLinkJobId ? j.id === deepLinkJobId : false)) ||
      jobs.find((j) => (deepLinkJobNo ? j.job_no === deepLinkJobNo : false))
    if (!target) return
    setSelected(target)
    setMainTab("jobs")
  }, [deepLinkJobId, deepLinkJobNo, jobs])

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
          <p className="text-xs text-gray-500 mt-0.5">{jobs.length} งาน · เปิดอยู่ {jobs.filter(j=>j.status!=="ปิดงาน").length}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMyQueueOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${myQueueOnly ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-gray-600 border-gray-200"}`}
          >
            {myQueueOnly ? "My Queue" : "ทุกคิว"}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("from_stock")}
            className="inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold shadow-sm hover:from-blue-600 hover:to-indigo-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            รับงานผ่าน Stock (SOP)
          </button>
        </div>
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

      {offlineQueuedCount > 0 && (
        <div className="glass-panel p-4 rounded-2xl mb-4 border border-indigo-200 bg-indigo-50/60 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-indigo-900 font-semibold flex-1">
              มี offline queue รอ sync {offlineQueuedCount} รายการ
              {offlineConflictCount > 0 && (
                <span className="text-rose-700"> · conflict {offlineConflictCount} รายการ</span>
              )}
            </p>
            <button
              type="button"
              onClick={applyOfflineQueueNow}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
            >
              Apply All
            </button>
            <button
              type="button"
              onClick={discardOfflineQueueNow}
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50"
            >
              Discard All
            </button>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
            {offlineQueueItems.map((m) => {
              const target = jobs.find((j) => j.id === m.payload.job_id)
              const conflict =
                !!m.payload.base_status &&
                !!target &&
                target.status !== m.payload.base_status
              return (
                <div key={m.id} className="bg-white rounded-xl border border-indigo-100 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-gray-500">{m.payload.job_id}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {target?.job_no || "Unknown Job"} · {String(m.payload.patch.status || "patch")}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${conflict ? "text-rose-700" : "text-gray-600"}`}>
                        {conflict
                          ? `Conflict: base ${m.payload.base_status} / current ${target?.status || "missing"}`
                          : `Base: ${m.payload.base_status || "n/a"} / Current: ${target?.status || "n/a"}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => applyOfflineQueueItem(m.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectOfflineQueueItem(m.id)}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-bold hover:bg-gray-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-1.5 p-1.5 glass-panel rounded-2xl mb-5 w-full overflow-x-auto">
        {MAIN_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id)}
            data-active={mainTab === t.id}
            className={`relative shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              mainTab === t.id
                ? "bg-white text-gray-900 border-blue-200 shadow-sm"
                : "bg-transparent text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/70"
            }`}
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
              {([["all","ทั้งหมด"],["repair","Repair"],["preventive_maintenance","PM"],["calibration","Cal"],["commissioning","Comm. Test"]] as ["all"|JobType, string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setFilterType(v)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType===v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{l}</button>
              ))}
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>ทั้งหมด</option>
              {statusFilterOptions.map(s=><option key={s}>{s}</option>)}
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
              <div className="glass-card rounded-3xl p-4">
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
                      {!canAdvance(sel) &&
                        !isCommissioningTestJob(sel) &&
                        (() => {
                          const h = advanceBlockedHint(sel)
                          return h ? <p className="text-xs text-red-500 text-right">{h}</p> : null
                        })()}
                      {transitionError && (
                        <p className="text-xs text-red-500 text-right max-w-[280px]">{transitionError}</p>
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
                  {progressFlow.map((s, i) => (
                    <div
                      key={`${s}-${i}`}
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        i <= currentProgressIdx
                          ? "bg-gradient-to-r from-sky-500 to-violet-500 premium-pulse"
                          : "bg-gray-200"
                      }`}
                      title={s}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">เริ่ม</span>
                  <span className="text-xs text-gray-400">ปิดงาน</span>
                </div>
              </div>

              {/* Equipment Card */}
              <div className="glass-card rounded-3xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Equipment</p>
                  {(() => {
                    const visual = fsm.getStateVisual((sel.fsm_state || "ISSUED") as JobFsmState)
                    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${visual.className}`}>{visual.label}</span>
                  })()}
                </div>
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
                    <p className="text-[11px] text-gray-400 mb-0.5">วันที่รับ</p>
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{formatThDateFromYMD(sel.received_date)}</p>
                    <p className="text-[9px] text-gray-400 font-mono leading-none mt-px" title="เก็บในระบบเป็น ค.ศ.">
                      {sel.received_date}
                    </p>
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
              <div className="glass-card rounded-3xl p-4">
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
              <div className="glass-card rounded-3xl p-4 space-y-2">
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
                {isVTOxygenCalibration && (
                  <div className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50 space-y-2">
                    <p className="text-xs font-semibold text-indigo-700">
                      Calibration กลุ่ม VT: เลือกสถานะ Oxygen Sensor (ใช้ปิดงาน + Oxygen History)
                    </p>
                    <div className="rounded-xl border border-indigo-100 bg-white/90 px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1.5 min-w-0">
                          <Package className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                          <span className="truncate">สต๊อก Oxygen Sensor (VT) — sync กับหน้า Stock</span>
                        </span>
                        <Link
                          href="/as/stock"
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0"
                        >
                          ไป Stock
                        </Link>
                      </div>
                      <p
                        className={`text-sm font-black tabular-nums ${
                          vtOxygenStock.hasAvailable ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        คงเหลือรวม {vtOxygenStock.totalQty} ชิ้น
                      </p>
                      {vtOxygenStock.lines.length > 0 ? (
                        <ul className="text-[10px] text-gray-600 space-y-0.5 max-h-20 overflow-y-auto pr-0.5">
                          {vtOxygenStock.lines.map((l) => (
                            <li key={l.id} className="flex justify-between gap-2">
                              <span className="truncate min-w-0" title={`${l.name} ${l.model || ""}`}>
                                {l.name}
                                {l.model ? ` · ${l.model}` : ""}
                              </span>
                              <span
                                className={`font-mono shrink-0 tabular-nums ${l.qty <= 0 ? "text-rose-600" : "text-gray-800"}`}
                              >
                                {l.qty}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[10px] text-gray-500 leading-snug">
                          ยังไม่มีรายการในสต๊อกที่ตรงกฎ (ชื่อ/model ต้องมี oxygen + sensor และ vt / vt650 / vt900)
                        </p>
                      )}
                      {sel.vt_oxygen_sensor_action === "replaced" && !vtOxygenStock.hasAvailable && !oxygenChoicesLocked && (
                        <p className="text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                          ยังปิดงานไม่ได้: เลือก &quot;เปลี่ยน&quot; ต้องมีสต๊อกอย่างน้อย 1 ชิ้น (ระบบจะตัดอัตโนมัติตอน COMPLETED)
                        </p>
                      )}
                    </div>
                    {oxygenChoicesLocked ? (
                      <div className="rounded-xl border border-indigo-100 bg-white/80 px-3 py-2 space-y-1.5 text-xs text-gray-800">
                        <p className="font-semibold text-indigo-900">บันทึก Oxygen (ล็อกแล้ว — งานปิด/จบแล้ว)</p>
                        <p>
                          <span className="text-gray-500">สถานะ:</span>{" "}
                          {sel.vt_oxygen_sensor_action === "replaced"
                            ? "เปลี่ยน"
                            : sel.vt_oxygen_sensor_action === "no_change"
                              ? "ไม่เปลี่ยน"
                              : "— (อิงข้อความเดิม)"}
                        </p>
                        {sel.vt_oxygen_sensor_action === "replaced" && (
                          <>
                            {sel.vt_oxygen_stock_item_id && (
                              <p className="text-[10px] text-gray-600 leading-snug">
                                สต๊อก:{" "}
                                {oxygenPickOptions.find((o) => o.stockItemId === sel.vt_oxygen_stock_item_id)?.label ??
                                  sel.vt_oxygen_stock_item_id}
                              </p>
                            )}
                            {(sel.oxygen_sensor_serial || "").trim() !== "" && (
                              <p className="font-mono text-[11px]">SN: {sel.oxygen_sensor_serial}</p>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!vtOxygenStock.hasAvailable}
                            onClick={() =>
                              updateSelected({
                                vt_oxygen_sensor_action: "replaced",
                                vt_oxygen_stock_item_id: undefined,
                                oxygen_sensor_serial: "",
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              sel.vt_oxygen_sensor_action === "replaced"
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            เปลี่ยน Oxygen Sensor
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateSelected({
                                vt_oxygen_sensor_action: "no_change",
                                oxygen_sensor_serial: "",
                                vt_oxygen_stock_item_id: undefined,
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                              sel.vt_oxygen_sensor_action === "no_change"
                                ? "bg-slate-700 border-slate-700 text-white"
                                : "bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            ไม่เปลี่ยน Oxygen Sensor
                          </button>
                        </div>
                        {sel.vt_oxygen_sensor_action === "replaced" && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-indigo-800 mb-1">
                                เลือกรายการจากสต๊อกที่จะตัดจ่าย *
                              </label>
                              <select
                                value={sel.vt_oxygen_stock_item_id ?? ""}
                                onChange={(e) => {
                                  const id = e.target.value
                                  const opt = oxygenPickOptions.find((o) => o.stockItemId === id)
                                  updateSelected({
                                    vt_oxygen_stock_item_id: id || undefined,
                                    oxygen_sensor_serial: opt?.serialFromStock ?? "",
                                  })
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-sm bg-white"
                              >
                                <option value="">— เลือกแถวสต๊อก —</option>
                                {oxygenPickOptions.map((o) => (
                                  <option key={o.stockItemId} value={o.stockItemId}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                                ระบบตัด 1 ชิ้นจากแถวนี้ตอน COMPLETED — SN ดึงจากสต๊อกถ้ามี
                              </p>
                            </div>
                            {(() => {
                              const pick = oxygenPickOptions.find((o) => o.stockItemId === sel.vt_oxygen_stock_item_id)
                              if (!pick) return null
                              if (pick.serialFromStock) {
                                return (
                                  <div className="rounded-lg bg-indigo-50/80 border border-indigo-100 px-3 py-2">
                                    <p className="text-[10px] text-indigo-800 font-semibold mb-0.5">SN จากสต๊อก</p>
                                    <p className="font-mono text-sm text-indigo-950">{pick.serialFromStock}</p>
                                  </div>
                                )
                              }
                              return (
                                <div>
                                  <label className="block text-[11px] font-semibold text-indigo-800 mb-1">
                                    SN บนเซนเซอร์จริง (กรอกเมื่อแถวสต๊อกไม่ลง SN รายชิ้น)
                                  </label>
                                  <input
                                    value={sel.oxygen_sensor_serial ?? ""}
                                    onChange={(e) => updateSelected({ oxygen_sensor_serial: e.target.value })}
                                    placeholder="หลังติดตั้ง — บันทึกลง Oxygen History"
                                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-sm bg-white font-mono"
                                  />
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        {!sel.vt_oxygen_sensor_action && (
                          <p className="text-[10px] text-indigo-600/90">
                            งานเก่าที่ยังไม่เลือก: ระบบยังอ่านจากข้อความใน &quot;ผลการวิเคราะห์&quot; / &quot;วิธีแก้ไข&quot; ได้ตามเดิม
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
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
                  <select
                    value={sel.technician || ""}
                    onChange={(e) => updateSelected({ technician: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="">ผู้รับผิดชอบ / Technician</option>
                    {technicianOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <input
                    value={sel.customer_name || ""}
                    readOnly
                    placeholder="ผู้ติดต่อลูกค้า"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-600"
                  />
                </div>
              </div>
              <div className="glass-card rounded-3xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Parts Request</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={partsReqPartName}
                    onChange={(e) => setPartsReqPartName(e.target.value)}
                    placeholder="ชื่ออะไหล่ที่ต้องการ"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  />
                  <input
                    type="number"
                    min={1}
                    value={partsReqQty}
                    onChange={(e) => setPartsReqQty(Math.max(1, Number(e.target.value || 1)))}
                    placeholder="จำนวน"
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => requestPartsForSelected(sel)}
                    className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600"
                  >
                    ขออะไหล่ไป Stock
                  </button>
                </div>
                <input
                  value={partsReqNote}
                  onChange={(e) => setPartsReqNote(e.target.value)}
                  placeholder="หมายเหตุ (optional)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                />
              </div>
              {sel.cancellation_reason && (
                <div className="glass-card rounded-3xl p-4 space-y-2">
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
                <div className="glass-card rounded-3xl p-4">
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
              <div className="glass-card rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Asset History (by Serial)</p>
                  <Link
                    href={`/as/oxygen-history?q=${encodeURIComponent(sel.serial_number)}`}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    เปิด Oxygen History
                  </Link>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-auto">
                  {equipmentHistory
                    .filter((e) => e.serial_number === sel.serial_number)
                    .slice(0, 20)
                    .map((e) => (
                      <div key={e.id} className="text-xs text-gray-600 border border-gray-100 rounded-xl px-3 py-2">
                        <span className="font-semibold">{formatThDateTime(e.created_at)}</span> · {e.event_kind}
                        {" · "}
                        {e.message}
                      </div>
                    ))}
                  {equipmentHistory.filter((e) => e.serial_number === sel.serial_number).length === 0 && (
                    <p className="text-xs text-gray-400">ยังไม่มีประวัติสำหรับ SN นี้</p>
                  )}
                </div>
              </div>

              {sel.job_type === "repair" && sel.status === "รอส่งคืน" && !repairToCalRequests.some((r) => r.source_job_id === sel.id) && (
                <div className="glass-card rounded-3xl p-4 space-y-2">
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
              <div className="glass-card rounded-3xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Escalation / Failure Loop</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => escalateSelectedJob(sel)}
                    className="py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-bold hover:bg-rose-100"
                  >
                    Escalate กลับ Stock/Vendor
                  </button>
                  {isCommissioningTestJob(sel) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCommissioningFailReason("")
                        setCommissioningFailClaimRef("")
                        setCommissioningFailDialogJob(sel)
                      }}
                      className="py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm font-bold hover:bg-amber-100"
                    >
                      Commissioning ไม่ผ่าน {"->"} ส่งกลับ Stock
                    </button>
                  )}
                </div>
              </div>
              {(() => {
                const linked = partsRequests
                  .filter((r) => r.job_id === sel.id)
                  .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1))
                if (linked.length === 0) return null
                const latest = linked[0]
                const statusStyle =
                  latest.status === "fulfilled"
                    ? "bg-emerald-100 text-emerald-700"
                    : latest.status === "approved"
                      ? "bg-blue-100 text-blue-700"
                      : latest.status === "rejected"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                const statusLabel =
                  latest.status === "fulfilled"
                    ? "Stock จ่ายอะไหล่แล้ว"
                    : latest.status === "approved"
                      ? "Stock อนุมัติแล้ว (รอจ่าย)"
                      : latest.status === "rejected"
                        ? "Stock ปฏิเสธคำขอ"
                        : "รอ Stock อนุมัติ"
                return (
                  <div className="glass-card rounded-3xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Stock Approval Status</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-700">
                        คำขออะไหล่ล่าสุด: <span className="font-semibold">{latest.part_name} x{latest.qty}</span>
                      </p>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${statusStyle}`}>{statusLabel}</span>
                    </div>
                    <div>
                      {(() => {
                        const step =
                          latest.status === "pending"
                            ? 0
                            : latest.status === "approved"
                              ? 1
                              : latest.status === "fulfilled"
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
                            {latest.status === "rejected" && (
                              <p className="text-[10px] text-rose-600 mt-1 font-semibold">Rejected</p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <div className="space-y-0.5">
                      {latest.approved_at && <p className="text-[10px] text-gray-500">Approved at: {formatThDateTime(latest.approved_at)}</p>}
                      {latest.fulfilled_at && <p className="text-[10px] text-gray-500">Fulfilled at: {formatThDateTime(latest.fulfilled_at)}</p>}
                    </div>
                  </div>
                )
              })()}
              {profile?.role === "admin" && (
                <div className="glass-card rounded-3xl p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">FSM Transitions (Admin Debug)</p>
                  <p className="text-[10px] text-gray-500">สำหรับตรวจสอบ transition rule เท่านั้น</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {fsm.getAvailableTransitions(sel).map((t) => (
                      <button
                        key={`${t.from}-${t.to}`}
                        type="button"
                        onClick={() => {
                          setTransitionError("")
                          const res = fsm.transitionJobState(sel.id, t.to)
                          if (!res.ok) {
                            const reason = res.reason || "ไม่สามารถเปลี่ยนสถานะได้"
                            setTransitionError(reason)
                            console.warn(reason)
                            return
                          }
                          const live = readJobs([])
                          const updated = live.find((j) => j.id === sel.id) || null
                          setJobs(live)
                          setSelected(updated)
                        }}
                        className="py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        {t.from} {"->"} {t.to}
                      </button>
                    ))}
                    {fsm.getAvailableTransitions(sel).length === 0 && (
                      <p className="text-xs text-gray-400">ไม่มี transition ที่ role นี้ทำได้</p>
                    )}
                  </div>
                </div>
              )}

              {/* Quotation */}
              {!isCommissioningTestJob(sel) &&
                (selectedJobFlow.indexOf(sel.status) >= Math.max(0, selectedJobFlow.indexOf("รอ Quotation Approve")) ||
                  sel.status === "รอ Quotation Approve" ||
                  sel.status === "รอ PO" ||
                  sel.status === "ในคิว" ||
                  sel.status === "กำลังซ่อม" ||
                  sel.status === "รออะไหล่" ||
                  sel.status === "QC" ||
                  sel.status === "รอส่งคืน" ||
                  sel.status === "ปิดงาน") && (
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
                    <div>
                      <input
                        type="date"
                        value={sel.calibration_date || ""}
                        onChange={(e) => updateSelected({ calibration_date: e.target.value, due_date: addOneYear(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                      />
                      <p className="text-[10px] text-gray-500 mt-1 leading-snug">{thDateInputBeHint(sel.calibration_date)}</p>
                    </div>
                    <div>
                      <div className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 min-h-[38px] flex flex-col justify-center gap-px">
                        <span className="text-[10px] text-gray-500 leading-tight">ครบกำหนดสอบเทียบถัดไป (+1 ปี)</span>
                        <span className="text-xs font-medium text-gray-900 leading-tight">{formatThDateFromYMD(sel.due_date)}</span>
                        {sel.due_date && (
                          <span className="text-[9px] text-gray-400 font-mono leading-none">{sel.due_date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Close */}
              {(currentFsmState === "COMPLETED" || currentFsmState === "CLOSED" || sel.status === "รอส่งคืน") && (
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
            claimCases={commissioningClaimCases}
            claimReceiveTarget={claimReceiveTarget}
            claimReplacementSerial={claimReplacementSerial}
            claimReplacementNote={claimReplacementNote}
            onChangeClaimReceiveTarget={setClaimReceiveTarget}
            onChangeClaimReplacementSerial={setClaimReplacementSerial}
            onChangeClaimReplacementNote={setClaimReplacementNote}
            onReceiveReplacement={receiveClaimReplacement}
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
          <FromSETab requests={seRequests} onRouteToStock={routeSERequestToStock} />
        </div>
      )}

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
      {commissioningFailDialogJob && (
        <CommissioningFailDialog
          job={commissioningFailDialogJob}
          reason={commissioningFailReason}
          claimRef={commissioningFailClaimRef}
          claimScope={commissioningFailScope}
          componentLabel={commissioningFailComponentLabel}
          componentSerial={commissioningFailComponentSerial}
          onReasonChange={setCommissioningFailReason}
          onClaimRefChange={setCommissioningFailClaimRef}
          onClaimScopeChange={setCommissioningFailScope}
          onComponentLabelChange={setCommissioningFailComponentLabel}
          onComponentSerialChange={setCommissioningFailComponentSerial}
          onClose={() => {
            setCommissioningFailDialogJob(null)
            setCommissioningFailReason("")
            setCommissioningFailClaimRef("")
            setCommissioningFailScope("whole_unit")
            setCommissioningFailComponentLabel("")
            setCommissioningFailComponentSerial("")
          }}
          onConfirm={() => {
            failCommissioningToRepair(commissioningFailDialogJob, commissioningFailReason, commissioningFailClaimRef, {
              claim_scope: commissioningFailScope,
              claimed_component_label: commissioningFailComponentLabel,
              claimed_component_serial: commissioningFailComponentSerial,
            })
            setCommissioningFailDialogJob(null)
            setCommissioningFailReason("")
            setCommissioningFailClaimRef("")
            setCommissioningFailScope("whole_unit")
            setCommissioningFailComponentLabel("")
            setCommissioningFailComponentSerial("")
          }}
        />
      )}
    </div>
  )
}

export default function ServiceRequestPage() {
  return (
    <Suspense fallback={<div className="p-1 text-sm text-gray-500">Loading service requests...</div>}>
      <ServiceRequestPageContent />
    </Suspense>
  )
}
