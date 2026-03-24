# KPI Definitions by Module

เอกสารนี้ใช้เป็นแหล่งอ้างอิงกลางสำหรับนิยาม KPI ในแต่ละโมดูล เพื่อให้ระบบเก็บข้อมูลครบตั้งแต่แรกและคำนวณได้สม่ำเสมอ

## ทำไมต้องมี KPI Definition

- Requirement คือ "จับ KPI ทุกอย่าง" แต่ถ้าไม่กำหนดนิยาม/สูตร/รอบวัดให้ชัด ระบบจะเก็บข้อมูลไม่ครบ
- ถ้าเริ่มเก็บผิดตั้งแต่ต้น จะย้อนกลับมาแก้ยากและกระทบ historical data
- เอกสารนี้ต้องถูกใช้คู่กับการออกแบบ schema, API, และรายงาน dashboard

## กติกาการนิยาม KPI

- `Numerator` และ `Denominator` ต้องชัดเจน
- ระบุ timezone มาตรฐานเป็น `Asia/Bangkok`
- ระบุรอบ reset (`Reset Cycle`) และ snapshot time
- นิยามขอบเขตข้อมูลที่นับ (`Included`) และไม่นับ (`Excluded`)
- ระบุ minimum data fields ที่ต้องเก็บต่อ event

---

## 4) KPI Definition แต่ละ Module

| Module | KPI | สูตรคำนวณ | เป้าหมาย (ตัวอย่าง) | Reset Cycle |
|---|---|---|---|---|
| Sales | Win Rate | `Closed Won / Total Deals × 100` | `>= 40%` | Monthly |
| Sales | Forecast Accuracy | `Actual Revenue / Forecasted × 100` | `>= 85%` | Monthly |
| Sales | Deal Cycle Time | `Closed Date - Start Date` (วัน) | `<= 90 วัน` | Per Deal |
| Repair | TAT (Turnaround Time) | `วันที่เสร็จ - วันที่รับเครื่อง` | `<= 14 วัน` | Per Job |
| Repair | First-time Fix Rate | `แก้สำเร็จครั้งเดียว / ทั้งหมด × 100` | `>= 80%` | Monthly |
| Calibration | On-time Cal Rate | `ส่ง cert ตรงเวลา / ทั้งหมด × 100` | `>= 95%` | Monthly |
| Calibration | Proactive Cal Conversion | `เครื่องที่แจ้งเตือนแล้ว cal จริง / ทั้งหมด × 100` | `>= 60%` | Quarterly |
| Stock | Inventory Accuracy | `รายการที่ตรงจริง / ทั้งหมด × 100` | `>= 98%` | Monthly |
| Stock | Avg. Receiving Time | `เวลาเฉลี่ยรับเครื่องเข้าระบบ (ชม.)` | `<= 4 ชม.` | Per Transaction |

---

## Data Requirements ต่อ KPI (Minimum Fields)

### Sales
- Win Rate
  - `deal_id`, `stage`, `closed_at`, `is_closed_won`
- Forecast Accuracy
  - `period`, `forecast_amount`, `actual_revenue_amount`
- Deal Cycle Time
  - `deal_id`, `created_at`, `closed_at`

### Repair
- TAT
  - `job_id`, `received_at`, `completed_at`, `job_type`
- First-time Fix Rate
  - `job_id`, `is_first_time_fix`, `completed_at`

### Calibration
- On-time Cal Rate
  - `job_id`, `due_date`, `certificate_issued_at`, `is_on_time`
- Proactive Cal Conversion
  - `asset_id`, `alert_sent_at`, `calibrated_at`, `is_converted`

### Stock
- Inventory Accuracy
  - `count_session_id`, `item_id`, `expected_qty`, `counted_qty`
- Avg. Receiving Time
  - `transaction_id`, `receive_started_at`, `recorded_at`

---

## Included / Excluded Rules (Baseline)

- Win Rate
  - Included: ดีลที่ปิดผลแล้ว (`won`, `lost`)
  - Excluded: ดีลที่ยัง open
- Repair TAT
  - Included: งานซ่อมที่ `completed_at` ไม่ว่าง
  - Excluded: งานที่ยกเลิกก่อนเริ่มซ่อม
- Calibration On-time
  - Included: งาน calibration ที่มีการออก cert
  - Excluded: งาน commissioning (ไม่ใช่ calibration ปกติ)
- Stock Receiving Time
  - Included: รายการรับเข้า stock ที่มีทั้ง start/end timestamp
  - Excluded: backfill data ที่ไม่มี timestamp ครบ

---

## Notes for Implementation

- ควรเก็บค่าดิบ (raw events) และทำ aggregation แยก
- ไม่ควรเก็บเฉพาะค่า KPI สำเร็จรูปอย่างเดียว
- เพิ่ม version ให้สูตร KPI เมื่อมีการเปลี่ยนนิยาม
- ทุก KPI ควรมี owner (ทีม/บทบาทที่รับผิดชอบ)

---

## Next Step Suggested

- สร้างไฟล์ mapping ต่อ: `KPI -> source table/field -> dashboard widget`
- เพิ่ม validation ใน Settings สำหรับ KPI target (`>=`, `<=`, `%`, unit`)
- เพิ่ม job สำหรับคำนวณ KPI รายวัน/รายเดือนแบบ scheduled

