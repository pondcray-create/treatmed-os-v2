"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { Copy, FileText, Layers, Plus, SplitSquareHorizontal, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  AS_STORE_KEYS,
  readOrganizations,
  readSEDeals,
  type ASOrganization,
  type SEDeal,
} from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const ADMIN_QUOTE_EMAIL = "info@treatmed-th.com"

export type QuotationDraftMode = "combined" | "separate"

export type QuoteLineDraft = {
  id: string
  /** ติ๊ก = รายการนี้อยู่ในข้อความที่คัดลอก (เช่น ดีลมี 3 ชิ้น แต่ขอราคาแค่ 2 ชิ้นก่อน) */
  include_in_draft: boolean
  proposal_title: string
  equipment_name: string
  brand: string
  model: string
  qty: string
  accessories: string
  loan_price_terms: string
  ecd: string
  delivery_due: string
  price_validity: string
  budget_year: string
}

function newLine(partial?: Partial<QuoteLineDraft>): QuoteLineDraft {
  return {
    id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    include_in_draft: partial?.include_in_draft ?? true,
    proposal_title: partial?.proposal_title ?? "",
    equipment_name: partial?.equipment_name ?? "",
    brand: partial?.brand ?? "",
    model: partial?.model ?? "",
    qty: partial?.qty ?? "1",
    accessories: partial?.accessories ?? "",
    loan_price_terms: partial?.loan_price_terms ?? "",
    ecd: partial?.ecd ?? "",
    delivery_due: partial?.delivery_due ?? "",
    price_validity: partial?.price_validity ?? "",
    budget_year: partial?.budget_year ?? "",
  }
}

function primaryContact(org: ASOrganization | undefined) {
  if (!org?.contacts?.length) return null
  const p = org.contacts.find((c) => c.is_primary) ?? org.contacts[0]
  return p
}

/** บล็อกเต็ม 10 ข้อ (+ ชื่อรายการเสนอ) สำหรับอีเมล */
function formatLineFullEmail(L: QuoteLineDraft): string {
  return (
    (L.proposal_title.trim() ? `ชื่อรายการเสนอ: ${L.proposal_title.trim()}\n` : "") +
    `  1. ชื่อเครื่อง: ${L.equipment_name.trim() || "—"}
  2. ชื่อยี่ห้อ: ${L.brand.trim() || "—"}
  3. ชื่อรุ่น: ${L.model.trim() || "—"}
  4. จำนวน: ${L.qty.trim() || "—"}
  5. อุปกรณ์ประกอบ: ${L.accessories.trim() || "—"}
  6. กำหนดยืมราคา: ${L.loan_price_terms.trim() || "—"}
  7. ECD: ${L.ecd.trim() || "—"}
  8. กำหนดส่งสินค้า: ${L.delivery_due.trim() || "—"}
  9. กำหนดยืนราคา: ${L.price_validity.trim() || "—"}
  10. สำหรับงบประมาณปี: ${L.budget_year.trim() || "—"}
`
  )
}

function formatLineCompactEmail(L: QuoteLineDraft, lineNo: number, primaryRef: number): string {
  return (
    `รายการที่ ${lineNo} (สินค้าเพิ่มในชุดเดียวกัน — ใช้ลูกค้า / ผู้ติดต่อ / ECD · กำหนดส่ง · ยืนราคา · งบปี ตามรายการที่ ${primaryRef})` +
    `
  ชื่อเครื่อง: ${L.equipment_name.trim() || "—"}
  ชื่อยี่ห้อ: ${L.brand.trim() || "—"}
  ชื่อรุ่น: ${L.model.trim() || "—"}
  จำนวน: ${L.qty.trim() || "—"}
  อุปกรณ์ประกอบ: ${L.accessories.trim() || "—"}
`
  )
}

