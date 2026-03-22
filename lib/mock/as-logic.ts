import type { ASServiceJob } from "@/lib/mock/as-store"

export const STATUS_FLOW: ASServiceJob["status"][] = [
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
]

export function getTransitionBlockReason(job: ASServiceJob): string | null {
  if (job.status === "กำลังประเมิน" && !job.symptom_actual) {
    return "ต้องกรอกผลการวิเคราะห์ก่อนออกจากขั้นประเมิน"
  }
  if (job.status === "รอ Quotation Approve" && job.requires_approval && !job.quotation_approved) {
    return "ต้องอนุมัติ Quotation ก่อน"
  }
  if (job.status === "รอ PO" && !job.po_number) {
    return "ต้องกรอก PO Number ก่อน"
  }
  if (job.status === "กำลังซ่อม" && !job.fix_method) {
    return "ต้องกรอกวิธีแก้ไขก่อนส่งต่อขั้นถัดไป"
  }
  if (job.status === "QC" && !job.technician) {
    return "ต้องระบุผู้รับผิดชอบก่อนผ่าน QC"
  }
  if (job.status === "รอส่งคืน" && (!job.tracking_out || !job.invoice_no)) {
    return "ต้องกรอก Tracking ออกและ Invoice ก่อนปิดงาน"
  }
  return null
}

export function getSlaLimitDays(job: ASServiceJob) {
  if (job.routing === "overseas") return 60
  if (job.job_type === "calibration") return 30
  if (job.job_type === "commissioning") return 14
  return 14
}

export function getAgingDays(job: ASServiceJob) {
  const created = new Date(job.created_at)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function getSlaState(job: ASServiceJob): "ok" | "warning" | "overdue" {
  if (job.status === "ปิดงาน") return "ok"
  const limit = getSlaLimitDays(job)
  const age = getAgingDays(job)
  if (age > limit) return "overdue"
  if (age >= Math.floor(limit * 0.8)) return "warning"
  return "ok"
}

export function getCalibrationAlertLevel(job: ASServiceJob): "none" | "3m" | "1m" | "expired" {
  if (job.job_type !== "calibration" || !job.due_date) return "none"
  const due = new Date(job.due_date)
  const now = new Date()
  const months = (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth())
  if (due.getTime() < now.getTime()) return "expired"
  if (months <= 1) return "1m"
  if (months <= 3) return "3m"
  return "none"
}
