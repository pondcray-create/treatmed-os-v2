/**
 * นโยบายชื่อลูกค้า / หน่วยงาน + เดาโหมด รพ.รัฐ vs อื่นๆ จาก Segment ที่เลือก
 */

export const CUSTOMER_ORG_NAMING_HINT_TH =
  "ใช้ชื่อหน่วยงานแบบเต็มตามทางการ (ไม่ใช้คำย่อ เช่น เขียน โรงพยาบาลราชวิถี ไม่ใช่ ร.พ. ราชวิถี) — ชื่อหลักในระบบใช้ภาษาไทยเพื่อค้นหาและจับคู่กับ Customer Register"

export const CUSTOMER_ORG_NAMING_HINT_EN =
  "ถ้ามีชื่อจดทะเบียน/ชื่อบริษัทภาษาอังกฤษ ให้ใส่ช่องแยก และสะกดให้ตรงกับเอกสารทางการ — ช่วยลดดีลซ้ำเมื่อมีทั้งชื่อไทยและอังกฤษ"

/** จาก label Segment ใน Settings — เดาว่าควรใช้ flow รพ.รัฐ (lookup จังหวัด) หรืออื่นๆ; null = ให้ผู้ใช้เลือกเอง */
export function inferGeographySegmentFromMarketLabel(label: string): "public_hospital" | "other" | null {
  const s = (label || "").trim()
  if (!s) return null
  if (
    /รพ\.?\s*รัฐ|โรงพยาบาลรัฐ|ภาครัฐ|รัฐบาล|government|gov\.?\s*hospital|large\s*hospital.*government|มหาวิทยาลัย.*แพทย์|หน่วยงานรัฐ/i.test(
      s,
    )
  ) {
    return "public_hospital"
  }
  if (
    /เอกชน|private\s*hospital|oem|คลินิก|บริษัท|จำกัด|มหาชน|corporate|distributor|vendor|dealer|นิติบุคคล|company/i.test(
      s,
    )
  ) {
    return "other"
  }
  return null
}
