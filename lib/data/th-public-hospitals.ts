import { getProvinceInfo, type Province } from "@/lib/data/geography"

/**
 * คีย์เวิร์ดจับคู่ชื่อ รพ.ภาครัฐ → จังหวัดที่ตั้งหลัก (ข้อมูลอ้างอิงเพื่อช่วยกรอกอัตโนมัติ — ขยายรายการได้ในอนาคต)
 */
const HOSPITAL_PROVINCE_HINTS: { hints: string[]; province: string }[] = [
  { hints: ["ศิริราช", "siriraj"], province: "กรุงเทพมหานคร" },
  { hints: ["รามาธิบดี", "ramathibodi"], province: "กรุงเทพมหานคร" },
  { hints: ["จุฬาลงกรณ์", "chulalongkorn", "คิง เช่า เกอร์ส", "คิงเช่าเกอร์ส"], province: "กรุงเทพมหานคร" },
  { hints: ["พระมงกุฎ", "phyathai 1", "พญาไท 1"], province: "กรุงเทพมหานคร" },
  { hints: ["วชิรพยาบาล", "vajira"], province: "กรุงเทพมหานคร" },
  { hints: ["ตากสิน", "taksin"], province: "กรุงเทพมหานคร" },
  { hints: ["มหาราชนครราชสีมา", "รพ.มหาราช โคราช", "maharaj nakhon ratchasima"], province: "นครราชสีมา" },
  { hints: ["มหาราชนครเชียงใหม่", "เชียงใหม่ มหาราช", "maharaj nakorn chiangmai"], province: "เชียงใหม่" },
  { hints: ["นครพิงค์", "nakornping"], province: "เชียงใหม่" },
  { hints: ["สวรรค์ประชารักษ์", "sawan pracharak"], province: "นครสวรรค์" },
  { hints: ["พุทธชินราช", "phutthachinnarat"], province: "พิษณุโลก" },
  { hints: ["พระนครศรีอยุธยา รพ.", "รพ.พระนครศรีอยุธยา"], province: "พระนครศรีอยุธยา" },
  { hints: ["ราชบุรี รพ.", "รพ.ราชบุรี"], province: "ราชบุรี" },
  { hints: ["สมเด็จพระยุพราช", "yupparaj"], province: "แพร่" },
  { hints: ["ศรีนครินทร์", "srinagarind"], province: "ขอนแก่น" },
  { hints: ["มหาราชอุบล", "ubonratchathani maharaj"], province: "อุบลราชธานี" },
  { hints: ["สระแก้ว รพ.", "รพ.สระแก้ว"], province: "สระแก้ว" },
  { hints: ["สงขลา รพ.", "รพ.สงขลา", "hat yai hospital", "หาดใหญ่"], province: "สงขลา" },
  { hints: ["สุราษฎร์ธานี รพ.", "รพ.สุราษฎร์"], province: "สุราษฎร์ธานี" },
  { hints: ["ภูเก็ต รพ.", "รพ.ภูเก็ต"], province: "ภูเก็ต" },
  { hints: ["นครศรีธรรมราช", "มหาราชนครศรี"], province: "นครศรีธรรมราช" },
  { hints: ["พระปกเกล้า", "phrapokklao"], province: "จันทบุรี" },
  { hints: ["ชลบุรี รพ.", "รพ.ชลบุรี"], province: "ชลบุรี" },
  { hints: ["ระยอง รพ.", "รพ.ระยอง"], province: "ระยอง" },
  { hints: ["ร้อยเอ็ด รพ.", "รพ.ร้อยเอ็ด"], province: "ร้อยเอ็ด" },
  { hints: ["อุดรธานี รพ.", "รพ.อุดร"], province: "อุดรธานี" },
  { hints: ["ลำปาง รพ.", "รพ.ลำปาง"], province: "ลำปาง" },
  { hints: ["แม่ฮ่องสอน รพ.", "รพ.แม่ฮ่องสอน"], province: "แม่ฮ่องสอน" },
  { hints: ["แพร่ รพ.", "รพ.แพร่"], province: "แพร่" },
  { hints: ["พะเยา รพ.", "รพ.พะเยา"], province: "พะเยา" },
]

/** ค้นหาจังหวัดจากชื่อ/คีย์เวิร์ด รพ.รัฐ — คืน null ถ้าไม่พบ */
export function resolvePublicHospitalProvince(raw: string): string | null {
  const n = raw.normalize("NFC").trim()
  if (!n) return null
  const lower = n.toLowerCase()
  for (const row of HOSPITAL_PROVINCE_HINTS) {
    for (const h of row.hints) {
      if (n.includes(h) || lower.includes(h.toLowerCase())) return row.province
    }
  }
  return null
}

/** จังหวัด → ภูมิภาค + เลขเขตสุขภาพ (ตามชุด PROVINCES) */
export function resolveProvinceGeo(provinceName: string): Province | undefined {
  return getProvinceInfo(provinceName.trim())
}

export function formatHealthDistrictLabel(district: number): string {
  return `เขตสุขภาพที่ ${district}`
}
