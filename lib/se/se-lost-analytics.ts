/**
 * ดีล Lost + สรุปสาเหตุแพ้
 *
 * Win rate ยังคิดแบบเดิม: Won / (Won + Lost) — ไม่ใช้ lost_reason ในตัวหาร
 * สรุปสาเหตุแพ้: นับจำนวนดีล + ผลรวมมูลค่าดีล (pipeline value ที่หาย) ต่อเหตุผล
 * Stage "lost" โอกาสปิดใน Settings แนะนำ 0% (ดีลปิดแล้ว) — ระบบบังคับไม่ให้ขอ Booking กับดีลปิดไม่ว่า %
 */

import type { SEDeal } from "@/lib/mock/as-store"
import { isLostStage, isWonStage } from "@/lib/se/se-sales-planning"

export function isTerminalClosedDealStage(stage: string): boolean {
  return isWonStage(stage) || isLostStage(stage)
}

export type LostReasonSummaryRow = {
  reason: string
  count: number
  /** ผลรวมมูลค่าดีลที่แพ้ (ใช้ดู pipeline ที่หายไป) */
  lostValueThb: number
}

export function aggregateLostDealsByReason(deals: SEDeal[]): LostReasonSummaryRow[] {
  const lost = deals.filter((d) => isLostStage(d.stage))
  const map = new Map<string, { count: number; value: number }>()
  for (const d of lost) {
    const label = (d.lost_reason || "").trim() || "ยังไม่ระบุสาเหตุ"
    const cur = map.get(label) ?? { count: 0, value: 0 }
    cur.count += 1
    cur.value += Number(d.value) || 0
    map.set(label, cur)
  }
  return Array.from(map.entries())
    .map(([reason, x]) => ({ reason, count: x.count, lostValueThb: x.value }))
    .sort((a, b) => b.lostValueThb - a.lostValueThb || b.count - a.count)
}
