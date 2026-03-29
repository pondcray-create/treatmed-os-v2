import type { SEDeal, SEDealActivityRecord, SESettings } from "@/lib/mock/as-store"
import { lastTouchYmdForDeal } from "@/lib/se/se-deal-neglect"
import {
  achievedWonRevenueThb,
  computeOwnerQuotaThb,
  computeRealtimeWinRate,
  isLostStage,
  isWonStage,
} from "@/lib/se/se-sales-planning"

export type PotentialPerformanceRadarRow = { axis: string; score: number; fullMark: number }

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function daysIdleFromLastTouch(
  deal: SEDeal,
  activities: SEDealActivityRecord[],
  todayYmd: string,
): number {
  const last = lastTouchYmdForDeal(deal, activities)
  const [y1, m1, d1] = last.split("-").map(Number)
  const [y2, m2, d2] = todayYmd.split("-").map(Number)
  const t1 = Date.UTC(y1 || 1970, (m1 || 1) - 1, d1 || 1)
  const t2 = Date.UTC(y2 || 1970, (m2 || 1) - 1, d2 || 1)
  return Math.max(0, Math.round((t2 - t1) / 86400000))
}

type OwnerPerfInputs = {
  owner: string
  settings: SESettings
  ownerDeals: SEDeal[]
  ownerActivities: SEDealActivityRecord[]
  todayYmd: string
}

function scoreTarget(inputs: OwnerPerfInputs): number {
  const won = achievedWonRevenueThb(inputs.owner, inputs.ownerDeals)
  const quota = computeOwnerQuotaThb(inputs.owner, inputs.settings)
  if (quota <= 0) return won > 0 ? 100 : 50
  return clampScore((won / quota) * 100)
}

function scorePipeline(inputs: OwnerPerfInputs): number {
  const openDeals = inputs.ownerDeals.filter((d) => !isWonStage(d.stage) && !isLostStage(d.stage))
  const weighted = openDeals.reduce((s, d) => s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0)
  const quota = computeOwnerQuotaThb(inputs.owner, inputs.settings)
  if (quota <= 0) return weighted > 0 ? 100 : 50
  return clampScore((weighted / quota) * 100)
}

function scoreClosing(inputs: OwnerPerfInputs): number {
  const closed = inputs.ownerDeals.filter((d) => isWonStage(d.stage) || isLostStage(d.stage))
  if (closed.length === 0) return 50
  return clampScore(computeRealtimeWinRate(closed) * 100)
}

function scoreFollowUp(inputs: OwnerPerfInputs): number {
  const openDeals = inputs.ownerDeals.filter((d) => !isWonStage(d.stage) && !isLostStage(d.stage))
  if (openDeals.length === 0) return 50
  const totalIdle = openDeals.reduce(
    (sum, d) => sum + daysIdleFromLastTouch(d, inputs.ownerActivities, inputs.todayYmd),
    0,
  )
  const avgIdle = totalIdle / openDeals.length
  return clampScore(100 - (avgIdle / 30) * 100)
}

function scoreResponsibility(inputs: OwnerPerfInputs): number {
  const active = inputs.ownerDeals.filter((d) => !isWonStage(d.stage) && !isLostStage(d.stage))
  if (active.length === 0) return 50
  const withFollowup = active.filter((d) => {
    const n = (d.next_followup_on || "").trim()
    return !!n && /^\d{4}-\d{2}-\d{2}$/.test(n)
  }).length
  return clampScore((withFollowup / active.length) * 100)
}

function scoreCollaboration(inputs: OwnerPerfInputs): number {
  if (inputs.ownerActivities.length === 0) return 40
  const collabCount = inputs.ownerActivities.filter((a) =>
    a.activity_type === "service_request" ||
    a.activity_type === "order_request" ||
    a.activity_type === "training_request" ||
    a.activity_type === "demo_loan" ||
    a.activity_type === "stock_booking",
  ).length
  return clampScore((collabCount / Math.max(1, inputs.ownerActivities.length)) * 100)
}

function scoreForAxisKey(axisKey: string, inputs: OwnerPerfInputs): number {
  const key = axisKey.toLowerCase()
  if (key.includes("target")) return scoreTarget(inputs)
  if (key.includes("pipeline")) return scorePipeline(inputs)
  if (key.includes("closing")) return scoreClosing(inputs)
  if (key.includes("follow")) return scoreFollowUp(inputs)
  if (key.includes("respons")) return scoreResponsibility(inputs)
  if (key.includes("collab")) return scoreCollaboration(inputs)
  // แกน custom ที่ไม่ได้ match keyword: ใช้คะแนนสมดุลจาก 3 แกนหลัก
  return clampScore((scorePipeline(inputs) + scoreClosing(inputs) + scoreFollowUp(inputs)) / 3)
}

/** แถวสำหรับ Recharts — `axis` เป็นชื่อที่แสดง (label จาก Settings) */
export function buildPotentialPerformanceRows(
  settings: SESettings,
  owner: string,
  deals: SEDeal[],
  activities: SEDealActivityRecord[],
): PotentialPerformanceRadarRow[] {
  const ownerName = owner.trim()
  const ownerDeals = deals.filter((d) => (d.owner || "").trim() === ownerName)
  const ownerActivities = activities.filter((a) => (a.actor_name || "").trim() === ownerName)
  const inputs: OwnerPerfInputs = {
    owner: ownerName,
    settings,
    ownerDeals,
    ownerActivities,
    todayYmd: new Date().toISOString().slice(0, 10),
  }
  return settings.se_potential_performance_axes.map((ax) => {
    return { axis: ax.label, score: scoreForAxisKey(ax.key, inputs), fullMark: 100 }
  })
}
