import {
  appendSESalesNeglectNotification,
  type SEDeal,
  type SEDealActivityRecord,
  type SESalesNeglectNotification,
} from "@/lib/mock/as-store"
import { newId } from "@/lib/new-id"
import { isTerminalClosedDealStage } from "@/lib/se/se-lost-analytics"

function daysBetweenYMD(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number)
  const [y2, m2, d2] = toYmd.split("-").map(Number)
  return Math.round((Date.UTC(y2, (m2 || 1) - 1, d2 || 1) - Date.UTC(y1, (m1 || 1) - 1, d1 || 1)) / 86400000)
}

function isoWeekKey(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number)
  const t = new Date(Date.UTC(y, (m || 1) - 1, day || 1))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

/** วันที่ “สัมผัสล่าสุด” = max(created_at ดีล, วันที่ Activity ล่าสุด) */
export function lastTouchYmdForDeal(deal: SEDeal, activities: SEDealActivityRecord[]): string {
  let best = (deal.created_at || "").slice(0, 10)
  for (const a of activities) {
    if (a.deal_id !== deal.id) continue
    const d = (a.occurred_on || "").slice(0, 10)
    if (d && d > best) best = d
  }
  if (!best) best = new Date().toISOString().slice(0, 10)
  return best
}

type ScanOpts = {
  deals: SEDeal[]
  activities: SEDealActivityRecord[]
  todayYmd: string
}

/**
 * เกณฑ์เพิกเฉย (ดีลเปิด):
 * - โอกาส &lt; 60%: ไม่มีสัมผัส ≥ 90 วัน
 * - 60% ≤ โอกาส ≤ 80%: ≥ 30 วัน
 * - โอกาส &gt; 80%: ≥ 7 วัน → แจ้งรายสัปดาห์ (dedupe ตาม ISO week)
 */
export function runSENeglectNotificationScan(opts: ScanOpts): number {
  const { deals, activities, todayYmd } = opts
  let appended = 0
  for (const deal of deals) {
    if (isTerminalClosedDealStage(deal.stage)) continue
    const p = Number(deal.probability) || 0
    const last = lastTouchYmdForDeal(deal, activities)
    const idle = daysBetweenYMD(last, todayYmd)
    let dedupe_key: string | null = null
    let title = ""
    let message = ""

    if (p < 60 && idle >= 90) {
      const period = Math.floor(idle / 90)
      dedupe_key = `neglect:${deal.id}:lt60:p${period}`
      title = `ดีลไม่มีการติดต่อ ≥ 90 วัน (${deal.deal_no})`
      message = `Sales อาจเพิกเฉยต่องานสำคัญ — โอกาส ${p}% (ต่ำกว่า 60%) · ลูกค้า ${deal.customer_name} · Owner: ${deal.owner || "—"} · ไม่มี Activity นับจาก ${last} (${idle} วัน)`
    } else if (p >= 60 && p <= 80 && idle >= 30) {
      const period = Math.floor(idle / 30)
      dedupe_key = `neglect:${deal.id}:mid6080:p${period}`
      title = `ดีลไม่มีการติดต่อ ≥ 1 เดือน (${deal.deal_no})`
      message = `Sales อาจเพิกเฉยต่องานสำคัญ — โอกาส ${p}% (60–80%) · ลูกค้า ${deal.customer_name} · Owner: ${deal.owner || "—"} · ล่าสุด ${last} (${idle} วัน)`
    } else if (p > 80 && idle >= 7) {
      const wk = isoWeekKey(todayYmd)
      dedupe_key = `neglect:${deal.id}:gt80:week:${wk}`
      title = `ดีลโอกาสสูง — ตรวจสอบทุกสัปดาห์ (${deal.deal_no})`
      message = `Sales อาจเพิกเฉยต่องานสำคัญ — โอกาส ${p}% (มากกว่า 80%) · ลูกค้า ${deal.customer_name} · Owner: ${deal.owner || "—"} · ไม่มี Activity ต่อเนื่องตั้งแต่ ${last} (${idle} วัน) · รอบแจ้งเตือน ${wk}`
    }

    if (!dedupe_key) continue
    const item: SESalesNeglectNotification = {
      id: newId("sen"),
      deal_id: deal.id,
      deal_no: deal.deal_no,
      owner: deal.owner,
      title,
      message,
      created_at: new Date().toISOString(),
      dedupe_key,
    }
    if (appendSESalesNeglectNotification(item)) appended += 1
  }
  return appended
}
