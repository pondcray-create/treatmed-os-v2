/**
 * E-Bidding Monitoring — รายการบน SE Dashboard
 * ดีลเปิดที่มูลค่าถึงเกณฑ์จะขึ้นรายการอัตโนมัติ; Sales ติ๊กยืนยันเมื่อประมูลจริง (on_ebidding)
 */

import type { SEDeal } from "@/lib/mock/as-store"
import { isLostStage, isWonStage } from "@/lib/se/se-sales-planning"

export const EBIDDING_MONITORING_MIN_VALUE_THB = 500_000

export function isEbiddingValueEligible(value: unknown): boolean {
  return (Number(value) || 0) >= EBIDDING_MONITORING_MIN_VALUE_THB
}

/** ดีลที่แสดงในแถบ E-Bidding บน Dashboard (เปิด + มูลค่าถึงเกณฑ์) */
export function isEbiddingDashboardListedDeal(d: Pick<SEDeal, "stage" | "value">): boolean {
  if (isLostStage(d.stage) || isWonStage(d.stage)) return false
  return isEbiddingValueEligible(d.value)
}
