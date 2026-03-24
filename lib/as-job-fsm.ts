"use client"

import { newId } from "@/lib/new-id"
import {
  appendOxygenSensorHistory,
  appendEquipmentHistory,
  appendStockNotification,
  readJobs,
  readJobsVersion,
  readOxygenSensorHistory,
  readStockItems,
  type ASServiceJob,
  type ASStockSnapshotItem,
  writeStockItems,
  writeJobsWithConcurrencyCheck,
} from "@/lib/mock/as-store"

export type JobFsmState =
  | "DRAFT"
  | "ISSUED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "COMPLETED"
  | "CLOSED"
  | "ESCALATED"

export type JobActorRole = "stock_admin" | "service_engineer" | "supervisor"

type TransitionRule = {
  from: JobFsmState
  to: JobFsmState
  roles: JobActorRole[]
  required: Array<keyof NonNullable<ASServiceJob["service_log"]> | "assigned_engineer">
  notify: {
    kind: "job_status_changed" | "job_escalated" | "job_failed_commissioning"
    to: "stock"
    title: string
  }
}

export const JOB_FSM_TRANSITIONS: TransitionRule[] = [
  { from: "DRAFT", to: "ISSUED", roles: ["stock_admin"], required: [], notify: { kind: "job_status_changed", to: "stock", title: "ออกใบงานแล้ว" } },
  { from: "ISSUED", to: "ASSIGNED", roles: ["stock_admin", "supervisor"], required: [], notify: { kind: "job_status_changed", to: "stock", title: "มอบหมายช่างแล้ว" } },
  { from: "ASSIGNED", to: "IN_PROGRESS", roles: ["service_engineer", "supervisor"], required: [], notify: { kind: "job_status_changed", to: "stock", title: "เริ่มดำเนินงาน" } },
  { from: "IN_PROGRESS", to: "WAITING_PARTS", roles: ["service_engineer", "supervisor"], required: ["findings"], notify: { kind: "job_status_changed", to: "stock", title: "รออะไหล่" } },
  { from: "WAITING_PARTS", to: "IN_PROGRESS", roles: ["stock_admin", "service_engineer", "supervisor"], required: [], notify: { kind: "job_status_changed", to: "stock", title: "อะไหล่พร้อม ดำเนินงานต่อ" } },
  { from: "IN_PROGRESS", to: "COMPLETED", roles: ["service_engineer", "supervisor"], required: ["technician_name", "findings"], notify: { kind: "job_status_changed", to: "stock", title: "งานเสร็จแล้ว" } },
  { from: "COMPLETED", to: "CLOSED", roles: ["stock_admin", "supervisor"], required: [], notify: { kind: "job_status_changed", to: "stock", title: "ปิดงานสมบูรณ์" } },
  { from: "COMPLETED", to: "ESCALATED", roles: ["supervisor"], required: ["test_result", "findings"], notify: { kind: "job_escalated", to: "stock", title: "งานถูก escalate" } },
]

function inferFsmState(job: ASServiceJob): JobFsmState {
  // Prefer legacy status mapping first to avoid stale `fsm_state`
  // blocking transitions after older data migrations.
  if (job.status === "ยกเลิก") return "ESCALATED"
  if (job.status === "ปิดงาน") return job.stock_return_pending ? "COMPLETED" : "CLOSED"
  if (job.status === "รออะไหล่") return "WAITING_PARTS"
  if (job.status === "กำลังซ่อม" || job.status === "QC" || job.status === "รอส่งคืน") return "IN_PROGRESS"
  if (job.assigned_engineer || job.technician) return "ASSIGNED"
  if (job.fsm_state) return job.fsm_state
  return "ISSUED"
}

