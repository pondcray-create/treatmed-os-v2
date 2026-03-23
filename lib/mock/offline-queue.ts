"use client"

const OFFLINE_QUEUE_KEY = "as_offline_queue"

type OfflineMutation = {
  id: string
  type: "service_job_patch"
  payload: {
    job_id: string
    patch: Record<string, unknown>
    queued_at: string
    base_status?: string
  }
}

export type { OfflineMutation }

function hasWindow() {
  return typeof window !== "undefined"
}

function readQueue(): OfflineMutation[] {
  if (!hasWindow()) return []
  const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as OfflineMutation[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: OfflineMutation[]) {
  if (!hasWindow()) return
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  window.dispatchEvent(new CustomEvent("as-store-updated", { detail: { key: OFFLINE_QUEUE_KEY } }))
}

export function enqueueOfflineJobPatch(jobId: string, patch: Record<string, unknown>) {
  const queue = readQueue()
  queue.push({
    id: `${jobId}-${Date.now()}`,
    type: "service_job_patch",
    payload: { job_id: jobId, patch, queued_at: new Date().toISOString() },
  })
  writeQueue(queue)
}

export function enqueueOfflineJobPatchWithBaseStatus(
  jobId: string,
  patch: Record<string, unknown>,
  baseStatus: string,
) {
  const queue = readQueue()
  queue.push({
    id: `${jobId}-${Date.now()}`,
    type: "service_job_patch",
    payload: { job_id: jobId, patch, queued_at: new Date().toISOString(), base_status: baseStatus },
  })
  writeQueue(queue)
}

export function readOfflineJobPatches() {
  return readQueue()
}

export function clearOfflineJobPatches() {
  writeQueue([])
}

export function removeOfflineJobPatchById(id: string): boolean {
  const queue = readQueue()
  const next = queue.filter((m) => m.id !== id)
  if (next.length === queue.length) return false
  writeQueue(next)
  return true
}

export function applyOfflineJobPatchById(
  id: string,
  applyPatch: (jobId: string, patch: Record<string, unknown>) => void,
): boolean {
  const queue = readQueue()
  const target = queue.find((m) => m.id === id)
  if (!target || target.type !== "service_job_patch") return false
  applyPatch(target.payload.job_id, target.payload.patch)
  writeQueue(queue.filter((m) => m.id !== id))
  return true
}

export function flushOfflineJobPatches(applyPatch: (jobId: string, patch: Record<string, unknown>) => void) {
  const queue = readQueue()
  if (queue.length === 0) return 0
  for (const m of queue) {
    if (m.type !== "service_job_patch") continue
    applyPatch(m.payload.job_id, m.payload.patch)
  }
  writeQueue([])
  return queue.length
}

