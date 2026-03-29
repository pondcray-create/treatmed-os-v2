import type { SEDeal } from "@/lib/mock/as-store"
import { newId } from "@/lib/new-id"

export type SeDealImportMode = "merge" | "replace"

export type SeDealImportReport = {
  added: number
  updated: number
  skipped: number
  errors: string[]
}

/** หัวคอลัมน์แนะนำ (แถวแรกของ Excel / CSV) — ใช้ export ตัวอย่าง */
export const SE_DEALS_IMPORT_CANONICAL_HEADERS = [
  "deal_no",
  "id",
  "title",
  "customer_name",
  "customer_name_english",
  "market_segment",
  "product_model",
  "manufacturer",
  "stage",
  "value",
  "probability",
  "expected_close_date",
  "owner",
  "province",
  "region",
  "health_district",
  "customer_segment",
  "next_followup_on",
  "admin_quote_no",
  "on_ebidding",
  "declared_in_hand",
  "below_stage_prob_note",
  "lost_reason",
  "lost_reason_note",
] as const

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, "").trim()
}

function canonHeader(raw: string) {
  return stripBom(raw)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[()]/g, "")
    .toLowerCase()
}

/** หัวคอลัมน์ Excel → ชื่อฟิลด์ SEDeal */
const HEADER_TO_FIELD: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  const add = (labels: string[], field: string) => {
    for (const L of labels) {
      m[stripBom(L)] = field
      m[canonHeader(L)] = field
    }
  }
  add(["deal_no", "deal no", "dealno", "เลขที่ดีล", "เลขดีล"], "deal_no")
  add(["id", "deal_id"], "id")
  add(["title", "deal_title", "ชื่อดีล", "หัวข้อดีล", "opportunity", "opportunity_name"], "title")
  add(
    ["customer_name", "customer", "ลูกค้า", "ชื่อลูกค้า", "customer name", "account", "account_name", "hospital"],
    "customer_name",
  )
  add(["customer_name_english", "customer_english", "ชื่ออังกฤษ", "name_en"], "customer_name_english")
  add(["market_segment", "segment", "market segment"], "market_segment")
  add(["product_model", "model", "รุ่น", "รุ่นสินค้า"], "product_model")
  add(["manufacturer", "ผู้ผลิต", "mfr"], "manufacturer")
  add(["stage", "pipeline_stage", "สถานะ", "ขั้น"], "stage")
  add(["value", "มูลค่า", "amount", "deal_value"], "value")
  add(["probability", "โอกาส", "prob", "%", "probability_pct"], "probability")
  add(["expected_close_date", "ecd", "วันที่คาดปิด", "วันปิดคาด", "close_date"], "expected_close_date")
  add(["owner", "se", "sales", "ผู้รับผิดชอบ", "se_owner", "owner_name"], "owner")
  add(["province", "จังหวัด"], "province")
  add(["region", "ภูมิภาค"], "region")
  add(["health_district", "เขตสุขภาพ", "health district", "เขต"], "health_district")
  add(["customer_segment"], "customer_segment")
  add(["next_followup_on", "followup", "ติดตามถัดไป"], "next_followup_on")
  add(["admin_quote_no", "qt", "quote", "เลข qt", "เลขใบเสนอราคา"], "admin_quote_no")
  add(["on_ebidding", "ebidding", "e_bidding", "ประมูล"], "on_ebidding")
  add(["declared_in_hand", "in_hand", "ดีลในมือ"], "declared_in_hand")
  add(["below_stage_prob_note", "below_min_note"], "below_stage_prob_note")
  add(["lost_reason", "สาเหตุแพ้", "lost"], "lost_reason")
  add(["lost_reason_note", "หมายเหตุแพ้"], "lost_reason_note")
  return m
})()

function fieldForHeader(header: string): string | undefined {
  const h = stripBom(header)
  if (!h) return undefined
  if (HEADER_TO_FIELD[h]) return HEADER_TO_FIELD[h]
  return HEADER_TO_FIELD[canonHeader(h)]
}