function hasRequiredData(job: ASServiceJob, required: TransitionRule["required"]): boolean {
  for (const field of required) {
    if (field === "assigned_engineer") {
      // Backward compatibility: older UI stores engineer in `technician`.
      if (!(job.assigned_engineer?.trim() || job.technician?.trim())) return false
      continue
    }
    const value = job.service_log?.[field]
    if (value != null && String(value).trim() !== "") continue

    // Backward compatibility with existing Service Request fields.
    if (field === "technician_name" && job.technician?.trim()) continue
    if (field === "findings" && (job.service_log?.findings?.trim() || job.symptom_actual?.trim())) continue
    if (field === "parts_replaced" && (job.service_log?.parts_replaced?.trim() || job.fix_method?.trim())) continue
    if (field === "service_date" && (job.service_log?.service_date?.trim() || job.received_date?.trim())) continue
    if (field === "next_service_due_date" && (job.service_log?.next_service_due_date?.trim() || job.due_date?.trim())) continue
    if (field === "test_result" && job.service_log?.test_result?.trim()) continue

    return false
  }
  return true
}

function hasOxygenConditionText(job: ASServiceJob): boolean {
  const text = `${job.service_log?.parts_replaced || ""} ${job.fix_method || ""} ${job.service_log?.findings || ""} ${job.symptom_actual || ""}`.toLowerCase()
  const hasOxygenWord = text.includes("oxygen") || text.includes("ออกซิเจน")
  const hasNoChangeWord =
    text.includes("ไม่เปลี่ยน") ||
    text.includes("ไม่ต้องเปลี่ยน") ||
    text.includes("no change") ||
    text.includes("not changed") ||
    text.includes("ไม่ต้องเปลี่ยน oxygen") ||
    text.includes("oxygen ปกติ")
  return hasOxygenWord && hasNoChangeWord
}

function isVTFamilyModel(model: string): boolean {
  return model.trim().toUpperCase().includes("VT")
}

function isCommissioningLike(job: ASServiceJob): boolean {
  const symptom = (job.symptom_reported || "").toLowerCase()
  return (
    job.job_type === "commissioning" ||
    symptom.includes("commissioning") ||
    symptom.includes("ก่อนเข้า stock") ||
    symptom.includes("pending qc")
  )
}

function oxygenText(job: ASServiceJob): string {
  return `${job.service_log?.parts_replaced || ""} ${job.fix_method || ""} ${job.service_log?.findings || ""} ${job.symptom_actual || ""}`.toLowerCase()
}

function hasOxygenReplacementText(job: ASServiceJob): boolean {
  const text = oxygenText(job)
  const hasOxygenWord = text.includes("oxygen sensor") || text.includes("oxygen") || text.includes("ออกซิเจน")
  const hasReplaceWord = text.includes("replace") || text.includes("เปลี่ยน")
  const hasNegation = text.includes("ไม่เปลี่ยน") || text.includes("ไม่ต้องเปลี่ยน") || text.includes("no change")
  return hasOxygenWord && hasReplaceWord && !hasNegation
}

function hasOxygenNoChangeText(job: ASServiceJob): boolean {
  const text = oxygenText(job)
  const hasOxygenWord = text.includes("oxygen") || text.includes("ออกซิเจน")
  const hasNoChangeWord =
    text.includes("ไม่เปลี่ยน") ||
    text.includes("ไม่ต้องเปลี่ยน") ||
    text.includes("no change") ||
    text.includes("not changed") ||
    text.includes("oxygen ปกติ")
  return hasOxygenWord && hasNoChangeWord
}

/** ค่าเลือกในฟอร์มชนะการไล่ข้อความ; งานเก่าไม่มีฟิลด์ยังใช้ heuristics เดิม */
function getVTOxygenSensorDecision(job: ASServiceJob): { replaced: boolean; noChange: boolean } {
  const a = job.vt_oxygen_sensor_action
  if (a === "replaced") return { replaced: true, noChange: false }
  if (a === "no_change") return { replaced: false, noChange: true }
  return {
    replaced: hasOxygenReplacementText(job),
    noChange: hasOxygenNoChangeText(job),
  }
}

