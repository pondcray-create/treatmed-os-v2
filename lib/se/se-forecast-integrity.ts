/**
 * กันพฤติกรรม forecast ต่ำเกินจริง (playsafe / sandbagging)
 *
 * - ฐานนโยบาย: โอกาสที่ใช้คำนวณ "Weighted (ฐานนโยบาย)" = max(ที่ SE ใส่, min ของ stage, min ของดีลในมือ)
 * - ดีลในมือ: SE ต้องยอมรับความเสี่ยง — โอกาสขั้นต่ำตั้งที่ Settings
 * - ต่ำกว่า min ของ stage: ต้องมีเหตุผล (audit) — เก็บใน below_stage_prob_note
 */

import type { SEDeal, SESettings } from "@/lib/mock/as-store"
import { minClosingProbabilityForStage } from "@/lib/se/se-pipeline-stages"
import { isLostStage, isWonStage } from "@/lib/se/se-sales-planning"

export function seInHandMinProbability(settings: SESettings): number {
  const n = Number(settings.se_in_hand_min_probability)
  if (!Number.isFinite(n)) return 88
  return Math.min(100, Math.max(0, n))
}

export function dealIsOpenForForecast(d: Pick<SEDeal, "stage">): boolean {
  return !isLostStage(d.stage) && !isWonStage(d.stage)
}

/** โอกาส % ที่ใช้คำนวณ pipeline แบบมีพื้น (กันใส่ต่ำเกินไปเมื่อเทียบนโยบาย stage / ดีลในมือ) */
export function effectiveForecastProbabilityPercent(deal: SEDeal, settings: SESettings): number {
  if (!dealIsOpenForForecast(deal)) return 0
  const entered = Math.min(100, Math.max(0, Number(deal.probability) || 0))
  const floorStage = minClosingProbabilityForStage(settings, deal.stage)
  const floorInHand = deal.declared_in_hand ? seInHandMinProbability(settings) : 0
  return Math.min(100, Math.max(entered, floorStage, floorInHand))
}

export function weightedOpenPipelineThb(
  deals: SEDeal[],
  settings: SESettings,
  mode: "as_entered" | "policy_floor",
): number {
  return deals.reduce((sum, d) => {
    if (!dealIsOpenForForecast(d)) return sum
    const p =
      mode === "as_entered"
        ? Math.min(100, Math.max(0, Number(d.probability) || 0))
        : effectiveForecastProbabilityPercent(d, settings)
    return sum + (Number(d.value) || 0) * (p / 100)
  }, 0)
}

/** โอกาสที่ใส่ต่ำกว่า min ของ stage (ดีลยังเปิด) — ควรมี below_stage_prob_note */
export function isBelowStageForecastFloor(deal: SEDeal, settings: SESettings): boolean {
  if (!dealIsOpenForForecast(deal)) return false
  const minP = minClosingProbabilityForStage(settings, deal.stage)
  return (Number(deal.probability) || 0) < minP
}

export function needsBelowStageProbNote(deal: SEDeal, settings: SESettings): boolean {
  return isBelowStageForecastFloor(deal, settings) && !(deal.below_stage_prob_note || "").trim()
}