function buildEmailBody(p: {
  salesName: string
  salesEmail: string
  customerName: string
  contactName: string
  phone: string
  email: string
  dealNo: string
  quoteStructure: QuotationDraftMode
  lines: QuoteLineDraft[]
  notes: string
}): string {
  const included = p.lines.filter((l) => l.include_in_draft)

  const modeLine =
    p.quoteStructure === "combined"
      ? "รูปแบบขอราคา: รวมเป็นใบขอราคาเดียว — รายการแรกที่ติ๊กรวม = ชุดเงื่อนไขหลัก (ECD / ส่ง / ยืนราคา / งบปี) · รายการอื่นที่ติ๊ก = สินค้าเพิ่มในชุดเดียวกัน"
      : "รูปแบบขอราคา: แยกใบเสนอราคา — ขอให้ Admin จัดทำใบเสนอราคาแยกต่างหากต่อรายการที่ติ๊ก (แต่ละรายการมีเงื่อนไขครบชุดได้เอง)"

  if (included.length === 0) {
    return `[ยังไม่มีรายการที่ติ๊ก "รวมใน draft นี้" — เลือกอย่างน้อย 1 รายการก่อนคัดลอก]\n\n${modeLine}`
  }

  let linesBlock = ""
  if (p.quoteStructure === "separate") {
    linesBlock = included
      .map((L, i) => {
        const n = i + 1
        return (
          `══════════════════ ใบขอราคา ที่ ${n} (แยกใบ) ══════════════════
ขอให้จัดทำใบเสนอราคาแยกจากรายการอื่น — ข้อมูลลูกค้าด้านล่างใช้ร่วมกันทุกใบ

${formatLineFullEmail(L)}`
        )
      })
      .join("\n\n")
  } else {
    const [first, ...rest] = included
    linesBlock =
      `รายการที่ 1 (หลัก — ชุดเงื่อนไขใช้กับรายการเพิ่มในชุดเดียวกัน)\n` +
      formatLineFullEmail(first) +
      "\n" +
      rest.map((L, i) => formatLineCompactEmail(L, i + 2, 1)).join("\n")
  }

  return `เรียน ฝ่ายจัดทำใบเสนอราคา / Admin

ขอความอนุเคราะช่วยจัดทำ Draft ราคาตามรายละเอียดด้านล่าง เพื่อนำไปประกอบการเสนอลูกค้า

${modeLine}

---
อีเมลติดต่อฝ่ายขาย (Admin): ${ADMIN_QUOTE_EMAIL}

ผู้ขอใบเสนอราคา (Sales): ${p.salesName || "—"}${p.salesEmail ? ` <${p.salesEmail}>` : ""}
อ้างอิงดีล: ${p.dealNo || "—"}

ชื่อลูกค้า: ${p.customerName.trim() || "—"}
ชื่อผู้ติดต่อ: ${p.contactName.trim() || "—"}
เบอร์โทร: ${p.phone.trim() || "—"}
E-mail: ${p.email.trim() || "—"}

รายการสินค้าประกอบด้วย
${linesBlock}
---
หมายเหตุเพิ่มเติม:
${p.notes.trim() || "—"}

ขอบคุณครับ
${p.salesName || ""}`
}

function dashVal(s: string) {
  return s.trim() || "—"
}

function previewRowsFull(L: QuoteLineDraft): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (L.proposal_title.trim()) {
    rows.push({ label: "ชื่อรายการเสนอ", value: L.proposal_title.trim() })
  }
  rows.push(
    { label: "1. ชื่อเครื่อง", value: dashVal(L.equipment_name) },
    { label: "2. ชื่อยี่ห้อ", value: dashVal(L.brand) },
    { label: "3. ชื่อรุ่น", value: dashVal(L.model) },
    { label: "4. จำนวน", value: dashVal(L.qty) },
    { label: "5. อุปกรณ์ประกอบ", value: dashVal(L.accessories) },
    { label: "6. กำหนดยืมราคา", value: dashVal(L.loan_price_terms) },
    { label: "7. ECD", value: dashVal(L.ecd) },
    { label: "8. กำหนดส่งสินค้า", value: dashVal(L.delivery_due) },
    { label: "9. กำหนดยืนราคา", value: dashVal(L.price_validity) },
    { label: "10. สำหรับงบประมาณปี", value: dashVal(L.budget_year) },
  )
  return rows
}

function previewRowsCompact(L: QuoteLineDraft): { label: string; value: string }[] {
  return [
    { label: "ชื่อเครื่อง", value: dashVal(L.equipment_name) },
    { label: "ชื่อยี่ห้อ", value: dashVal(L.brand) },
    { label: "ชื่อรุ่น", value: dashVal(L.model) },
    { label: "จำนวน", value: dashVal(L.qty) },
    { label: "อุปกรณ์ประกอบ", value: dashVal(L.accessories) },
  ]
}

