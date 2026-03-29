import type { SEPipelineStageRule, SESettings } from "@/lib/mock/as-store"

/** โอกาส ≥ ค่านี้ + ข้ามเขต stage ที่ชื่อเป็น Forecast ↔ ไม่ใช่ → บังคับยืนยัน ECD บน Pipeline */
export const ECD_RECONFIRM_MIN_PROBABILITY = 80

/** Stage ที่ถือเป็นช่วง “Forecast” — ดูจากชื่อ (ตั้งใน Settings ให้มีคำว่า forecast / พยากรณ์) */
export function isForecastPipelineStageName(stage: string): boolean {
  return /forecast|พยากรณ์/i.test((stage || "").trim())
}

export function shouldReconfirmEcdOnStageChange(
  prevStage: string,
  nextStage: string,
  probability: number,
): boolean {
  if ((Number(probability) || 0) < ECD_RECONFIRM_MIN_PROBABILITY) return false
  if (!prevStage || !nextStage || prevStage === nextStage) return false
  return isForecastPipelineStageName(prevStage) !== isForecastPipelineStageName(nextStage)
}

export function getSEStageNames(settings: SESettings): string[] {
  return settings.se_pipeline_stages.map((s) => s.name)
}

export function stageRule(settings: SESettings, stage: string): SEPipelineStageRule | undefined {
  return settings.se_pipeline_stages.find((s) => s.name === stage)
}

/** โอกาสปิดการขายขั้นต่ำของ stage — ใช้ทั้งขอ Booking และ Quote funnel */
export function minClosingProbabilityForStage(settings: SESettings, stage: string): number {
  const r = stageRule(settings, stage)
  if (r) return Math.min(100, Math.max(0, r.min_closing_probability))
  return 70
}

/**
 * โอกาสที่ระบบเติมให้เมื่อเลือก Stage — ผูกกับค่า "โอกาสปิดขั้นต่ำ (%)" ของ stage นั้นใน Settings
 * (แก้ที่ช่องโอกาสบนดีลได้หลังนั้น) · Won = 100, Lost = 0
 */
export function suggestedProbabilityFromSettings(settings: SESettings, stage: string): number {
  const s = (stage || "").trim()
  if (/won|ชนะ/i.test(s)) return 100
  if (/lost|แพ้/i.test(s)) return 0
  return minClosingProbabilityForStage(settings, s)
}

export function dealMeetsQuotationPipeline(settings: SESettings, deal: { stage: string; probability: number }): boolean {
  const s = (deal.stage || "").toLowerCase()
  if (/won|lost|ชนะ|แพ้/i.test(s)) return false
  return (deal.probability ?? 0) >= minClosingProbabilityForStage(settings, deal.stage)
}