export function rowToDealFields(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    const f = fieldForHeader(k)
    if (f) out[f] = String(v ?? "").trim()
  }
  return out
}

function parseMoney(s: string): number | undefined {
  const t = s.replace(/,/g, "").replace(/\s/g, "").trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function parseProb(s: string): number | undefined {
  const t = s.replace(/%/g, "").replace(/\s/g, "").trim()
  if (!t) return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  return Math.min(100, Math.max(0, Math.round(n)))
}

function parseBool(s: string): boolean | undefined {
  const t = stripBom(s).trim().toLowerCase()
  if (!t) return undefined
  if (["1", "true", "yes", "y", "ใช่", "ประมูล", "on"].includes(t)) return true
  if (["0", "false", "no", "n", "ไม่", "off"].includes(t)) return false
  return undefined
}

function parseYmd(s: string): string | undefined {
  const t = stripBom(s).trim()
  if (!t) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const d = m[1]!.padStart(2, "0")
    const mo = m[2]!.padStart(2, "0")
    const y = m[3]!
    return `${y}-${mo}-${d}`
  }
  const d2 = new Date(t)
  if (!Number.isNaN(d2.getTime())) return d2.toISOString().slice(0, 10)
  return undefined
}

function parseCustomerSegment(s: string): "public_hospital" | "other" | undefined {
  const t = canonHeader(s).replace(/_/g, "")
  if (!t) return undefined
  if (t.includes("public") || t.includes("รพรัฐ") || t.includes("รัฐ")) return "public_hospital"
  if (t === "other" || t.includes("อื่น") || t.includes("private")) return "other"
  return undefined
}

export function buildSeDealsImportTemplateCsv(): string {
  const header = [...SE_DEALS_IMPORT_CANONICAL_HEADERS].join(",")
  const example = [
    "DEAL-001",
    "",
    "ตัวอย่างดีล",
    "โรงพยาบาลตัวอย่าง",
    "",
    "โรงพยาบาลเอกชน (Private Hospital)",
    "X2",
    "RaySafe",
    "lead",
    "1500000",
    "40",
    "2026-12-31",
    "ชื่อ SE",
    "กรุงเทพมหานคร",
    "",
    "",
    "",
    "",
    "",
    "false",
    "false",
    "",
    "",
    "",
  ].join(",")
  return `${header}\n${example}\n`
}

type ParseResult = { deal: SEDeal; errors: string[] }

function parseOneRow(f: Record<string, string>, rowLabel: string): ParseResult {
  const errors: string[] = []
  const title = (f.title || "").trim()
  const customer_name = (f.customer_name || "").trim()
  const stage = (f.stage || "").trim()
  const owner = (f.owner || "").trim()
  const value = parseMoney(f.value ?? "")
  const probability = parseProb(f.probability ?? "")
  const expected_close_date = parseYmd(f.expected_close_date ?? "")

  if (!title) errors.push("ไม่มี title / ชื่อดีล")
  if (!customer_name) errors.push("ไม่มี customer_name / ลูกค้า")

  const deal_no = (f.deal_no || "").trim()
  const id_in = (f.id || "").trim()
  const id = id_in || newId("deal")

  const healthRaw = (f.health_district || "").trim()
  let health_district: number | undefined
  if (healthRaw) {
    const hn = parseInt(healthRaw, 10)
    if (Number.isFinite(hn)) health_district = hn
  }

  const cs = parseCustomerSegment(f.customer_segment ?? "")
  const onEb = parseBool(f.on_ebidding ?? "")
  const inHand = parseBool(f.declared_in_hand ?? "")

  const deal: SEDeal = {
    id,
    deal_no,
    title: title || "—",
    customer_name: customer_name || "—",
    product_model: (f.product_model || "").trim() || undefined,
    manufacturer: (f.manufacturer || "").trim() || undefined,
    // รองรับไฟล์จากหน้างานที่ข้อมูลยังไม่ครบ: ให้เข้า pipeline ก่อน แล้วค่อยเติมในแอพ
    stage: stage || "lead",
    value: value ?? 0,
    probability: probability ?? 0,
    expected_close_date: expected_close_date || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    owner,
    customer_segment: cs,
    market_segment: (f.market_segment || "").trim() || undefined,
    customer_name_english: (f.customer_name_english || "").trim() || undefined,
    province: (f.province || "").trim() || undefined,
    region: (f.region || "").trim() || undefined,
    health_district,
    next_followup_on: parseYmd(f.next_followup_on ?? "") || undefined,
    admin_quote_no: (f.admin_quote_no || "").trim() || undefined,
    on_ebidding: onEb ?? false,
    declared_in_hand: inHand ?? undefined,
    below_stage_prob_note: (f.below_stage_prob_note || "").trim() || undefined,
    lost_reason: (f.lost_reason || "").trim() || undefined,
    lost_reason_note: (f.lost_reason_note || "").trim() || undefined,
  }

  if (errors.length) return { deal, errors: [`${rowLabel}: ${errors.join(", ")}`] }
  return { deal, errors: [] }
}