type EmailPreviewBlock =
  | { kind: "combined_primary"; title: string; rows: { label: string; value: string }[] }
  | { kind: "combined_supplement"; title: string; rows: { label: string; value: string }[] }
  | { kind: "separate_quote"; quoteIndex: number; rows: { label: string; value: string }[] }

type EmailPreview =
  | { empty: true; modeLine: string }
  | {
      empty: false
      modeLine: string
      meta: { label: string; value: string }[]
      blocks: EmailPreviewBlock[]
      notes: string
      salesSignOff: string
    }

function buildEmailPreview(p: {
  salesName: string
  salesEmail: string
  customerName: string
  contactName: string
  phone: string
  email: string
  dealNo: string
  quoteStructure: QuotationDraftMode
  lines: QuoteLineDraft[]
  notes: string
}): EmailPreview {
  const included = p.lines.filter((l) => l.include_in_draft)
  const modeLine =
    p.quoteStructure === "combined"
      ? "รูปแบบขอราคา: รวมเป็นใบขอราคาเดียว — รายการแรกที่ติ๊กรวม = ชุดเงื่อนไขหลัก · รายการอื่น = สินค้าเพิ่มในชุดเดียวกัน"
      : "รูปแบบขอราคา: แยกใบเสนอราคา — แต่ละรายการที่ติ๊ก = หนึ่งใบ (เงื่อนไขครบชุดต่อใบ)"

  if (included.length === 0) {
    return { empty: true, modeLine }
  }

  const salesLine =
    `${p.salesName || "—"}${p.salesEmail.trim() ? ` <${p.salesEmail.trim()}>` : ""}`.trim()

  const meta: { label: string; value: string }[] = [
    { label: "อีเมลฝ่ายจัดราคา", value: ADMIN_QUOTE_EMAIL },
    { label: "ผู้ขอใบเสนอราคา", value: salesLine || "—" },
    { label: "อ้างอิงดีล", value: p.dealNo || "—" },
    { label: "ชื่อลูกค้า", value: dashVal(p.customerName) },
    { label: "ชื่อผู้ติดต่อ", value: dashVal(p.contactName) },
    { label: "เบอร์โทร", value: dashVal(p.phone) },
    { label: "E-mail", value: dashVal(p.email) },
  ]

  const blocks: EmailPreviewBlock[] =
    p.quoteStructure === "separate"
      ? included.map((L, i) => ({
          kind: "separate_quote" as const,
          quoteIndex: i + 1,
          rows: previewRowsFull(L),
        }))
      : (() => {
          const [first, ...rest] = included
          const out: EmailPreviewBlock[] = [
            {
              kind: "combined_primary",
              title: "รายการที่ 1 (หลัก — เงื่อนไขใช้กับรายการเพิ่มในชุดเดียวกัน)",
              rows: previewRowsFull(first),
            },
          ]
          rest.forEach((L, i) => {
            const lineNo = i + 2
            out.push({
              kind: "combined_supplement",
              title: `รายการที่ ${lineNo} (สินค้าเพิ่ม — ใช้ลูกค้า / ผู้ติดต่อ / ECD · กำหนดส่ง · ยืนราคา · งบปี ตามรายการที่ 1)`,
              rows: previewRowsCompact(L),
            })
          })
          return out
        })()

  return {
    empty: false,
    modeLine,
    meta,
    blocks,
    notes: p.notes.trim() || "—",
    salesSignOff: p.salesName.trim() || "",
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function htmlMultiline(s: string): string {
  return escapeHtml(s).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>")
}

/** HTML สำหรับวางในอีเมลแบบ rich — เส้นตารางชัด + โทนสี violet / slate */
function buildEmailHtmlFromPreview(preview: EmailPreview): string | null {
  if (preview.empty) return null

  const B = "1px solid #475569"
  const B_OUT = "2px solid #1e293b"

  const kvTable = (rows: { label: string; value: string }[]) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px;border:${B_OUT};background:#ffffff;table-layout:fixed;">${rows
      .map((r, i) => {
        const valueBg = i % 2 === 1 ? "#f1f5f9" : "#ffffff"
        return `<tr>
<td style="border:${B};background:#ede9fe;color:#4c1d95;font-weight:600;font-size:12px;padding:9px 11px;width:34%;vertical-align:top;">${escapeHtml(r.label)}</td>
<td style="border:${B};background:${valueBg};font-size:13px;padding:9px 11px;vertical-align:top;color:#0f172a;line-height:1.45;">${htmlMultiline(r.value)}</td>
</tr>`
      })
      .join("")}</table>`

  const blocksHtml = preview.blocks
    .map((b, i) => {
      const isSep = b.kind === "separate_quote"
      const title = isSep ? `ใบขอราคา ${b.quoteIndex} (แยกใบ)` : b.title
      const mt = i === 0 ? "0" : "16px"
      const head = isSep
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:${mt} 0 10px;"><tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed);color:#ffffff;padding:10px 14px;font-size:13px;font-weight:700;border:${B_OUT};">${escapeHtml(title)}</td></tr></table>`
        : `<p style="margin:${mt} 0 8px;padding:6px 0 8px;border-bottom:3px solid #7c3aed;font-size:12px;font-weight:700;color:#5b21b6;letter-spacing:0.01em;">${escapeHtml(title)}</p>`
      return head + kvTable(b.rows)
    })
    .join("")

  const bodyInner = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.55;max-width:720px;">
