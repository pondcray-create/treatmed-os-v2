# KPI Data Dictionary

เอกสารนี้กำหนดว่า KPI แต่ละตัวต้องใช้ข้อมูลจาก field ไหน เพื่อให้เก็บข้อมูลตั้งแต่แรกได้ครบและคำนวณได้จริง

## Scope

- ใช้ร่วมกับ `docs/KPI_DEFINITIONS.md`
- ใช้เป็น checklist ตอนออกแบบ DB/API/Event
- timezone มาตรฐาน: `Asia/Bangkok`

## Dictionary

| KPI | Source Entity | Required Fields | Derived Fields | Notes |
|---|---|---|---|---|
| Sales Win Rate | `deals` | `deal_id`, `stage`, `closed_at` | `is_won` | นับเฉพาะ deals ที่ปิด (`won/lost`) |
| Sales Forecast Accuracy | `forecast_snapshots`, `revenue` | `period`, `forecast_amount`, `actual_amount` | `accuracy_pct` | แยก snapshot กับ actual เพื่อ audit |
| Sales Deal Cycle Time | `deals` | `deal_id`, `created_at`, `closed_at` | `cycle_days` | นับเป็นวันปฏิทิน |
| Repair TAT | `service_jobs` | `job_id`, `received_at`, `completed_at`, `job_type` | `tat_days` | ใช้เฉพาะ `job_type=repair` |
| Repair First-time Fix Rate | `service_jobs` | `job_id`, `is_first_time_fix`, `completed_at` | `fix_rate_pct` | ต้องมีนิยาม first-time fix ชัดเจน |
| Calibration On-time Cal Rate | `service_jobs`, `certificates` | `job_id`, `due_date`, `certificate_issued_at` | `is_on_time` | ใช้เฉพาะ calibration จริง ไม่รวม commissioning |
| Calibration Proactive Conversion | `proactive_alerts`, `service_jobs` | `asset_id`, `alert_sent_at`, `calibrated_at` | `is_converted` | จับคู่ด้วย `asset_id`/`serial_number` |
| Stock Inventory Accuracy | `stock_counts` | `count_session_id`, `item_id`, `expected_qty`, `counted_qty` | `is_match`, `variance` | สรุปทั้งระดับ session และราย item |
| Stock Avg. Receiving Time | `stock_transactions` | `transaction_id`, `receive_started_at`, `recorded_at` | `receiving_hours` | บันทึกทั้งเริ่มรับและเวลาลงระบบ |

## Event Contracts (Recommended)

### Service Job Lifecycle Event
- `event_id`
- `job_id`
- `status_from`
- `status_to`
- `actor_role`
- `occurred_at`
- `required_data_snapshot` (JSON)

### Stock Receiving Event
- `transaction_id`
- `item_id`
- `receive_started_at`
- `recorded_at`
- `actor_id`

### KPI Snapshot Event
- `kpi_id`
- `period_start`
- `period_end`
- `value`
- `target`
- `computed_at`
- `formula_version`

## Validation Rules

- ห้ามคำนวณ KPI ถ้า required fields ไม่ครบ
- ถ้า `closed_at < created_at` ให้ mark invalid data
- ถ้า missing timezone ให้ convert เป็น `Asia/Bangkok` ก่อน aggregate
- ต้อง version สูตร (`formula_version`) ทุกครั้งที่ KPI definition เปลี่ยน

## Admin-only KPI Governance

- แก้/เพิ่ม KPI Definitions จากหน้า Settings ได้เฉพาะ role `admin`
- ทุกการแก้ definition ควร log:
  - `changed_by`
  - `changed_at`
  - `before`
  - `after`
  - `reason`