/** กฎเดียวกับการหักสต๊อกตอนปิดงาน VT + เปลี่ยน O₂ — ใช้ซิงก์กับหน้า Service */
export function isVTOxygenSensorStockLine(i: ASStockSnapshotItem): boolean {
  const name = `${i.name || ""} ${i.model || ""}`.toLowerCase()
  return name.includes("oxygen") && name.includes("sensor") && (name.includes("vt") || name.includes("vt650") || name.includes("vt900"))
}

export function getVTOxygenSensorStockRollup(): {
  totalQty: number
  lines: { id: string; name: string; model?: string; qty: number }[]
  hasAvailable: boolean
} {
  const items = readStockItems([])
  const lines = items.filter(isVTOxygenSensorStockLine).map((i) => ({
    id: i.id,
    name: (i.name || "—").trim(),
    model: i.model?.trim(),
    qty: Math.max(0, Math.floor(Number(i.qty) || 0)),
  }))
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  return { totalQty, lines, hasAvailable: lines.some((l) => l.qty > 0) }
}

export type VTOxygenStockPickOption = {
  stockItemId: string
  /** SN จากแถวสต๊อก (ว่าง = รายการนับจำนวน ไม่ลง SN รายชิ้น) */
  serialFromStock: string
  label: string
}

/** รายการที่เลือกตัดได้ (qty &gt; 0) — ใช้ใน UI Service */
export function getVTOxygenSensorPickOptions(): VTOxygenStockPickOption[] {
  const items = readStockItems([])
  const out: VTOxygenStockPickOption[] = []
  for (const i of items) {
    if (!isVTOxygenSensorStockLine(i) || i.qty <= 0) continue
    const name = (i.name || "—").trim()
    const model = i.model?.trim()
    const sn = (i.serial_number || "").trim()
    const base = `${name}${model ? ` · ${model}` : ""}`
    if (sn) {
      out.push({
        stockItemId: i.id,
        serialFromStock: sn,
        label: `${base} · SN ${sn} (คงเหลือ ${i.qty})`,
      })
    } else {
      out.push({
        stockItemId: i.id,
        serialFromStock: "",
        label: `${base} · ไม่มี SN รายชิ้น (คงเหลือ ${i.qty})`,
      })
    }
  }
  return out
}

function findOxygenSensorStockItem() {
  const items = readStockItems([])
  return items.filter((i) => i.qty > 0).find(isVTOxygenSensorStockLine) || null
}

function validateDomainCompletionRules(job: ASServiceJob, to: JobFsmState): { ok: boolean; reason?: string } {
  if (to !== "COMPLETED") return { ok: true }

  // Commissioning path: no parts replacement required.
  if (job.job_type === "commissioning") return { ok: true }

  // Repair path: parts replacement required.
  if (job.job_type === "repair") {
    const partsText = (job.service_log?.parts_replaced || job.fix_method || "").trim()
    if (partsText) return { ok: true }
    return { ok: false, reason: "งานซ่อมต้องระบุอะไหล่ที่เปลี่ยนก่อนเปลี่ยนเป็น COMPLETED" }
  }

  // Oxygen Sensor policy: only calibration jobs for VT-family equipment.
  if (job.job_type === "calibration" && isVTFamilyModel(job.model) && !isCommissioningLike(job)) {
    const { replaced, noChange } = getVTOxygenSensorDecision(job)
    if (replaced) {
      const items = readStockItems([])
      const pickOpts = getVTOxygenSensorPickOptions()
      if (job.vt_oxygen_sensor_action === "replaced" && pickOpts.length > 0 && !job.vt_oxygen_stock_item_id?.trim()) {
        return {
          ok: false,
          reason: "เลือกรายการสต๊อก Oxygen Sensor ที่จะตัดจ่าย (ดึงจาก Stock)",
        }
      }
      if (job.vt_oxygen_stock_item_id?.trim()) {
        const line = items.find((i) => i.id === job.vt_oxygen_stock_item_id)
        if (!line || !isVTOxygenSensorStockLine(line) || line.qty <= 0) {
          return {
            ok: false,
            reason: "รายการสต๊อก Oxygen ที่เลือกไม่พร้อมจ่ายหรือหมด — เลือกใหม่",
          }
        }
        return { ok: true }
      }
      const stockItem = findOxygenSensorStockItem()
      if (!stockItem) {
        return { ok: false, reason: "สต๊อก Oxygen Sensor (VT650/VT900A/VT) ไม่พอสำหรับเปลี่ยน" }
      }
      return { ok: true }
    }
    if (!noChange) {
      return {
        ok: false,
        reason: "งาน Calibration กลุ่ม VT ต้องระบุว่าเปลี่ยน Oxygen Sensor หรือระบุเหตุผลว่าไม่เปลี่ยน",
      }
    }
  }

  return { ok: true }
}