<p style="margin:0 0 8px;font-weight:700;font-size:15px;color:#0f172a;">เรียน ฝ่ายจัดทำใบเสนอราคา / Admin</p>
<p style="margin:0 0 16px;color:#334155;">ขอความอนุเคราะช่วยจัดทำ Draft ราคาตามรายละเอียดด้านล่าง เพื่อนำไปประกอบการเสนอลูกค้า</p>
<div style="margin:0 0 18px;padding:11px 14px;background:#f5f3ff;border:${B};border-left:5px solid #6d28d9;color:#4c1d95;font-size:12px;line-height:1.55;">${escapeHtml(preview.modeLine)}</div>
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">ข้อมูลอ้างอิง</p>
${kvTable(preview.meta)}
<p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">รายการสินค้า</p>
${blocksHtml}
<p style="margin:18px 0 6px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">หมายเหตุ</p>
<div style="margin:0 0 18px;padding:12px 14px;border:${B_OUT};background:#f8fafc;font-size:13px;color:#0f172a;white-space:pre-wrap;line-height:1.5;">${escapeHtml(preview.notes)}</div>
<p style="margin:0;font-weight:600;color:#1e293b;">ขอบคุณครับ</p>
${preview.salesSignOff ? `<p style="margin:6px 0 0;font-size:13px;color:#64748b;">${escapeHtml(preview.salesSignOff)}</p>` : ""}
</div>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body style="margin:0;padding:12px;background:#ffffff;">${bodyInner}</body></html>`
}

function PreviewKvTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
      <Table>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label} className="border-slate-100 hover:bg-slate-50/60">
              <TableCell className="w-[38%] max-w-[140px] align-top py-2 px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {r.label}
              </TableCell>
              <TableCell className="align-top py-2 px-3 text-xs text-slate-800 whitespace-pre-wrap break-words">
                {r.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function DraftQuotationPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [deals, setDeals] = useState<SEDeal[]>(() => readSEDeals([]))
  const [orgs, setOrgs] = useState<ASOrganization[]>(() => readOrganizations([]))
  const [dealId, setDealId] = useState<string>("")
  const [customerName, setCustomerName] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [quoteStructure, setQuoteStructure] = useState<QuotationDraftMode>("combined")
  const [lines, setLines] = useState<QuoteLineDraft[]>(() => [newLine()])
  const [notes, setNotes] = useState("")

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleDeals = useMemo(
    () =>
      !isAdmin && ownerName ? deals.filter((d) => (d.owner || "").trim() === ownerName) : deals,
    [deals, isAdmin, ownerName],
  )

  useEffect(() => {
    const hydrateDeals = () => setDeals(readSEDeals([]))
    const hydrateOrgs = () => setOrgs(readOrganizations([]))
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (!ev.key || ev.key === AS_STORE_KEYS.orgs) hydrateOrgs()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seDeals) hydrateDeals()
      if (key === AS_STORE_KEYS.orgs) hydrateOrgs()
    }
    hydrateDeals()
    hydrateOrgs()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const selectedDeal = useMemo(
    () => visibleDeals.find((d) => d.id === dealId) ?? null,
    [visibleDeals, dealId],
  )

  const firstIncludedId = useMemo(
    () => lines.find((l) => l.include_in_draft)?.id ?? null,
    [lines],
  )

  useEffect(() => {
    if (!selectedDeal) return
    const org = orgs.find((o) => o.name.trim() === (selectedDeal.customer_name || "").trim())
    const pc = primaryContact(org)
    if (!pc) return
    setContactName((c) => (c.trim() === "" ? pc.name : c))
    setPhone((t) => (t.trim() === "" ? pc.tel : t))
    setEmail((e) => (e.trim() === "" ? pc.email : e))
  }, [orgs, selectedDeal])

  const applyDeal = useCallback(
    (d: SEDeal) => {
      setQuoteStructure("combined")
      setCustomerName(d.customer_name || "")
      const org = orgs.find((o) => o.name.trim() === (d.customer_name || "").trim())
      const pc = primaryContact(org)
      setContactName(pc?.name ?? "")
      setPhone(pc?.tel ?? "")
      setEmail(pc?.email ?? "")
      setLines([
        newLine({
          include_in_draft: true,
          proposal_title: "",
          equipment_name: d.title || "",
          brand: d.manufacturer || "",
          model: d.product_model || "",
          qty: "1",
          accessories: "",
          loan_price_terms: "",
          ecd: d.expected_close_date || "",
          delivery_due: "",
          price_validity: "",
          budget_year: "",
        }),
      ])
    },
    [orgs],
  )

  const onDealChange = (id: string) => {
    setDealId(id)
    const d = visibleDeals.find((x) => x.id === id)
    if (d) applyDeal(d)
  }

  const updateLine = (id: string, patch: Partial<QuoteLineDraft>) => {
    setLines((prev) => prev.map((L) => (L.id === id ? { ...L, ...patch } : L)))
  }

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      newLine({
        include_in_draft: true,
        proposal_title: "",
        equipment_name: "",
        brand: "",
        model: "",
        qty: "1",
        accessories: "",
        loan_price_terms: "",
        ecd: "",
        delivery_due: "",
        price_validity: "",
        budget_year: "",
      }),
    ])

  const removeLine = (id: string) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((L) => L.id !== id)))

  const includedCount = useMemo(() => lines.filter((l) => l.include_in_draft).length, [lines])

  const dealNo = selectedDeal?.deal_no ?? "—"
  const body = useMemo(
    () =>
      buildEmailBody({
        salesName: ownerName,
        salesEmail: profile?.email ?? "",
        customerName,
        contactName,
        phone,
        email,
        dealNo,
        quoteStructure,
        lines,
        notes,
      }),
    [ownerName, profile?.email, customerName, contactName, phone, email, dealNo, quoteStructure, lines, notes],
  )

  const preview = useMemo(
    () =>
      buildEmailPreview({
        salesName: ownerName,
        salesEmail: profile?.email ?? "",
        customerName,
        contactName,
        phone,
        email,
        dealNo,
        quoteStructure,
        lines,
        notes,
      }),
    [ownerName, profile?.email, customerName, contactName, phone, email, dealNo, quoteStructure, lines, notes],
  )

  const copyDraft = async () => {
    if (includedCount === 0) {
      toast({
        title: "ยังคัดลอกไม่ได้",
        description: "ติ๊ก \"รวมใน draft นี้\" อย่างน้อย 1 รายการ",
        variant: "destructive",
      })
      return
    }
    const htmlDoc = buildEmailHtmlFromPreview(preview)
    try {
      if (htmlDoc && typeof ClipboardItem !== "undefined") {
        const plainBlob = new Blob([body], { type: "text/plain;charset=utf-8" })
        const htmlBlob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" })
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": plainBlob,
            "text/html": htmlBlob,
          }),
        ])
        toast({
          title: "คัดลอกแล้ว",
          description: "วางในอีเมล (โหมดเขียนแบบมีรูปแบบ) จะได้ตารางเส้นชัด — วางในที่อื่นได้ข้อความล้วน",
        })
      } else {
        await navigator.clipboard.writeText(body)
        toast({
          title: "คัดลอกแล้ว (ข้อความล้วน)",
          description: "เบราว์เซอร์นี้ไม่ส่ง HTML ไปคลิปบอร์ด — ใช้ข้อความธรรมดา",
        })
      }
    } catch {
      try {
        await navigator.clipboard.writeText(body)
        toast({
          title: "คัดลอกแล้ว (ข้อความล้วน)",
          description: "ตาราง HTML ไม่สำเร็จ — ใช้ข้อความธรรมดาแทน",
        })
      } catch {
        toast({ title: "คัดลอกไม่สำเร็จ", variant: "destructive" })
      }
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Draft Quotation"
        description="ร่างข้อความขอราคาจาก Admin — คัดลอกแล้ววางในอีเมลได้ตารางสีและเส้นแบ่งชัด"
        icon={FileText}
        action={{
          label: "คัดลอก (อีเมลตาราง)",
          onClick: copyDraft,
          icon: Copy,
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              ถึง{" "}
              <a className="font-medium text-violet-700 hover:underline" href={`mailto:${ADMIN_QUOTE_EMAIL}`}>
                {ADMIN_QUOTE_EMAIL}
              </a>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={quoteStructure === "combined" ? "default" : "ghost"}
                className={cn(
                  "h-8 gap-1 rounded-full px-3 text-xs",
                  quoteStructure === "combined" && "bg-violet-600 hover:bg-violet-700",
                )}
                onClick={() => setQuoteStructure("combined")}
              >
                <Layers className="h-3 w-3" />
                รวมใบ
              </Button>
              <Button
                type="button"
                size="sm"
                variant={quoteStructure === "separate" ? "default" : "ghost"}
                className={cn(
                  "h-8 gap-1 rounded-full px-3 text-xs",
                  quoteStructure === "separate" && "bg-violet-600 hover:bg-violet-700",
                )}
                onClick={() => setQuoteStructure("separate")}
              >
                <SplitSquareHorizontal className="h-3 w-3" />
                แยกใบ
              </Button>
              <span
                className="hidden text-[10px] text-muted-foreground sm:inline max-w-[220px] leading-snug"
                title={
                  quoteStructure === "combined"
                    ? "แถวแรกที่ติ๊กรวม = เงื่อนไขหลัก (ECD ฯลฯ) · แถวอื่นกรอกแค่สินค้า"
                    : "แต่ละแถวที่ติ๊ก = หนึ่งใบเสนอราคา กรอกเงื่อนไขครบได้ทุกแถว"
                }
              >
                {quoteStructure === "combined" ? "เงื่อนไขจากแถวแรกที่ติ๊ก" : "แถวละหนึ่งใบ"}
              </span>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                ดีล
              </span>
              <Select value={dealId || undefined} onValueChange={onDealChange}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200/90 text-sm">
                  <SelectValue placeholder="เลือกดีลจาก Pipeline" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {visibleDeals.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">ไม่มีดีล</div>
                  ) : (
                    visibleDeals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="font-mono text-[11px] text-muted-foreground">{d.deal_no}</span>{" "}
                        {d.title} · {d.customer_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="col-span-2">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  ลูกค้า
                </span>
                <Input
                  className="h-9 rounded-lg border-slate-200/90 text-xs"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="หน่วยงาน / โรงพยาบาล"
                />
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  ผู้ติดต่อ
                </span>
                <Input
                  className="h-9 rounded-lg border-slate-200/90 text-xs"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="ชื่อ"
                />
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  โทร
                </span>
                <Input
                  className="h-9 rounded-lg border-slate-200/90 text-xs"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เบอร์"
                />
              </div>
              <div className="col-span-2">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  E-mail
                </span>
                <Input
                  className="h-9 rounded-lg border-slate-200/90 text-xs"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="อีเมล"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="w-9 px-2 py-2 text-center" title="รวมใน draft">
                      <span className="sr-only">รวม</span>
                    </TableHead>
                    <TableHead className="w-8 px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      #
                    </TableHead>
                    <TableHead className="min-w-[100px] px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      รายการเสนอ
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      เครื่อง
                    </TableHead>
                    <TableHead className="min-w-[72px] px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      ยี่ห้อ
                    </TableHead>
                    <TableHead className="min-w-[80px] px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      รุ่น
                    </TableHead>
                    <TableHead className="w-14 px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      จน.
                    </TableHead>
                    <TableHead className="min-w-[88px] px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      อุปกรณ์
                    </TableHead>
                    <TableHead className="w-10 px-1 py-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((L, idx) => {
                    const showFields = L.include_in_draft
                    const showFull =
                      showFields &&
                      (quoteStructure === "separate" || (quoteStructure === "combined" && L.id === firstIncludedId))
                    const rowMuted = !L.include_in_draft

                    const cellIn =
                      "h-8 rounded-md border-slate-200/90 px-2 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-violet-500"

                    return (
                      <Fragment key={L.id}>
                        <TableRow
                          className={cn(
                            "border-slate-100",
                            rowMuted && "bg-slate-50/40 opacity-[0.72]",
                            showFull && quoteStructure === "combined" && L.id === firstIncludedId && idx > 0 && "bg-violet-50/25",
                          )}
                        >
                          <TableCell className="px-2 py-1.5 align-middle">
                            <input
                              type="checkbox"
                              checked={L.include_in_draft}
                              onChange={(e) => updateLine(L.id, { include_in_draft: e.target.checked })}
                              className="mx-auto block h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                              aria-label={`รวมแถว ${idx + 1} ใน draft`}
                            />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-center text-xs tabular-nums text-muted-foreground align-middle">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            {showFull ? (
                              <Input
                                className={cellIn}
                                value={L.proposal_title}
                                onChange={(e) => updateLine(L.id, { proposal_title: e.target.value })}
                                placeholder="ถ้าไม่ตรงรุ่น"
                                disabled={rowMuted}
                              />
                            ) : (
                              <span className="block px-1 text-xs text-muted-foreground/80">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <Input
                              className={cellIn}
                              value={L.equipment_name}
                              onChange={(e) => updateLine(L.id, { equipment_name: e.target.value })}
                              disabled={rowMuted}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <Input
                              className={cellIn}
                              value={L.brand}
                              onChange={(e) => updateLine(L.id, { brand: e.target.value })}
                              disabled={rowMuted}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <Input
                              className={cellIn}
                              value={L.model}
                              onChange={(e) => updateLine(L.id, { model: e.target.value })}
                              disabled={rowMuted}
                            />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 align-middle">
                            <Input
                              className={cn(cellIn, "text-center tabular-nums")}
                              value={L.qty}
                              onChange={(e) => updateLine(L.id, { qty: e.target.value })}
                              disabled={rowMuted}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <Input
                              className={cellIn}
                              value={L.accessories}
                              onChange={(e) => updateLine(L.id, { accessories: e.target.value })}
                              placeholder="สาย ฯลฯ"
                              disabled={rowMuted}
                            />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 align-middle">
                            {lines.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeLine(L.id)}
                                aria-label={`ลบแถว ${idx + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>

                        {showFull ? (
                          <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                            <TableCell colSpan={9} className="px-3 py-2">
                              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                                <div className="min-w-[120px]">
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    ยืมราคา
                                  </span>
                                  <Input
                                    className={cellIn}
                                    value={L.loan_price_terms}
                                    onChange={(e) => updateLine(L.id, { loan_price_terms: e.target.value })}
                                    placeholder="เงื่อนไข"
                                    disabled={rowMuted}
                                  />
                                </div>
                                <div className="w-[132px]">
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    ECD
                                  </span>
                                  <Input
                                    className={cellIn}
                                    type="date"
                                    value={L.ecd}
                                    onChange={(e) => updateLine(L.id, { ecd: e.target.value })}
                                    disabled={rowMuted}
                                  />
                                </div>
                                <div className="min-w-[100px] flex-1">
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    ส่งสินค้า
                                  </span>
                                  <Input
                                    className={cellIn}
                                    value={L.delivery_due}
                                    onChange={(e) => updateLine(L.id, { delivery_due: e.target.value })}
                                    placeholder="กำหนดส่ง"
                                    disabled={rowMuted}
                                  />
                                </div>
                                <div className="min-w-[88px]">
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    ยืนราคา
                                  </span>
                                  <Input
                                    className={cellIn}
                                    value={L.price_validity}
                                    onChange={(e) => updateLine(L.id, { price_validity: e.target.value })}
                                    placeholder="เช่น 30 วัน"
                                    disabled={rowMuted}
                                  />
                                </div>
                                <div className="min-w-[100px]">
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    งบปี
                                  </span>
                                  <Input
                                    className={cellIn}
                                    value={L.budget_year}
                                    onChange={(e) => updateLine(L.id, { budget_year: e.target.value })}
                                    placeholder="FY / พ.ศ."
                                    disabled={rowMuted}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-lg px-2 text-xs text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                onClick={addLine}
              >
                <Plus className="h-3.5 w-3.5" />
                เพิ่มแถว
              </Button>
              <p className="text-[10px] text-muted-foreground leading-snug">
                ไม่ติ๊ก = ไม่อยู่ในข้อความที่คัดลอก · แยกใบ = แต่ละแถวที่ติ๊กเป็นหนึ่งใบในอีเมล
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 p-4">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              หมายเหตุ
            </span>
            <Textarea
              className="min-h-[72px] resize-y rounded-xl border-slate-200/90 text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เพิ่มเติมให้ Admin..."
            />
          </div>
        </div>

        <Card className="rounded-3xl border-slate-200/80 shadow-sm lg:sticky lg:top-4 h-fit max-h-[min(85vh,720px)] flex flex-col">
          <CardHeader className="border-b border-slate-100 shrink-0">
            <CardTitle className="text-sm font-semibold text-slate-800">ตัวอย่างข้อความ</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal leading-relaxed">
              รวมใน draft: {includedCount} รายการ · {quoteStructure === "combined" ? "รวมใบ" : "แยกใบ"}
              <span className="mt-1 block text-[10px] text-muted-foreground/90">
                คัดลอกส่งทั้ง HTML (ตาราง + สี) และข้อความล้วน — วางใน Gmail/Outlook แบบจัดรูปแบบ
              </span>
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 min-h-0 flex-col gap-0 overflow-hidden p-4">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
              {preview.empty ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3 text-xs text-amber-950/90">
                  <p className="mb-1 font-medium">ยังไม่มีรายการในอีเมล</p>
                  <p className="text-[11px] leading-relaxed text-amber-900/85">
                    ติ๊กรวมใน draft อย่างน้อย 1 แถวก่อนคัดลอก
                  </p>
                  <p className="mt-2 border-t border-amber-100/80 pt-2 text-[10px] leading-snug text-muted-foreground">
                    {preview.modeLine}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                    <p className="font-medium text-slate-800">เรียน ฝ่ายจัดทำใบเสนอราคา / Admin</p>
                    <p>
                      ขอความอนุเคราะช่วยจัดทำ Draft ราคาตามรายละเอียดด้านล่าง เพื่อนำไปประกอบการเสนอลูกค้า
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[10px] leading-snug text-slate-600">
                    {preview.modeLine}
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      ข้อมูลอ้างอิง
                    </p>
                    <PreviewKvTable rows={preview.meta} />
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      รายการสินค้า
                    </p>
                    <div className="space-y-3">
                      {preview.blocks.map((b, i) => (
                        <div key={`${b.kind}-${i}`}>
                          <p
                            className={cn(
                              "mb-1.5 text-[11px] font-medium leading-snug",
                              b.kind === "separate_quote" ? "text-violet-800" : "text-slate-700",
                            )}
                          >
                            {b.kind === "separate_quote"
                              ? `ใบขอราคา ${b.quoteIndex} (แยกใบ)`
                              : b.title}
                          </p>
                          <PreviewKvTable rows={b.rows} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      หมายเหตุ
                    </p>
                    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {preview.notes}
                    </div>
                  </div>
                  <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                    ขอบคุณครับ
                    {preview.salesSignOff ? (
                      <span className="mt-1 block text-[11px] text-slate-500">{preview.salesSignOff}</span>
                    ) : null}
                  </p>
                </>
              )}
            </div>
            <Button
              type="button"
              className="mt-4 w-full shrink-0 rounded-2xl bg-violet-600 hover:bg-violet-700"
              onClick={copyDraft}
            >
              <Copy className="mr-2 h-4 w-4" />
              คัดลอกตาราง + ข้อความล้วน
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
