/**
 * สูตรแผนขาย SE (อ่านค่าจาก Settings + ดีลจริง)
 *
 * - T_cap = Σ annual_cap_thb ทุกเขต (เพดานตลาดต่อเขตที่ Admin ตั้ง)
 * - T_company = T_cap × company_achieve_factor (เช่น 0.85)
 * - แบ่ง T_company ตาม segment_mix_* (normalize ให้รวม 100% ถ้า Admin กรอกเพี้ยน)
 * - Win rate แบบ realtime = won / (won + lost) จากดีลปิดแล้ว
 * - ช่องว่างรายได้ต่อคน: gap_i = max(0, quota_i − won_i)
 * - Pipeline ที่ “ควรมี” (gross, ไม่ถ่วงน้ำหนัก): need_i ≈ gap_i / win_rate
 *   ยิ่งเข้าใกล้เป้า gap ลด → need ลด (ควบคุมบริหาร)
 */

import type { SEDeal, SESettings } from "@/lib/mock/as-store"

export function isWonStage(stage: string): boolean {
  return /won|ชนะ/i.test(stage || "")
}

export function isLostStage(stage: string): boolean {
  return /lost|แพ้/i.test(stage || "")
}

export function computeRealtimeWinRate(deals: SEDeal[]): number {
  const closed = deals.filter((d) => isWonStage(d.stage) || isLostStage(d.stage))
  const won = closed.filter((d) => isWonStage(d.stage)).length
  const lost = closed.filter((d) => isLostStage(d.stage)).length
  const denom = won + lost
  if (denom === 0) return 0
  return won / denom
}

export function sumDistrictCapsThb(settings: SESettings): number {
  return settings.health_district_targets.reduce((s, r) => s + (Number(r.annual_cap_thb) || 0), 0)
}

export function computeCompanyRevenueTargetThb(settings: SESettings): number {
  return sumDistrictCapsThb(settings) * (settings.company_achieve_factor ?? 0)
}

export type SegmentMixRatios = { publicHospital: number; other: number; buffer: number }

export function normalizeSegmentMixRatios(settings: SESettings): SegmentMixRatios {
  const p = settings.segment_mix_public_hospital_pct
  const o = settings.segment_mix_other_pct
  const b = settings.segment_mix_buffer_pct
  const t = p + o + b
  if (t <= 0) return { publicHospital: 0.55, other: 0.3, buffer: 0.15 }
  return { publicHospital: p / t, other: o / t, buffer: b / t }
}

export function segmentTargetsFromCompanyThb(
  companyTargetThb: number,
  settings: SESettings,
): { publicHospitalThb: number; otherThb: number; bufferThb: number } {
  const m = normalizeSegmentMixRatios(settings)
  return {
    publicHospitalThb: companyTargetThb * m.publicHospital,
    otherThb: companyTargetThb * m.other,
    bufferThb: companyTargetThb * m.buffer,
  }
}

export function ownerDistrictCapSumThb(owner: string, settings: SESettings): number {
  const o = owner.trim()
  return settings.health_district_targets
    .filter((r) => (r.primary_owner || "").trim() === o)
    .reduce((s, r) => s + (Number(r.annual_cap_thb) || 0), 0)
}

/** สัดส่วนจากเพดานเขต → รับ quota ส่วนแบ่งของ T_company */
export function computeOwnerQuotaThb(owner: string, settings: SESettings): number {
  const totalCaps = sumDistrictCapsThb(settings)
  if (totalCaps <= 0) return 0
  const share = ownerDistrictCapSumThb(owner, settings) / totalCaps
  return computeCompanyRevenueTargetThb(settings) * share
}

export function achievedWonRevenueThb(owner: string, deals: SEDeal[]): number {
  const o = owner.trim()
  return deals
    .filter((d) => isWonStage(d.stage) && (d.owner || "").trim() === o)
    .reduce((s, d) => s + (Number(d.value) || 0), 0)
}

/**
 * ประมาณการมูลค่า pipeline (ดิบ) ที่ควรมีเมื่อยังขาดเป้า
 * winRate เป็นทศนิยม 0–1; ถ้าไม่มีข้อมูลปิด ใช้ floor 5% เพื่อไม่ให้ตัวหารเป็น 0
 */
export function suggestedOpenPipelineNeedThb(revenueGapThb: number, winRate01: number): number {
  if (revenueGapThb <= 0) return 0
  const w = Math.min(0.95, Math.max(0.05, winRate01 > 0 ? winRate01 : 0.05))
  return revenueGapThb / w
}

export function collectSalesOwnerRows(settings: SESettings): string[] {
  const fromOwners = settings.se_owners.map((o) => o.trim()).filter(Boolean)
  const fromDistricts = settings.health_district_targets
    .map((r) => (r.primary_owner || "").trim())
    .filter(Boolean)
  return Array.from(new Set([...fromOwners, ...fromDistricts]))
}