/**
 * After job is persisted as closed: deduct VT Oxygen stock + append history.
 * Idempotent: skips if oxygen history already has an entry for this job (e.g. FSM path ran first).
 */
export function applyVTOxygenSensorEffectsOnCalibrationClose(job: ASServiceJob): void {
  if (job.job_type !== "calibration" || !isVTFamilyModel(job.model)) return
  if (readOxygenSensorHistory([]).some((e) => e.job_id === job.id)) return

  const { replaced, noChange } = getVTOxygenSensorDecision(job)
  if (replaced) {
    const stockItems = readStockItems([])
    const preferredId = job.vt_oxygen_stock_item_id?.trim()
    let oxygenIdx = preferredId
      ? stockItems.findIndex((i) => i.id === preferredId && i.qty > 0 && isVTOxygenSensorStockLine(i))
      : -1
    if (oxygenIdx < 0) {
      oxygenIdx = stockItems.findIndex((i) => i.qty > 0 && isVTOxygenSensorStockLine(i))
    }
    if (oxygenIdx >= 0) {
      const stockItem = stockItems[oxygenIdx]
      const before = stockItem.qty
      const after = Math.max(0, before - 1)
      const nextStockItems = stockItems.map((i, idx) => (idx === oxygenIdx ? { ...i, qty: after } : i))
      writeStockItems(nextStockItems)
      appendOxygenSensorHistory({
        id: newId("oxy"),
        job_id: job.id,
        job_no: job.job_no,
        serial_number: job.serial_number,
        oxygen_sensor_serial: job.oxygen_sensor_serial?.trim() || undefined,
        model: job.model,
        job_type: job.job_type,
        changed: true,
        note: `เปลี่ยน Oxygen Sensor · ตัดสต๊อก ${stockItem.name || "—"} (${before}→${after})`,
        stock_item_id: stockItem.id,
        stock_item_name: stockItem.name,
        stock_qty_before: before,
        stock_qty_after: after,
        created_at: new Date().toISOString(),
      })
    } else {
      appendOxygenSensorHistory({
        id: newId("oxy"),
        job_id: job.id,
        job_no: job.job_no,
        serial_number: job.serial_number,
        oxygen_sensor_serial: job.oxygen_sensor_serial?.trim() || undefined,
        model: job.model,
        job_type: job.job_type,
        changed: true,
        note: "เปลี่ยน Oxygen Sensor — ไม่พบแถวสต๊อกให้ตัดจ่ายขณะปิดงาน (ตรวจสต๊อก/รายการ VT O₂)",
        created_at: new Date().toISOString(),
      })
    }
  } else if (noChange || isCommissioningLike(job)) {
    appendOxygenSensorHistory({
      id: newId("oxy"),
      job_id: job.id,
      job_no: job.job_no,
      serial_number: job.serial_number,
      oxygen_sensor_serial: job.oxygen_sensor_serial?.trim() || undefined,
      model: job.model,
      job_type: job.job_type,
      changed: false,
      note: isCommissioningLike(job)
        ? "เครื่องใหม่/งาน Commissioning ไม่ต้องเปลี่ยน Oxygen Sensor"
        : "ไม่เปลี่ยน Oxygen Sensor (บันทึกเหตุผลไว้ในรายงานงาน)",
      created_at: new Date().toISOString(),
    })
  }
}

