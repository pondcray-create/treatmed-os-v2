export interface Province {
  name: string
  region: string
  healthDistrict: number
}

export const PROVINCES: Province[] = [
  // เขต 1
  { name: "เชียงใหม่", region: "เหนือ", healthDistrict: 1 },
  { name: "เชียงราย", region: "เหนือ", healthDistrict: 1 },
  { name: "น่าน", region: "เหนือ", healthDistrict: 1 },
  { name: "พะเยา", region: "เหนือ", healthDistrict: 1 },
  { name: "แพร่", region: "เหนือ", healthDistrict: 1 },
  { name: "แม่ฮ่องสอน", region: "เหนือ", healthDistrict: 1 },
  { name: "ลำปาง", region: "เหนือ", healthDistrict: 1 },
  { name: "ลำพูน", region: "เหนือ", healthDistrict: 1 },
  // เขต 2
  { name: "ตาก", region: "เหนือ", healthDistrict: 2 },
  { name: "พิษณุโลก", region: "เหนือ", healthDistrict: 2 },
  { name: "เพชรบูรณ์", region: "เหนือ", healthDistrict: 2 },
  { name: "สุโขทัย", region: "เหนือ", healthDistrict: 2 },
  { name: "อุตรดิตถ์", region: "เหนือ", healthDistrict: 2 },
  // เขต 3
  { name: "กำแพงเพชร", region: "กลาง", healthDistrict: 3 },
  { name: "ชัยนาท", region: "กลาง", healthDistrict: 3 },
  { name: "นครสวรรค์", region: "กลาง", healthDistrict: 3 },
  { name: "พิจิตร", region: "กลาง", healthDistrict: 3 },
  { name: "อุทัยธานี", region: "กลาง", healthDistrict: 3 },
  // เขต 4
  { name: "นนทบุรี", region: "กลาง", healthDistrict: 4 },
  { name: "ปทุมธานี", region: "กลาง", healthDistrict: 4 },
  { name: "พระนครศรีอยุธยา", region: "กลาง", healthDistrict: 4 },
  { name: "สระบุรี", region: "กลาง", healthDistrict: 4 },
  { name: "อ่างทอง", region: "กลาง", healthDistrict: 4 },
  { name: "นครนายก", region: "กลาง", healthDistrict: 4 },
  { name: "ลพบุรี", region: "กลาง", healthDistrict: 4 },
  { name: "สิงห์บุรี", region: "กลาง", healthDistrict: 4 },
  // เขต 5
  { name: "กาญจนบุรี", region: "กลาง", healthDistrict: 5 },
  { name: "นครปฐม", region: "กลาง", healthDistrict: 5 },
  { name: "ประจวบคีรีขันธ์", region: "กลาง", healthDistrict: 5 },
  { name: "เพชรบุรี", region: "กลาง", healthDistrict: 5 },
  { name: "ราชบุรี", region: "กลาง", healthDistrict: 5 },
  { name: "สมุทรสาคร", region: "กลาง", healthDistrict: 5 },
  { name: "สมุทรสงคราม", region: "กลาง", healthDistrict: 5 },
  { name: "สุพรรณบุรี", region: "กลาง", healthDistrict: 5 },
  // เขต 6
  { name: "ฉะเชิงเทรา", region: "ตะวันออก", healthDistrict: 6 },
  { name: "ชลบุรี", region: "ตะวันออก", healthDistrict: 6 },
  { name: "ตราด", region: "ตะวันออก", healthDistrict: 6 },
  { name: "จันทบุรี", region: "ตะวันออก", healthDistrict: 6 },
  { name: "ปราจีนบุรี", region: "ตะวันออก", healthDistrict: 6 },
  { name: "ระยอง", region: "ตะวันออก", healthDistrict: 6 },
  { name: "สมุทรปราการ", region: "ตะวันออก", healthDistrict: 6 },
  { name: "สระแก้ว", region: "ตะวันออก", healthDistrict: 6 },
  // เขต 7
  { name: "กาฬสินธุ์", region: "อีสาน", healthDistrict: 7 },
  { name: "ขอนแก่น", region: "อีสาน", healthDistrict: 7 },
  { name: "มหาสารคาม", region: "อีสาน", healthDistrict: 7 },
  { name: "ร้อยเอ็ด", region: "อีสาน", healthDistrict: 7 },
  // เขต 8
  { name: "นครพนม", region: "อีสาน", healthDistrict: 8 },
  { name: "บึงกาฬ", region: "อีสาน", healthDistrict: 8 },
  { name: "มุกดาหาร", region: "อีสาน", healthDistrict: 8 },
  { name: "เลย", region: "อีสาน", healthDistrict: 8 },
  { name: "สกลนคร", region: "อีสาน", healthDistrict: 8 },
  { name: "หนองคาย", region: "อีสาน", healthDistrict: 8 },
  { name: "หนองบัวลำภู", region: "อีสาน", healthDistrict: 8 },
  { name: "อุดรธานี", region: "อีสาน", healthDistrict: 8 },
  // เขต 9
  { name: "ชัยภูมิ", region: "อีสาน", healthDistrict: 9 },
  { name: "นครราชสีมา", region: "อีสาน", healthDistrict: 9 },
  { name: "บุรีรัมย์", region: "อีสาน", healthDistrict: 9 },
  { name: "สุรินทร์", region: "อีสาน", healthDistrict: 9 },
  // เขต 10
  { name: "อุบลราชธานี", region: "อีสาน", healthDistrict: 10 },
  { name: "ยโสธร", region: "อีสาน", healthDistrict: 10 },
  { name: "ศรีสะเกษ", region: "อีสาน", healthDistrict: 10 },
  { name: "อำนาจเจริญ", region: "อีสาน", healthDistrict: 10 },
  // เขต 11
  { name: "กระบี่", region: "ใต้", healthDistrict: 11 },
  { name: "ชุมพร", region: "ใต้", healthDistrict: 11 },
  { name: "นครศรีธรรมราช", region: "ใต้", healthDistrict: 11 },
  { name: "พังงา", region: "ใต้", healthDistrict: 11 },
  { name: "ภูเก็ต", region: "ใต้", healthDistrict: 11 },
  { name: "ระนอง", region: "ใต้", healthDistrict: 11 },
  { name: "สุราษฎร์ธานี", region: "ใต้", healthDistrict: 11 },
  // เขต 12
  { name: "ตรัง", region: "ใต้", healthDistrict: 12 },
  { name: "นราธิวาส", region: "ใต้", healthDistrict: 12 },
  { name: "ปัตตานี", region: "ใต้", healthDistrict: 12 },
  { name: "พัทลุง", region: "ใต้", healthDistrict: 12 },
  { name: "ยะลา", region: "ใต้", healthDistrict: 12 },
  { name: "สงขลา", region: "ใต้", healthDistrict: 12 },
  { name: "สตูล", region: "ใต้", healthDistrict: 12 },
  // เขต 13
  { name: "กรุงเทพมหานคร", region: "กลาง", healthDistrict: 13 },
]

export function getProvinceInfo(name: string): Province | undefined {
  return PROVINCES.find(p => p.name === name)
}

export const DEFAULT_ORG_TYPES = ["Existing", "New"]

export const DEFAULT_ORG_FORMATS = [
  "Large Hospital รัฐ",
  "Large Hospital เอกชน",
  "Small Hospital รัฐ",
  "Small Hospital เอกชน",
  "คลินิก",
  "มหาวิทยาลัย",
  "ศูนย์บริการสาธารณสุข",
]

export const DEFAULT_POSITIONS = [
  "ฝ่ายจัดซื้อ",
  "แพทย์",
  "พยาบาล",
  "นักรังสีเทคนิค",
  "วิศวกรชีวการแพทย์",
  "เจ้าหน้าที่ไอที",
  "ผู้บริหาร",
  "ผู้จัดการ",
]
