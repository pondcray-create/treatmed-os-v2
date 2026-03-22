# TreatMed OS — Flow chart เมนูแอป × Workflow (ชื่อ Function / Page)

**ไฟล์ PNG (เรนเดอร์แล้ว):** โฟลเดอร์ [`docs/diagrams/`](./diagrams/) — ดูรายการใน [`docs/diagrams/README.md`](./diagrams/README.md)

อ้างอิงเมนูจาก `components/layout/Sidebar.tsx` และ route ใน `app/(dashboard)/`.

> **หมายเหตุ:** บางหน้า SE / Monitor ยังเป็น mock UI ในไฟล์ — ชื่อฟังก์ชันที่ระบุคือของโค้ดปัจจุบันใน repo

---

## 1) ภาพรวม Shell + เมนู (Role)

```mermaid
flowchart TB
  subgraph Entry["เข้าแอป"]
    A["app/page.tsx → redirect /dashboard"]
    M["middleware.ts"]
    L["(auth)/login/page.tsx"]
  end

  subgraph DashShell["Dashboard Shell"]
    DL["(dashboard)/layout.tsx"]
    SB["Sidebar()"]
    UA["useAuth()"]
    SO["signOut()"]
  end

  M --> A
  M --> L
  A --> DL
  L --> DL
  DL --> SB
  DL --> UA
  SB --> SO

  subgraph NavTop["ลิงก์บนสุด Sidebar"]
    D["/dashboard → DashboardPage"]
    ST["/settings → SettingsPage"]
  end

  SB --> NavTop

  subgraph AS["TreatMed AS — NAV_GROUPS[0] roles: admin, as_staff"]
    C["/as/customers → CustomersPage"]
    SK["/as/stock → StockPage"]
    SM["/as/stock-monitor → StockMonitorPage"]
    SR["/as/service-request → ServiceRequestPage"]
    SV["/as/service-monitor → ServiceMonitorPage"]
    CP["/as/calibration-proactive → CalibrationProactivePage"]
  end

  subgraph SE["TreatMed SE — NAV_GROUPS[1] roles: admin, se_staff"]
    PL["/se/pipeline → PipelinePage"]
    DL2["/se/deals → DealsPage"]
    SRS["/se/service-request → SEServiceRequestPage"]
    FU["/se/followup → FollowupPage"]
    FC["/se/forecast → ForecastPage"]
  end

  SB -->|"visibleGroups.filter(roles)"| AS
  SB -->|"visibleGroups.filter(roles)"| SE

  R["/as/settings → ASSettingsPage"]
  R -->|router.replace| ST2["/settings?tab=as"]
```

---

## 2) ชั้น Mock Store (ข้อมูลที่หลายหน้า AS ใช้ร่วม)

```mermaid
flowchart LR
  subgraph as_store["lib/mock/as-store.ts — ตัวอย่าง export"]
    R1["readStockItems / writeStockItemsWithVersion"]
    R2["readJobs / writeJobsWithConcurrencyCheck"]
    R3["readOrganizations / writeOrganizations / upsertOrganizationByName"]
    R4["appendStockDispatch / readStockDispatches"]
    R5["readProactiveCalibrationAssets / writeProactiveCalibrationAssets"]
    R6["readDropdownConfig / writeDropdownConfig"]
    R7["readASWorkflowSettings / writeASWorkflowSettings"]
    R8["readStockTransactionsLedger / writeStockTransactionsLedger"]
    R9["readStockBookingsLedger / writeStockBookingsLedger"]
  end
```

---

## 3) Dashboard

```mermaid
flowchart TB
  P["DashboardPage (dashboard/page.tsx)"]
  P --> E1["useEffect: sync"]
  E1 --> R["readStockItems([])"]
  P --> M1["useMemo: stockAging"]
  P --> UI["Cards + Charts (mock SR / Deals)"]
```

---

## 4) Settings (Global / AS / SE)

```mermaid
flowchart TB
  P["SettingsPage (settings/page.tsx)"]
  P --> T["tab: global | as | se (useSearchParams)"]
  P --> RD["readDropdownConfig / readASWorkflowSettings / readGlobalSettings / readSESettings / readProductCatalog"]
  P --> WR["writeDropdownConfig / writeASWorkflowSettings / writeGlobalSettings / writeSESettings / writeProductCatalog"]
  P --> N1["normalizeUnique()"]
  P --> A1["addItem() — draft → config"]
```

---

## 5) AS — Customer Register

```mermaid
flowchart TB
  P["CustomersPage (as/customers/page.tsx)"]
  P --> OC["OrgCard"]
  P --> OD["OrgDialog — onSave"]
  P --> CR["ContactRow — onSetPrimary / onEdit / onDelete"]
  P --> CD["ContactDialog — onSave"]
  P --> RW["read/write organizations (state + mock)"]
```

---

## 6) AS — Stock In/Out (ไฟล์ใหญ่ — workflow หลัก)