function validateInboundTrackingRules(job: ASServiceJob): { ok: boolean; reason?: string } {
  if ((job.job_type === "repair" || job.job_type === "calibration") && job.receive_channel === "ขนส่งเอกชน") {
    if (!job.tracking_in?.trim() || job.tracking_in.trim() === "—") {
      return { ok: false, reason: "งาน Repair/Calibration ที่รับจากขนส่งเอกชนต้องมี Tracking In" }
    }
  }
  return { ok: true }
}

export function getAvailableTransitions(job: ASServiceJob, actorRole: JobActorRole): TransitionRule[] {
  const state = inferFsmState(job)
  return JOB_FSM_TRANSITIONS.filter((t) => t.from === state && t.roles.includes(actorRole))
}

export function getAvailableNextLegacyStatuses(
  job: ASServiceJob,
  actorRole: JobActorRole,
): ASServiceJob["status"][] {
  const set = new Set<ASServiceJob["status"]>()
  getAvailableTransitions(job, actorRole).forEach((t) => {
    set.add(toLegacyStatus(t.to))
  })
  return Array.from(set)
}

export function canTransition(job: ASServiceJob, to: JobFsmState, actorRole: JobActorRole): { ok: boolean; reason?: string } {
  const state = inferFsmState(job)
  const rule = JOB_FSM_TRANSITIONS.find((t) => t.from === state && t.to === to)
  if (!rule) return { ok: false, reason: `Transition not allowed: ${state} -> ${to}` }
  if (!rule.roles.includes(actorRole)) return { ok: false, reason: "Role is not allowed" }
  const inboundRule = validateInboundTrackingRules(job)
  if (!inboundRule.ok) return inboundRule
  if (!hasRequiredData(job, rule.required)) return { ok: false, reason: "Required data is missing before transition" }
  const domainRule = validateDomainCompletionRules(job, to)
  if (!domainRule.ok) return domainRule
  return { ok: true }
}

function toLegacyStatus(state: JobFsmState): ASServiceJob["status"] {
  switch (state) {
    case "WAITING_PARTS":
      return "รออะไหล่"
    case "IN_PROGRESS":
      return "กำลังซ่อม"
    case "COMPLETED":
      return "ปิดงาน"
    case "CLOSED":
      return "ปิดงาน"
    case "ESCALATED":
      return "ยกเลิก"
    case "ASSIGNED":
      return "ในคิว"
    case "ISSUED":
    case "DRAFT":
    default:
      return "รอประเมิน"
  }
}

function addOneYearYmd(baseYmd?: string): string {
  const base = baseYmd ? new Date(`${baseYmd}T00:00:00`) : new Date()
  base.setFullYear(base.getFullYear() + 1)
  return base.toISOString().slice(0, 10)
}

