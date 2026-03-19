# TreatMed OS — Project Context for Claude

## Project Overview
TreatMed OS V2 — CRM + After Service + Sales system for medical equipment distributor.
Stack: Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase (not yet connected), shadcn/ui.
Working directory: `C:\Users\POND\OneDrive\เดสก์ท็อป\Treatmed-os-v2`

## Dev Mode
Supabase is NOT connected. `.env.local` has placeholder values.
Middleware bypasses auth when `NEXT_PUBLIC_SUPABASE_URL === "your-supabase-url"`.
`lib/supabase/client.ts` returns placeholder client in dev mode.
App goes directly to `/dashboard` without login.

## Design Principles
- Apple-style UI: clean, white, rounded-3xl cards, generous whitespace
- Accent: blue-500 primary, violet for One-QA, emerald for Existing, amber for New
- All dropdowns configurable from Settings page (Admin only)

## Modules
- **AS Module** — After Service (as_staff + admin)
- **SE Module** — Sales Engineer (se_staff + admin)

---

## AS MODULE SPEC

### Customer / Organization
- 1 org = many contacts (has 1 primary contact `is_primary`)
- Fields: name, org_type (Existing/New), org_format (Large Hospital รัฐ/เอกชน/etc.), province → auto-fill region + health_district, one_qa (Yes/No)
- Province → Region + Health District mapping: `lib/data/geography.ts`
- Contact fields: name, position (dropdown + free text), email, tel, is_primary
- Default positions: lib/data/geography.ts `DEFAULT_POSITIONS`
- Org types/formats/positions all editable in Settings

### Service Jobs (Repair & Calibration)
**Repair Workflow:**
1. รับเครื่อง: tracking_in, photos, channel (พนักงาน/ขนส่ง)
2. Stock จ่ายงาน: job_type (repair/calibration), assign technician
   - ถ้าลูกค้าไม่มีในระบบ → auto-register
3. Equipment Card: serial_number, manufacturer, model, received_date, customer (sync), symptom
   - routing: in_country | overseas
   - overseas: RMA Code required
4. Status tracking (Admin-configurable):
   รอประเมิน → ประเมิน → รอ Quotation Approve → (skip option) → รอ PO → ในคิว → กำลังซ่อม → รออะไหล่ → QC → รอส่งคืน → ปิดงาน
5. Quotation: Draft template (copy to email), Admin sets price, requires_approval flag (default true, can skip)
6. Parts: technician selects → stock approves → auto-deduct
7. Service Report: symptom_actual, fix_method, parts_used, photos_after
8. Close: tracking_out, invoice, warranty_days (free text per job), photos

**Calibration additions:**
- Lab routing: domestic → select lab (dropdown in Settings, default: NIMT, TNI, มจธ.)
- Overseas: RMA Code
- Certificate per SN (from manufacturer lab + local lab)
- due_date = calibration_date + 1 year (auto)
- Alerts: 3 months before + 1 month before expiry (proactive)
- Dashboard: "Calibration Due" list

**Special Equipment:**
- IDA6: Display unit (1 SN) + modules (1-4, each own SN, interchangeable)
  - Jobs can be for whole unit OR individual modules
- ProSim8 + SPOT Module: 1 job, 2 SNs
- PS320 + MFH-1: ordered together, may repair separately
- Certificate per SN

### Stock Module
**Categories:** Spare Parts, Module สำรอง, Sellable Equipment, Consumables, Tools, Demo Unit
**Receiving:** PO required always (from Supplier local/overseas, Return from customer, RMA return)
**One warehouse** (no van stock)
**Item status flow:**
- Sellable: In Stock → Reserved (Sales books) → Sold
- Demo: In Stock → On Loan → [Sales books] → Reserved → Sold
  - Demo can also go: On Loan → return → In Stock
- RMA out: deducted from stock temporarily (not counted while overseas)
**Alerts:** Min stock per item → alert Admin
**Stock counting:** monthly, quarterly, on-demand → record variance + note

### Finance / Billing
- Invoice per job, Payment status, Track outstanding per job

### Equipment Registry
- All equipment per customer (not just repaired), Repair/Cal history per SN

### Service Contract / PM
- Service contracts (free/discounted jobs), PM schedules (on-site visits)

### Notifications
- Customer: status change, Technician/Stock: new job, Calibration due (1m + 3m)

### PDF Export
- Service Repair Report: job_no, date, customer, equipment, symptom, analysis, fix, parts, photos, technician, warranty, signatures

### KPI & SLA (Admin-configurable in Settings)
SLA Repair=14d, SLA Cal=30d, SLA Overseas=60d, Warning=80% of SLA
KPIs: TAT, TAT excl. waiting, Jobs over SLA, First Fix Rate, Backlog, Revenue/month, Top parts

### User Roles (AS)
| Action | Admin | Stock | ช่าง | Sales |
|--------|-------|-------|------|-------|
| Manage jobs | Full | Full | Own only | None |
| Manage stock | Full | Full | None | Monitor only |
| Approve parts | Yes | Yes | No | No |
| View SR | All | All | All | Own requests only |
| Config KPI/SLA | Yes | No | No | No |
| Issue invoice | Yes | No | No | No |
| Set quote price | Yes | No | No | No |
| Export PDF | Yes | Yes | Yes | No |

---

## Product Catalog
### Fluke Biomedical (FBC)
ESA609/612/615/620/712/715, IMP6K/7K/7010, DPM2Plus, QAES III, VT650/900A/VAPOR,
IDA1s, IDA6-1/2/3/4ch, ProSim2/3/4/8/8P + SPOT combos, SPOT Module, SPOTLight, PS320, PS410, MFH-1, Acculung II, INCU II, INDEX II
### RaySafe
X2, X2 Solo, 452 Full/Ambient, 451B/P, Pro-Digi, R/F/Volt/MAM/Light/CT/Survey Sensors, Thin X RAD/Intra, DXR+, i3 Dosimeter
### Others
Fluke General (87V, 114-179, 325, 52, 54, 700G, 717 series...), IMT Analytics SmartLung, Omega, Graphtec, Testo, Maxtec, IBP, Dovideq, + others

### Special Product Notes
- IDA6: Display (1 SN) + up to 4 modules (each own SN, interchangeable between displays)
- ProSim8 + SPOT Module: often ordered together, each has own SN
- PS320 + MFH-1: often ordered together

---

## SE MODULE — TBD (not yet designed)

---

## Files Created / Modified
- `lib/data/geography.ts` — Province→Region→HealthDistrict mapping + default dropdowns
- `lib/supabase/client.ts` — DEV MODE guard added
- `app/(dashboard)/as/customers/page.tsx` — Rebuilt with full org+contact structure