export async function parseDealImportFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx")
  const lower = file.name.toLowerCase()
  let wb: import("xlsx").WorkBook
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(await file.arrayBuffer())
    wb = XLSX.read(text, { type: "string" })
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
  }
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
  return rows.map((row) => {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      o[stripBom(String(k)).trim()] = String(v ?? "").trim()
    }
    return o
  })
}

export function applySeDealsImport(
  rows: Record<string, string>[],
  existing: SEDeal[],
  mode: SeDealImportMode,
): { deals: SEDeal[]; report: SeDealImportReport } {
  const report: SeDealImportReport = { added: 0, updated: 0, skipped: 0, errors: [] }
  let seq = existing.reduce((m, d) => {
    const mm = d.deal_no.match(/^DEAL-IMP-(\d+)$/)
    if (mm) return Math.max(m, parseInt(mm[1]!, 10))
    return m
  }, 0)

  const parsed: SEDeal[] = []
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2
    const f0 = rowToDealFields(rows[i]!)
    if (Object.keys(f0).length === 0 || !Object.values(f0).some((v) => String(v).trim())) {
      report.skipped++
      continue
    }
    const f = { ...f0 }
    if (!f.deal_no?.trim()) {
      seq++
      f.deal_no = `DEAL-IMP-${String(seq).padStart(4, "0")}`
    }
    const { deal, errors } = parseOneRow(f, `แถว ${rowNum}`)
    if (errors.length) {
      report.skipped++
      report.errors.push(...errors)
      continue
    }
    parsed.push(deal)
  }

  if (mode === "replace") {
    report.added = parsed.length
    report.updated = 0
    return { deals: parsed, report }
  }

  const byDealNo = new Map(existing.map((d) => [d.deal_no.trim(), d]))
  const byId = new Map(existing.map((d) => [d.id, d]))
  const next = [...existing]
  const seenReplace = new Set<string>()

  for (const d of parsed) {
    const prev =
      (d.deal_no && byDealNo.get(d.deal_no.trim())) || (d.id && byId.get(d.id)) || undefined
    if (prev) {
      const idx = next.findIndex((x) => x.id === prev.id)
      if (idx >= 0) {
        next[idx] = {
          ...prev,
          ...d,
          id: prev.id,
          deal_no: (d.deal_no || "").trim() || prev.deal_no,
          created_at: prev.created_at || d.created_at,
        }
        report.updated++
        seenReplace.add(prev.id)
        continue
      }
    }
    next.unshift(d)
    report.added++
    byDealNo.set(d.deal_no.trim(), d)
    byId.set(d.id, d)
  }

  return { deals: next, report }
}