export function transitionJobState(
  jobId: string,
  to: JobFsmState,
  actorRole: JobActorRole,
): { ok: boolean; reason?: string } {
  for (let i = 0; i < 3; i += 1) {
    const jobs = readJobs([])
    const target = jobs.find((j) => j.id === jobId)
    if (!target) return { ok: false, reason: "Job not found" }
    const serviceLog = {
      ...(target.service_log || {}),
      technician_name: target.service_log?.technician_name || target.technician || "",
      service_date: target.service_log?.service_date || target.received_date || new Date().toISOString().slice(0, 10),
      findings: target.service_log?.findings || target.symptom_actual || "",
      parts_replaced: target.service_log?.parts_replaced || target.fix_method || "",
      test_result: target.service_log?.test_result || "PASS",
      next_service_due_date: target.service_log?.next_service_due_date || target.due_date || addOneYearYmd(target.received_date),
    }
    const transitionTarget: ASServiceJob = {
      ...target,
      assigned_engineer: target.assigned_engineer || target.technician,
      service_log: to === "COMPLETED" || to === "CLOSED" ? serviceLog : target.service_log,
    }
    const can = canTransition(transitionTarget, to, actorRole)
    if (!can.ok) return can
    const prevState = inferFsmState(transitionTarget)
    const nextStatus = toLegacyStatus(to)
    const updated: ASServiceJob = {
      ...transitionTarget,
      fsm_state: to,
      status: nextStatus,
      status_logs: [
        ...(target.status_logs || []),
        {
          at: new Date().toISOString(),
          from: target.status,
          to: nextStatus,
          reason: `FSM: ${prevState} -> ${to}`,
        },
      ],
    }
    const expectedVer = readJobsVersion()
    const nextJobs = jobs.map((j) => (j.id === jobId ? updated : j))
    const wr = writeJobsWithConcurrencyCheck(nextJobs, expectedVer)
    if (!wr.ok) continue

    if (to === "COMPLETED") {
      applyVTOxygenSensorEffectsOnCalibrationClose(transitionTarget)
    }

    const rule = JOB_FSM_TRANSITIONS.find((t) => t.from === prevState && t.to === to)
    if (target.source === "stock" && rule) {
      appendStockNotification({
        id: newId("ntf"),
        kind: rule.notify.kind,
        job_id: target.id,
        job_no: target.job_no,
        title: `${rule.notify.title} (${target.job_no})`,
        message: `${target.model} · ${prevState} -> ${to}`,
        created_at: new Date().toISOString(),
      })
    }
    appendEquipmentHistory({
      id: newId("eh"),
      serial_number: target.serial_number,
      model: target.model,
      customer_org: target.customer_org,
      job_id: target.id,
      job_no: target.job_no,
      event_kind: "status_changed",
      status: nextStatus,
      message: `FSM transition ${prevState} -> ${to}`,
      created_at: new Date().toISOString(),
    })
    return { ok: true }
  }
  return { ok: false, reason: "Concurrent update conflict, please retry" }
}

export function transitionJobToLegacyStatus(
  jobId: string,
  toStatus: ASServiceJob["status"],
  actorRole: JobActorRole,
): { ok: boolean; reason?: string } {
  const jobs = readJobs([])
  const target = jobs.find((j) => j.id === jobId)
  if (!target) return { ok: false, reason: "Job not found" }
  const candidates = getAvailableTransitions(target, actorRole).filter(
    (t) => toLegacyStatus(t.to) === toStatus,
  )
  if (candidates.length === 0) {
    return { ok: false, reason: `Transition not allowed for status: ${toStatus}` }
  }
  const preferred =
    candidates.find((c) => c.to === "CLOSED") ||
    candidates.find((c) => c.to === "COMPLETED") ||
    candidates[0]
  return transitionJobState(jobId, preferred.to, actorRole)
}

export function subscribeJobStateChanges(cb: (jobs: ASServiceJob[]) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const sync = () => cb(readJobs([]))
  const onStorage = (ev: StorageEvent) => {
    if (ev.key && ev.key !== "as_service_jobs" && ev.key !== "as_service_jobs_version") return
    sync()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener("as-store-updated", sync)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener("as-store-updated", sync)
  }
}

export function getStateVisual(state: JobFsmState): { label: string; className: string } {
  switch (state) {
    case "DRAFT":
      return { label: "Draft", className: "bg-slate-100 text-slate-700" }
    case "ISSUED":
      return { label: "Issued", className: "bg-blue-100 text-blue-700" }
    case "ASSIGNED":
      return { label: "Assigned", className: "bg-indigo-100 text-indigo-700" }
    case "IN_PROGRESS":
      return { label: "In Progress", className: "bg-cyan-100 text-cyan-700" }
    case "WAITING_PARTS":
      return { label: "Waiting Parts", className: "bg-amber-100 text-amber-800" }
    case "COMPLETED":
      return { label: "Completed", className: "bg-emerald-100 text-emerald-700" }
    case "CLOSED":
      return { label: "Closed", className: "bg-gray-200 text-gray-700" }
    case "ESCALATED":
      return { label: "Escalated", className: "bg-rose-100 text-rose-700" }
  }
}