```mermaid
flowchart TB
  P["StockPage (as/stock/page.tsx)"]

  subgraph Guards["เงื่อนไข / ตรวจสอบ"]
    G1["isLoanDemoCategory()"]
    G2["canOpenStockLoanForm()"]
    G3["serialsUniqueInsensitive()"]
  end

  subgraph Inbound["รับเข้า / Input Product"]
    RPD["ReceiveProductDialog"]
    RPD --> GMS["getReceiveModuleSpec()"]
    RPD --> CIS["collectStockInboundSerials()"]
    RPD --> TAT["tryApplyStockTx()"]
    TAT --> UPC["upsertProactiveCalibrationFromInputProduct()"]
  end

  subgraph Ledger["บันทึก & CAS"]
    TAT --> WSV["writeStockItemsWithVersion"]
    TAT --> WTL["writeStockTransactionsLedger"]
    TAT --> WBL["writeStockBookingsLedger"]
    JOB["writeJobsWithConcurrencyCheck — เมื่อส่งงาน"]
  end

  subgraph BookingSell["Booking / Item / ขาย"]
    ABD["AddBookingDialog"]
    AID["AddItemDialog"]
    SSD["SellStockDialog"]
  end

  subgraph LoanDemo["Loan / Demo / อนุมัติ"]
    LRAD["LoanRequestApprovalDialog — canApproveStockLoan / readMockSession"]
    LD["LoanDialog"]
    RDD["ReturnDemoDialog"]
  end

  subgraph ServiceOut["ส่งงานบริการ"]
    DD["DispatchDialog"]
    DD --> GLC["getStockItemLinkedCustomer()"]
    GLC --> FOB["findOrgByNameLoose()"]
    DD --> USD["upsertOrganizationByName (as-store)"]
    DD --> ASD["appendStockDispatch"]
    DD --> JOB
  end

  subgraph HistoryUI["ประวัติ / ติดตาม"]
    MHD["ModuleHistoryDialog"]
    CLHM["CustomerLoanHistoryModal"]
  end

  subgraph DateHelpers["Date helpers"]
    H1["parseISODateToUTC / diffDays / addYearsToISODate"]
  end

  P --> Guards
  P --> Inbound
  P --> BookingSell
  P --> LoanDemo
  P --> ServiceOut
  P --> HistoryUI
  P --> DateHelpers
```

---

## 7) AS — Service Request

```mermaid
flowchart TB
  P["ServiceRequestPage (as/service-request/page.tsx)"]
  P --> ICT["isCommissioningTestJob()"]
  P --> JC["JobCard"]
  P --> NJD["NewJobDialog"]
  P --> QDD["QuotationDraftDialog"]
  P --> CJD["CancelJobDialog"]
  P --> OSE["OrgSelect"]
  P --> T1["FromStockTab"]
  P --> T2["CommissioningWorkTab"]
  P --> T3["FromSETab"]
  P --> T4["FromRepairCalTab"]
  P --> AY["addOneYear()"]
  P --> RJ["readJobs / writeJobs (mock)"]
```

---

## 8) AS — Calibration Proactive

```mermaid
flowchart TB
  P["CalibrationProactivePage (as/calibration-proactive/page.tsx)"]
  P --> R["readProactiveCalibrationAssets"]
  P --> W["writeProactiveCalibrationAssets"]
```

---

## 9) AS — Stock Monitor / Service Monitor (Mock ในไฟล์)

```mermaid
flowchart TB
  SM1["StockMonitorPage — MOCK_ITEMS + filter critical/low/ok"]
  SM2["ServiceMonitorPage — MOCK_DATA + filter search/tech"]
```

---

## 10) SE — Pipeline / Deals / Follow Up / Forecast

```mermaid
flowchart TB
  PL["PipelinePage"]
  DP["DealsPage"]
  FU["FollowupPage"]
  FP["ForecastPage"]
  PL --> M1["state + mock / UI เท่านั้น"]
  DP --> M2["state + mock / UI เท่านั้น"]
  FU --> M3["state + mock / UI เท่านั้น"]
  FP --> M4["state + mock / UI เท่านั้น"]
```

---

## 11) SE — Service Request

```mermaid
flowchart TB
  P["SEServiceRequestPage (se/service-request/page.tsx)"]
  P --> UI["ฟอร์ม/รายการคำขอ — mock / local state ตามไฟล์"]
```

---

## สรุปไฟล์หลักต่อเมนู

| เมนู (Sidebar) | Route | Default export / Shell |
|----------------|-------|-------------------------|
| Dashboard | `/dashboard` | `DashboardPage` |
| Settings | `/settings`, `/as/settings` | `SettingsPage`, `ASSettingsPage` (redirect) |
| Customer Register | `/as/customers` | `CustomersPage` |
| Stock In/Out | `/as/stock` | `StockPage` |
| Stock Monitor | `/as/stock-monitor` | `StockMonitorPage` |
| Service Request (AS) | `/as/service-request` | `ServiceRequestPage` |
| Service Monitor | `/as/service-monitor` | `ServiceMonitorPage` |
| Calibration Proactive | `/as/calibration-proactive` | `CalibrationProactivePage` |
| Sales Pipeline | `/se/pipeline` | `PipelinePage` |
| Deal & Activity | `/se/deals` | `DealsPage` |
| Service Request (SE) | `/se/service-request` | `SEServiceRequestPage` |
| Follow Up | `/se/followup` | `FollowupPage` |
| Forecast / Month | `/se/forecast` | `ForecastPage` |
| ออกจากระบบ | — | `signOut()` ใน `Sidebar` |

---

## วิธีดู diagram

- เปิดไฟล์นี้ใน **GitHub**, **VS Code** (Mermaid preview), หรือวาง block `` ```mermaid `` ในเครื่องมือที่รองรับ Mermaid
