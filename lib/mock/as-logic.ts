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

/** Merge admin order with defaults so statuses omitted from Settings still have a sort key. */
function buildMergeCanonical(canonicalOrder: ASServiceJob["status"][]): ASServiceJob["status"][] {
  const out: ASServiceJob["status"][] = []
  const seen = new Set<string>()
  for (const s of [...canonicalOrder, ...STATUS_FLOW]) {
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/**
 * Next status in `activeFlow`, or — if current status is missing from that flow (e.g. Cal workflow
 * skips "รอ PO" but the job still has that status) — the first step in `activeFlow` that comes
 * after `jobStatus` in merged canonical order (Settings service list + STATUS_FLOW).
 */
export function getNextWorkflowStatus(
  jobStatus: ASServiceJob["status"],
  activeFlow: ASServiceJob["status"][],
  canonicalOrder: ASServiceJob["status"][],
): ASServiceJob["status"] | undefined {
  const flow = activeFlow.filter((s) => s !== "ยกเลิก")
  const idx = flow.findIndex((x) => x === jobStatus)
  if (idx >= 0) {
    if (idx < flow.length - 1) return flow[idx + 1]
    return undefined
  }
  const merge = buildMergeCanonical(canonicalOrder.filter((s) => s !== "ยกเลิก"))
  const canonIdx = merge.indexOf(jobStatus)
  if (canonIdx < 0) return undefined
  let bestIdx = Infinity
  let best: ASServiceJob["status"] | undefined
  for (const s of flow) {
    const ci = merge.indexOf(s)
    if (ci > canonIdx && ci < bestIdx) {
      bestIdx = ci
      best = s
    }
  }
  return best
}

/** Progress bar index when `displayFlow` is a shortened Cal/PM list but job may sit on a repair-only status. */
export function getWorkflowProgressIndex(
  jobStatus: ASServiceJob["status"],
  displayFlow: ASServiceJob["status"][],
  canonicalOrder: ASServiceJob["status"][],
): number {
  const flow = displayFlow.filter((s) => s !== "ยกเลิก")
  const direct = flow.findIndex((x) => x === jobStatus)
  if (direct >= 0) return direct
  if (jobStatus === "ยกเลิก") return 0
  const merge = buildMergeCanonical(canonicalOrder.filter((s) => s !== "ยกเลิก"))
  const sj = merge.indexOf(jobStatus)
  if (sj < 0) return Math.max(0, flow.length - 1)
  let best = 0
  for (let i = 0; i < flow.length; i++) {
    const pi = merge.indexOf(flow[i])
    if (pi >= 0 && pi <= sj) best = i
  }
  return best
}

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
