import { getProvinceInfo } from "@/lib/data/geography"
import type { ASOrganization } from "@/lib/mock/as-store"
import { newId } from "@/lib/new-id"

export type RegisterSyncPayload = {
  name: string
  name_english?: string
  province?: string
  region?: string
  health_district?: number
}

/** Upsert องค์กรใน Customer Register ให้ชื่อตรงกับดีล — เติมจังหวัด/เขตเมื่อ Register ยังว่าง */
export function mergeCustomerIntoRegister(orgs: ASOrganization[], p: RegisterSyncPayload): ASOrganization[] {
  const name = p.name.trim()
  if (!name) return orgs
  const norm = name.toLowerCase()
  const hit = orgs.find((o) => o.name.trim().toLowerCase() === norm)
  const prov = (p.province || "").trim()
  const g = prov ? getProvinceInfo(prov) : undefined
  const region = (p.region || "").trim() || g?.region || ""
  const hd =
    p.health_district != null && Number(p.health_district) > 0
      ? Number(p.health_district)
      : g?.healthDistrict ?? 0
  const en = (p.name_english || "").trim()

  if (hit) {
    return orgs.map((o) => {
      if (o.id !== hit.id) return o
      const nextProv = (o.province || "").trim() ? o.province : prov
      const ng = (nextProv || "").trim() ? getProvinceInfo(nextProv) : undefined
      const keepHd = o.health_district && o.health_district > 0
      const keepEn = (o.name_english || "").trim()
      return {
        ...o,
        province: (o.province || "").trim() || nextProv || o.province,
        region: (o.region || "").trim() || region || ng?.region || o.region,
        health_district: keepHd ? o.health_district : hd || ng?.healthDistrict || o.health_district,
        ...(en && !keepEn ? { name_english: en } : {}),
      }
    })
  }

  const fresh: ASOrganization = {
    id: newId("org"),
    name,
    ...(en ? { name_english: en } : {}),
    org_type: "New",
    org_format: "",
    province: prov,
    region: region || g?.region || "",
    health_district: hd || g?.healthDistrict || 0,
    one_qa: false,
    contacts: [],
    created_at: new Date().toISOString(),
  }
  return [fresh, ...orgs]
}

/** หลัง import ดีลหลายรายการ — sync ชื่อลูกค้าเข้า Register */
export function mergeManyDealsIntoRegister(
  orgs: ASOrganization[],
  deals: {
    customer_name?: string
    customer_name_english?: string
    province?: string
    region?: string
    health_district?: number
  }[],
): ASOrganization[] {
  let next = orgs
  for (const d of deals) {
    const n = (d.customer_name || "").trim()
    if (!n) continue
    next = mergeCustomerIntoRegister(next, {
      name: n,
      name_english: d.customer_name_english,
      province: d.province,
      region: d.region,
      health_district: d.health_district,
    })
  }
  return next
}
