# Export สำหรับให้ AI ตัวอื่นวิเคราะห์

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `stock-page.tsx` | หน้า **AS Stock** ทั้งไฟล์ (`app/(dashboard)/as/stock/page.tsx`) — UI + state + flow รับเข้า, Booking, Sold, Loan, Demo, Service trace, Quick Action, dialogs |
| `as-store.ts` | Mock store ที่ Stock อ่าน/เขียน (`lib/mock/as-store.ts`) — jobs, dispatches, proactive cal, organizations, transactions pattern |

## โปรเจกต์

- **TreatMed OS V2** — Next.js 15, React 19, TypeScript
- Stock ยังไม่ต่อ Supabase จริง — ข้อมูล mock / localStorage ผ่าน `as-store`

## วิธีใช้

1. แนบไฟล์ `stock-page.tsx` (และถ้าต้องการ context store แนบ `as-store.ts`) ไปที่ AI อีกตัว  
2. หรือเปิดไฟล์ใน repo แล้ว Copy ทั้งไฟล์จาก Cursor / VS Code

หมายเหตุ: `stock-page.tsx` ขนาดใหญ่ (~180KB) — บางโมเดลอาจให้แบ่งส่งเป็นส่วนๆ ตามหัวข้อ (เช่น types + helpers, แล้วค่อย component หลัก)
