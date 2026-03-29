"use client"

import { Suspense, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { AlertTriangle, Download, Plus, Save, Settings2, Trash2 } from "lucide-react"
import {
  AS_STORE_KEYS,
  DEFAULT_AS_DROPDOWN_CONFIG,
  DEFAULT_KPI_SETTINGS,
  DEFAULT_AS_WORKFLOW_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PRODUCT_CATALOG,
  DEFAULT_SE_SETTINGS,
  readDropdownConfig,
  readASWorkflowSettings,
  readKPISettings,
  readGlobalSettings,
  readProductCatalog,
  readOrganizations,
  readSEDeals,
  readSESettings,
  writeDropdownConfig,
  writeASWorkflowSettings,
  writeKPISettings,
  writeGlobalSettings,
  writeProductCatalog,
  writeOrganizations,
  writeSEDeals,
  writeSESettings,
  coerceSESettingsForWrite,
  type ASDropdownConfig,
  type ASWorkflowSettings,
  type KPISettingEntry,
  type KPISettings,
  type GlobalSettings,
  type ProductCatalogGroup,
  type SEPipelineStageRule,
  type SESettings,
} from "@/lib/mock/as-store"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { formatHealthDistrictLabel } from "@/lib/data/th-public-hospitals"
import {
  applySeDealsImport,
  buildSeDealsImportTemplateCsv,
  parseDealImportFile,
  SE_DEALS_IMPORT_CANONICAL_HEADERS,
} from "@/lib/se/se-deals-import"
import { mergeManyDealsIntoRegister } from "@/lib/se/se-org-sync"

type SettingsTab = "global" | "as" | "se"

type SEListKey = "se_owners" | "se_lost_reasons" | "se_customer_segments"

function normalizeUnique(values: string[]) {
  const cleaned = values.map((v) => v.trim()).filter(Boolean)
  // Preserve workflow/entry order while deduplicating.
  return Array.from(new Set(cleaned))
}

function validateServiceStatuses(statuses: string[], mode: "service" | "calibration" = "service") {
  const errors: string[] = []
  const warnings: string[] = []
  const required =
    mode === "calibration"
      ? ["รอประเมิน", "ในคิว", "ปิดงาน", "ยกเลิก"]
      : ["รอประเมิน", "ในคิว", "กำลังซ่อม", "รออะไหล่", "ปิดงาน", "ยกเลิก"]
  const canonical = [
    "รอประเมิน",
    "กำลังประเมิน",
    "รอ Quotation Approve",
    "รอ PO",
    "ในคิว",
    "กำลังซ่อม",
    "รออะไหล่",
    "QC",
    "รอส่งคืน",
    "ปิดงาน",
    "ยกเลิก",
  ]
  required.forEach((s) => {
    if (!statuses.includes(s)) errors.push(`ขาดสถานะจำเป็น: ${s}`)
  })
  const mustBeAfter: Array<[string, string]> =
    mode === "calibration"
      ? [
          ["ในคิว", "รอประเมิน"],
          ["ปิดงาน", "ในคิว"],
          ["ยกเลิก", "ปิดงาน"],
        ]
      : [
          ["ในคิว", "รอประเมิน"],
          ["กำลังซ่อม", "ในคิว"],
          ["รออะไหล่", "กำลังซ่อม"],
          ["ปิดงาน", "กำลังซ่อม"],
          ["ยกเลิก", "ปิดงาน"],
        ]
  mustBeAfter.forEach(([after, before]) => {
    const ia = statuses.indexOf(after)
    const ib = statuses.indexOf(before)
    if (ia >= 0 && ib >= 0 && ia <= ib) {
      errors.push(`ลำดับไม่ถูกต้อง: ${after} ต้องอยู่หลัง ${before}`)
    }
  })
  statuses.forEach((s) => {
    if (!canonical.includes(s)) warnings.push(`สถานะ custom: ${s} (ตรวจให้แน่ใจว่า flow และรายงานรองรับ)`)
  })
  return { errors, warnings }
}

function SettingsPageContent() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") as SettingsTab) || "global"
  const [tab, setTab] = useState<SettingsTab>(initialTab)

  const [config, setConfig] = useState<ASDropdownConfig>(readDropdownConfig())
  const [asWorkflow, setASWorkflow] = useState<ASWorkflowSettings>(readASWorkflowSettings())
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(readGlobalSettings())
  const [kpiSettings, setKPISettings] = useState<KPISettings>(readKPISettings())
  const [seSettings, setSESettings] = useState<SESettings>(readSESettings())
  const [productCatalog, setProductCatalog] = useState<ProductCatalogGroup[]>(readProductCatalog())
  const [selectedCatalogCode, setSelectedCatalogCode] = useState<string>("")
  const [draft, setDraft] = useState({
    stock_models: "",
    stock_manufacturers: "",
    calibration_labs: "",
    service_technicians: "",
    service_statuses: "",
    calibration_statuses: "",
    se_owners: "",
    se_lost_reasons: "",
    se_customer_segments: "",
    product_code: "",
    product_label: "",
    product_manufacturer: "",
    product_model: "",
    kpi_module: "sales" as KPISettingEntry["module"],
    kpi_name: "",
    kpi_formula: "",
    kpi_target: "",
    kpi_reset_cycle: "monthly" as KPISettingEntry["reset_cycle"],
  })
  const [savedKey, setSavedKey] = useState<"as" | "se" | "global" | null>(null)
  const [seImportMode, setSeImportMode] = useState<"merge" | "replace">("merge")
  const [seImportBusy, setSeImportBusy] = useState(false)
  const [seImportMsg, setSeImportMsg] = useState<string | null>(null)
  const serviceStatusChecks = useMemo(
    () => validateServiceStatuses(asWorkflow.service_statuses, "service"),
    [asWorkflow.service_statuses],
  )
  const calibrationStatusChecks = useMemo(
    () => validateServiceStatuses(asWorkflow.calibration_statuses, "calibration"),
    [asWorkflow.calibration_statuses],
  )

  useEffect(() => {
    const qp = (searchParams.get("tab") as SettingsTab) || "global"
    setTab(qp)
  }, [searchParams])

  useEffect(() => {
    const sync = () => setProductCatalog(readProductCatalog())
    const onStorage = (e: StorageEvent) => {
      if (e.key !== AS_STORE_KEYS.productCatalog) return
      sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key && key !== AS_STORE_KEYS.productCatalog) return
      sync()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const asSections = useMemo(
    () => [
      {
        key: "stock_models" as const,
        label: "Stock Models",
        hint: "รุ่นเสริมเมื่อยังไม่มีใน Global → Product Catalog สำหรับยี่ห้อนั้น (Input Product ใช้ Catalog เป็นหลัก)",
      },
      {
        key: "stock_manufacturers" as const,
        label: "Stock Manufacturers",
        hint: "ยี่ห้อเสริมรวมกับรายการ Manufacturer ใน Product Catalog บนหน้ารับเข้า",
      },
      { key: "calibration_labs" as const, label: "Calibration Labs", hint: "Calibration routing lab options" },
      { key: "service_technicians" as const, label: "Service Technicians", hint: "รายชื่อช่างสำหรับเลือกใน Service Request" },
    ],
    [],
  )

  function addItem(key: keyof ASDropdownConfig) {
    const value = draft[key].trim()
    if (!value) return
    setConfig((prev) => ({
      ...prev,
      [key]: normalizeUnique([...prev[key], value]),
    }))
    setDraft((prev) => ({ ...prev, [key]: "" }))
  }

  function addASStatus(kind: "service_statuses" | "calibration_statuses") {
    const value = draft[kind].trim()
    if (!value) return
    setASWorkflow((prev) => ({
      ...prev,
      [kind]: normalizeUnique([...prev[kind], value]) as ASWorkflowSettings[typeof kind],
    }))
    setDraft((prev) => ({ ...prev, [kind]: "" }))
  }

  function addSEItem(key: SEListKey) {
    const value = draft[key].trim()
    if (!value) return
    setSESettings((prev) => ({
      ...prev,
      [key]: normalizeUnique([...(prev[key] as string[]), value]),
    }))
    setDraft((prev) => ({ ...prev, [key]: "" }))
  }

  function removeItem(key: keyof ASDropdownConfig, value: string) {
    setConfig((prev) => ({
      ...prev,
      [key]: prev[key].filter((x) => x !== value),
    }))
  }

  function removeASStatus(kind: "service_statuses" | "calibration_statuses", value: string) {
    setASWorkflow((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((x) => x !== value) as ASWorkflowSettings[typeof kind],
    }))
  }

  function removeSEItem(key: SEListKey, value: string) {
    setSESettings((prev) => ({
      ...prev,
      [key]: (prev[key] as string[]).filter((x) => x !== value),
    }))
  }

  function resetASDefaults() {
    setConfig(DEFAULT_AS_DROPDOWN_CONFIG)
    setASWorkflow(DEFAULT_AS_WORKFLOW_SETTINGS)
  }

  function resetSEDefaults() {
    setSESettings(DEFAULT_SE_SETTINGS)
  }

  function resetGlobalDefaults() {
    setGlobalSettings(DEFAULT_GLOBAL_SETTINGS)
    setKPISettings(DEFAULT_KPI_SETTINGS)
    setProductCatalog(DEFAULT_PRODUCT_CATALOG)
    writeProductCatalog(DEFAULT_PRODUCT_CATALOG)
  }

  function saveAS() {
    const allErrors = [...serviceStatusChecks.errors, ...calibrationStatusChecks.errors]
    if (allErrors.length > 0) {
      window.alert(`ยังบันทึกไม่ได้:\n- ${allErrors.join("\n- ")}`)
      return
    }
    writeDropdownConfig({
      stock_models: normalizeUnique(config.stock_models),
      stock_manufacturers: normalizeUnique(config.stock_manufacturers),
      calibration_labs: normalizeUnique(config.calibration_labs),
      service_technicians: normalizeUnique(config.service_technicians),
    })
    writeASWorkflowSettings({
      service_statuses: normalizeUnique(asWorkflow.service_statuses) as ASWorkflowSettings["service_statuses"],
      calibration_statuses: normalizeUnique(asWorkflow.calibration_statuses) as ASWorkflowSettings["calibration_statuses"],
    })
    setSavedKey("as")
    window.setTimeout(() => setSavedKey(null), 2000)
  }

  function normalizePipelineStagesForSave(rows: SEPipelineStageRule[]): SEPipelineStageRule[] {
    const seen = new Set<string>()
    const out: SEPipelineStageRule[] = []
    for (const r of rows) {
      const name = r.name.trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push({
        name,
        min_closing_probability: Math.min(100, Math.max(0, Number(r.min_closing_probability) || 0)),
      })
    }
    return out.length > 0 ? out : DEFAULT_SE_SETTINGS.se_pipeline_stages
  }

  function saveSE() {
    writeSESettings(
      coerceSESettingsForWrite({
        ...seSettings,
        se_owners: normalizeUnique(seSettings.se_owners),
        se_lost_reasons: normalizeUnique(seSettings.se_lost_reasons),
        se_customer_segments: normalizeUnique(seSettings.se_customer_segments),
        se_pipeline_stages: normalizePipelineStagesForSave(seSettings.se_pipeline_stages),
      }),
    )
    setSESettings(readSESettings())
    setSavedKey("se")
    window.setTimeout(() => setSavedKey(null), 2000)
  }

  function saveGlobal() {
    writeGlobalSettings({
      app_name: globalSettings.app_name.trim() || DEFAULT_GLOBAL_SETTINGS.app_name,
      default_currency: globalSettings.default_currency.trim() || DEFAULT_GLOBAL_SETTINGS.default_currency,
    })
    writeProductCatalog(productCatalog)
    writeKPISettings(kpiSettings)
    setSavedKey("global")
    window.setTimeout(() => setSavedKey(null), 2000)
  }

  function addKPIEntry() {
    const kpi_name = draft.kpi_name.trim()
    const formula = draft.kpi_formula.trim()
    const target = draft.kpi_target.trim()
    if (!kpi_name || !formula || !target) return
    const id = `kpi-${Date.now()}`
    const entry: KPISettingEntry = {
      id,
      module: draft.kpi_module,
      kpi_name,
      formula,
      target,
      reset_cycle: draft.kpi_reset_cycle,
    }
    setKPISettings((prev) => ({ ...prev, items: [...prev.items, entry] }))
    setDraft((prev) => ({
      ...prev,
      kpi_name: "",
      kpi_formula: "",
      kpi_target: "",
    }))
  }

  function removeKPIEntry(id: string) {
    setKPISettings((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }))
  }

  function clearAllAppData() {
    if (typeof window === "undefined") return
    const ok = window.confirm("ล้างข้อมูลทั้งหมดในแอพ (local data) และเริ่มใหม่จากค่าเริ่มต้น?\nการกระทำนี้ย้อนกลับไม่ได้")
    if (!ok) return
    const keys = [
      ...Object.values(AS_STORE_KEYS),
      "as_offline_queue",
    ]
    keys.forEach((k) => window.localStorage.removeItem(k))
    window.location.href = "/dashboard"
  }

  function addProductGroup() {
    const code = draft.product_code.trim().toUpperCase()
    const label = draft.product_label.trim()
    const manufacturer = draft.product_manufacturer.trim()
    if (!code || !label || !manufacturer) return
    if (productCatalog.some((g) => g.code === code)) return
    const nextGroup: ProductCatalogGroup = { code, label, manufacturer, models: [] }
    setProductCatalog((prev) => {
      const next = [...prev, nextGroup].sort((a, b) => a.code.localeCompare(b.code))
      writeProductCatalog(next)
      return next
    })
    setSelectedCatalogCode(code)
    setDraft((prev) => ({ ...prev, product_code: "", product_label: "", product_manufacturer: "" }))
  }

  function removeProductGroup(code: string) {
    setProductCatalog((prev) => {
      const next = prev.filter((g) => g.code !== code)
      writeProductCatalog(next)
      return next
    })
    if (selectedCatalogCode === code) setSelectedCatalogCode("")
  }

  function addProductModelToGroup() {
    const model = draft.product_model.trim()
    if (!model || !selectedCatalogCode) return
    setProductCatalog((prev) => {
      const next = prev.map((g) =>
        g.code === selectedCatalogCode
          ? { ...g, models: normalizeUnique([...g.models, model]) }
          : g,
      )
      writeProductCatalog(next)
      return next
    })
    setDraft((prev) => ({ ...prev, product_model: "" }))
  }

  function removeProductModelFromGroup(code: string, model: string) {
    setProductCatalog((prev) => {
      const next = prev.map((g) =>
        g.code === code
          ? { ...g, models: g.models.filter((m) => m !== model) }
          : g,
      )
      writeProductCatalog(next)
      return next
    })
  }

  const selectedCatalog = productCatalog.find((g) => g.code === selectedCatalogCode)
  const seSections = useMemo(
    () =>
      [
        {
          key: "se_owners" as const,
          label: "SE Owners",
          hint: "รายชื่อ Sales — Pipeline / เขตสุขภาพ · ลูกค้าใน SE ใช้รายการจาก Customer Register (AS)",
        },
        {
          key: "se_lost_reasons" as const,
          label: "สาเหตุที่แพ้ (Lost)",
          hint: "ตัวเลือกเมื่อปิดดีลเป็น Lost — ใช้สรุปบน SE Dashboard",
        },
        {
          key: "se_customer_segments" as const,
          label: "Segment ลูกค้า (ตลาด)",
          hint: "เช่น โรงพยาบาลรัฐขนาดใหญ่, OEM, เอกชน — ใช้เลือกบนดีล (Pipeline / Deals)",
        },
      ] satisfies { key: SEListKey; label: string; hint: string }[],
    [],
  )

  function addPipelineStage() {
    setSESettings((prev) => ({
      ...prev,
      se_pipeline_stages: [
        ...prev.se_pipeline_stages,
        {
          name: `stage-${prev.se_pipeline_stages.length + 1}`,
          min_closing_probability: 70,
        },
      ],
    }))
  }

  function updatePipelineStage(index: number, patch: Partial<SEPipelineStageRule>) {
    setSESettings((prev) => ({
      ...prev,
      se_pipeline_stages: prev.se_pipeline_stages.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  function removePipelineStage(index: number) {
    setSESettings((prev) => ({
      ...prev,
      se_pipeline_stages: prev.se_pipeline_stages.filter((_, i) => i !== index),
    }))
  }

  function updatePPAxisLabel(index: number, label: string) {
    setSESettings((prev) => ({
      ...prev,
      se_potential_performance_axes: prev.se_potential_performance_axes.map((row, i) =>
        i === index ? { ...row, label } : row,
      ),
    }))
  }

  function downloadSeDealsTemplate() {
    const blob = new Blob([`\uFEFF${buildSeDealsImportTemplateCsv()}`], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "se-deals-import-template.csv"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onSeDealsImportFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (!file || profile?.role !== "admin") return
    setSeImportBusy(true)
    setSeImportMsg(null)
    try {
      const rows = await parseDealImportFile(file)
      const existing = readSEDeals([])
      if (seImportMode === "replace") {
        const ok = window.confirm(
          "แทนที่ดีลทั้งหมดด้วยข้อมูลจากไฟล์? ดีลที่ไม่อยู่ในไฟล์จะถูกลบออกจากแอพ (เฉพาะ mock/local)",
        )
        if (!ok) {
          setSeImportBusy(false)
          return
        }
      }
      const { deals, report } = applySeDealsImport(rows, existing, seImportMode)
      writeSEDeals(deals)
      const orgs = readOrganizations([])
      writeOrganizations(mergeManyDealsIntoRegister(orgs, deals))
      const errTail =
        report.errors.length > 0 ? ` · ดูรายละเอียด error ใน console (${report.errors.length} แถว)` : ""
      const errPreview =
        report.errors.length > 0 ? `\nตัวอย่าง: ${report.errors.slice(0, 3).join(" | ")}` : ""
      setSeImportMsg(
        `นำเข้าแล้ว: เพิ่ม ${report.added} · อัปเดต ${report.updated} · ข้าม ${report.skipped}${errTail}${errPreview}`,
      )
      if (report.errors.length) console.warn("[SE deals import]", report.errors)
    } catch (e) {
      setSeImportMsg(`นำเข้าไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    }
    setSeImportBusy(false)
  }

  function updateDistrictRow(index: number, patch: Partial<(typeof seSettings.health_district_targets)[0]>) {
    setSESettings((prev) => ({
      ...prev,
      health_district_targets: prev.health_district_targets.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }))
  }


  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "global", label: "Global" },
    { id: "as", label: "AS Module" },
    { id: "se", label: "SE Module" },
  ]

  return (
    <div className="h-full p-1">
      {profile?.role !== "admin" && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          หน้านี้สำหรับ Admin เท่านั้น (การตั้งค่า workflow/KPI/system)
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-blue-500" />
            System Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">Central settings for the whole system (AS + SE + Global)</p>
        </div>
        <button
          type="button"
          onClick={clearAllAppData}
          className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100"
        >
          ล้างข้อมูลแอพทั้งหมด
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-gray-100 mb-5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "global" && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={resetGlobalDefaults}
              disabled={profile?.role !== "admin"}
              className="px-3 py-2 rounded-xl border border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-sm font-semibold hover:bg-gray-50"
            >
              Reset Global Defaults
            </button>
            <button
              type="button"
              onClick={saveGlobal}
              disabled={profile?.role !== "admin"}
              className="px-4 py-2 rounded-xl bg-blue-500 disabled:bg-gray-300 text-white text-sm font-bold hover:bg-blue-600 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Global Settings
            </button>
          </div>
          {savedKey === "global" && (
            <div className="mb-4 p-3 rounded-xl border border-green-200 bg-green-50 text-sm font-semibold text-green-700">
              Saved global settings successfully.
            </div>
          )}
          <p className="font-bold text-gray-900">Global Settings</p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <label htmlFor="global-app-name" className="text-xs text-gray-500 mb-1 block">App Name</label>
              <input
                id="global-app-name"
                value={globalSettings.app_name}
                onChange={(e) => setGlobalSettings((prev) => ({ ...prev, app_name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="global-default-currency" className="text-xs text-gray-500 mb-1 block">Default Currency</label>
              <input
                id="global-default-currency"
                value={globalSettings.default_currency}
                onChange={(e) => setGlobalSettings((prev) => ({ ...prev, default_currency: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="font-bold text-gray-900 mb-1">KPI Definitions (Admin)</p>
            <p className="text-xs text-gray-500 mb-3">
              เพิ่ม/แก้ KPI จากแอพได้โดย Admin เท่านั้น และจะถูกใช้เป็นแหล่งอ้างอิงกลาง
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 mb-3">
              <select
                value={draft.kpi_module}
                onChange={(e) => setDraft((prev) => ({ ...prev, kpi_module: e.target.value as KPISettingEntry["module"] }))}
                className={inputClass}
                disabled={profile?.role !== "admin"}
              >
                <option value="sales">Sales</option>
                <option value="repair">Repair</option>
                <option value="calibration">Calibration</option>
                <option value="stock">Stock</option>
                <option value="other">Other</option>
              </select>
              <input
                value={draft.kpi_name}
                onChange={(e) => setDraft((prev) => ({ ...prev, kpi_name: e.target.value }))}
                className={inputClass}
                placeholder="KPI Name"
                disabled={profile?.role !== "admin"}
              />
              <input
                value={draft.kpi_formula}
                onChange={(e) => setDraft((prev) => ({ ...prev, kpi_formula: e.target.value }))}
                className={inputClass}
                placeholder="Formula"
                disabled={profile?.role !== "admin"}
              />
              <input
                value={draft.kpi_target}
                onChange={(e) => setDraft((prev) => ({ ...prev, kpi_target: e.target.value }))}
                className={inputClass}
                placeholder="Target"
                disabled={profile?.role !== "admin"}
              />
              <div className="flex gap-2">
                <select
                  value={draft.kpi_reset_cycle}
                  onChange={(e) => setDraft((prev) => ({ ...prev, kpi_reset_cycle: e.target.value as KPISettingEntry["reset_cycle"] }))}
                  className={inputClass}
                  disabled={profile?.role !== "admin"}
                >
                  <option value="monthly">monthly</option>
                  <option value="quarterly">quarterly</option>
                  <option value="per_deal">per_deal</option>
                  <option value="per_job">per_job</option>
                  <option value="per_transaction">per_transaction</option>
                  <option value="custom">custom</option>
                </select>
                <button
                  type="button"
                  onClick={addKPIEntry}
                  disabled={profile?.role !== "admin"}
                  className="px-3 rounded-xl bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 text-blue-600 hover:bg-blue-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-auto">
              {kpiSettings.items.map((k) => (
                <div key={k.id} className="rounded-xl border border-gray-100 px-3 py-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      [{k.module}] {k.kpi_name}
                    </p>
                    <button
                      type="button"
                      aria-label={`ลบ KPI ${k.kpi_name}`}
                      onClick={() => removeKPIEntry(k.id)}
                      disabled={profile?.role !== "admin"}
                      className="p-1.5 rounded-lg text-red-500 disabled:text-gray-300 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{k.formula}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Target: {k.target} · Reset: {k.reset_cycle}</p>
                </div>
              ))}
              {kpiSettings.items.length === 0 && <p className="text-xs text-gray-400">No KPI definitions.</p>}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="font-bold text-gray-900 mb-1">Product Catalog Groups</p>
            <p className="text-xs text-gray-500 mb-3">Example: FBC to Fluke Biomedical and models under this group.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
              <input
                value={draft.product_code}
                onChange={(e) => setDraft((prev) => ({ ...prev, product_code: e.target.value }))}
                className={inputClass}
                placeholder="Group Code (e.g. FBC)"
              />
              <input
                value={draft.product_label}
                onChange={(e) => setDraft((prev) => ({ ...prev, product_label: e.target.value }))}
                className={inputClass}
                placeholder="Group Label"
              />
              <div className="flex gap-2">
                <input
                  value={draft.product_manufacturer}
                  onChange={(e) => setDraft((prev) => ({ ...prev, product_manufacturer: e.target.value }))}
                  className={inputClass}
                  placeholder="Manufacturer"
                />
                <button type="button" aria-label="เพิ่มกลุ่มสินค้า" onClick={addProductGroup} className="px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-3 space-y-2 max-h-[360px] overflow-auto">
                {productCatalog.map((g) => (
                  <div key={g.code} className={`rounded-xl border px-3 py-2 ${selectedCatalogCode === g.code ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
                    <button type="button" onClick={() => setSelectedCatalogCode(g.code)} className="w-full text-left">
                      <p className="text-sm font-semibold text-gray-900">{g.code} - {g.label}</p>
                      <p className="text-xs text-gray-500">{g.manufacturer}</p>
                    </button>
                    <button type="button" onClick={() => removeProductGroup(g.code)} className="mt-2 text-xs text-red-500 hover:text-red-600">
                      Remove Group
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  {selectedCatalog ? `Models in ${selectedCatalog.code}` : "Select a group to manage models"}
                </p>
                {selectedCatalog && (
                  <>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={draft.product_model}
                        onChange={(e) => setDraft((prev) => ({ ...prev, product_model: e.target.value }))}
                        className={inputClass}
                        placeholder="Add model"
                      />
                      <button type="button" aria-label="เพิ่มรุ่นสินค้า" onClick={addProductModelToGroup} className="px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[260px] overflow-auto">
                      {selectedCatalog.models.map((m) => (
                        <div key={m} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2">
                          <span className="text-sm text-gray-700">{m}</span>
                          <button type="button" aria-label={`ลบรุ่น ${m}`} onClick={() => removeProductModelFromGroup(selectedCatalog.code, m)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "se" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={resetSEDefaults}
              disabled={profile?.role !== "admin"}
              className="px-3 py-2 rounded-xl border border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-sm font-semibold hover:bg-gray-50"
            >
              Reset SE Defaults
            </button>
            <button
              type="button"
              onClick={saveSE}
              disabled={profile?.role !== "admin"}
              className="px-4 py-2 rounded-xl bg-blue-500 disabled:bg-gray-300 text-white text-sm font-bold hover:bg-blue-600 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save SE Settings
            </button>
          </div>
          {savedKey === "se" && (
            <div className="mb-4 p-3 rounded-xl border border-green-200 bg-green-50 text-sm font-semibold text-green-700">
              Saved SE settings successfully.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {seSections.map((section) => (
              <div key={section.key} className="bg-white rounded-3xl border border-gray-100 p-5">
                <p className="font-bold text-gray-900">{section.label}</p>
                <p className="text-xs text-gray-500 mt-1">{section.hint}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={draft[section.key]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [section.key]: e.target.value }))}
                    className={inputClass}
                    placeholder="Add new value"
                  />
                  <button
                    type="button"
                    aria-label={`เพิ่ม ${section.label}`}
                    onClick={() => addSEItem(section.key)}
                    className="px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-2 max-h-[360px] overflow-auto">
                  {seSettings[section.key].length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No items.</p>
                  ) : (
                    seSettings[section.key].map((item) => (
                      <div key={item} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl px-3 py-2">
                        <span className="text-sm text-gray-700">{item}</span>
                        <button
                          type="button"
                          aria-label={`ลบ ${item}`}
                          onClick={() => removeSEItem(section.key, item)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-white rounded-3xl border border-indigo-100 p-5 overflow-x-auto">
            <p className="font-bold text-gray-900">Potential Performance (เรดาร์ SE Dashboard)</p>
            <p className="text-xs text-gray-500 mt-1 max-w-3xl">
              คะแนนแต่ละแกนคำนวณอัตโนมัติจากข้อมูลจริงในระบบ (ดีล/กิจกรรม) โดยใช้ key ของแกนเป็นตัว map สูตร
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600">ชื่อแกนที่แสดง (key ด้านล่างใช้เก็บใน JSON — อย่าเปลี่ยนถ้าต้องการ sync กับไฟล์ภายนอก)</p>
              <div className="flex flex-wrap gap-3">
                {seSettings.se_potential_performance_axes.map((ax, i) => (
                  <label key={ax.key} className="text-xs flex flex-col gap-1 min-w-[150px]">
                    <span className="text-[10px] text-gray-400 font-mono">{ax.key}</span>
                    <input
                      value={ax.label}
                      onChange={(e) => updatePPAxisLabel(i, e.target.value)}
                      disabled={profile?.role !== "admin"}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>
            {seSettings.se_owners.length === 0 ? (
              <p className="mt-4 text-sm text-amber-800 bg-amber-50 rounded-xl p-3 border border-amber-100">
                เพิ่ม SE Owners ในการ์ดด้านบนก่อน แล้ว Dashboard จะคำนวณคะแนนให้อัตโนมัติ
              </p>
            ) : (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-900">
                <p className="font-semibold">สูตร auto score ตาม key มาตรฐาน</p>
                <p className="mt-2">
                  responsibility = % ดีลเปิดที่มี next follow-up · target = % เป้ารายได้ที่ทำได้จริง (Won/Quota) ·
                  pipeline = weighted open pipeline เทียบ quota · closing = win rate จากดีลปิด ·
                  follow_up = ความสดของการติดตามจาก activity ล่าสุด · collaboration = สัดส่วน activity ข้ามทีม
                  (service/order/training/loan/booking)
                </p>
                <p className="mt-2 text-[11px] text-indigo-700">
                  หากเปลี่ยน key แกนเป็นชื่ออื่นที่ไม่ตรง keyword ระบบจะใช้ค่าเฉลี่ยจาก pipeline + closing + follow_up
                </p>
              </div>
            )}
            <p className="mt-3 text-[10px] text-gray-400">บันทึกเฉพาะชื่อแกนด้วยปุ่ม &quot;Save SE Settings&quot; ด้านบน</p>
          </div>

          <div className="mt-6 bg-white rounded-3xl border border-emerald-100 p-5">
            <p className="font-bold text-gray-900">นำเข้าดีล SE จาก Excel / CSV</p>
            <p className="text-xs text-gray-500 mt-1 max-w-3xl">
              แถวแรกเป็นหัวคอลัมน์ · รองรับชื่อไทย/อังกฤษหลายแบบ (ดูรายการฟิลด์ด้านล่าง) ·{" "}
              <strong>merge</strong> อัปเดตตาม <code className="text-[11px] bg-gray-100 px-1 rounded">deal_no</code>{" "}
              ก่อน แล้วจึง <code className="text-[11px] bg-gray-100 px-1 rounded">id</code>
            </p>
            <p className="text-xs text-gray-600 mt-2 font-mono break-all leading-relaxed">
              {SE_DEALS_IMPORT_CANONICAL_HEADERS.join(", ")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={downloadSeDealsTemplate}
                disabled={profile?.role !== "admin"}
                className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                ดาวน์โหลดตัวอย่าง CSV
              </button>
              <label className="text-sm text-gray-600 flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="se_import_mode"
                  checked={seImportMode === "merge"}
                  onChange={() => setSeImportMode("merge")}
                  disabled={profile?.role !== "admin"}
                />
                ผสาน (merge)
              </label>
              <label className="text-sm text-gray-600 flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="se_import_mode"
                  checked={seImportMode === "replace"}
                  onChange={() => setSeImportMode("replace")}
                  disabled={profile?.role !== "admin"}
                />
                แทนที่ทั้งหมด (replace)
              </label>
              <label className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 cursor-pointer disabled:opacity-50">
                {seImportBusy ? "กำลังอ่านไฟล์…" : "เลือกไฟล์ .xlsx / .xls / .csv"}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  disabled={profile?.role !== "admin" || seImportBusy}
                  onChange={onSeDealsImportFile}
                />
              </label>
            </div>
            {seImportMsg && (
              <p className="mt-3 text-sm rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800">{seImportMsg}</p>
            )}
          </div>

          <div className="mt-6 bg-white rounded-3xl border border-gray-100 p-5 overflow-x-auto">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-bold text-gray-900">SE Pipeline Stages</p>
                <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                  แต่ละขั้นกำหนดโอกาสปิดการขายขั้นต่ำ (%) — ค่านี้<strong>ผูกกับ Stage อัตโนมัติ</strong>: เวลาเลือก stage บน Pipeline / ฟอร์มเพิ่มดีล ระบบจะเติมโอกาสให้เท่าค่าที่ตั้งไว้ที่นี่ (แก้ที่ดีลทีหลังได้) · ใช้เป็นทั้งเกณฑ์ขอ Booking และนับ Quote funnel เมื่อโอกาสดีลถึงเกณฑ์ · Stage{" "}
                  <strong>Lost</strong> แนะนำตั้ง <strong>0%</strong> (ดีลปิดแล้ว) — ระบบไม่ให้ขอ Booking กับดีล Won/Lost อยู่แล้ว · สาเหตุแพ้ตั้งที่รายการ
                  &quot;สาเหตุที่แพ้&quot; ด้านบน · ถ้ามี stage ชื่อมีคำว่า <strong>forecast</strong> หรือ <strong>พยากรณ์</strong> เมื่อโอกาสดีล ≥ 80% การย้ายเข้า/ออกจาก
                  stage นี้บน Pipeline จะขอให้ยืนยัน ECD อีกครั้ง
                </p>
              </div>
              <button
                type="button"
                onClick={addPipelineStage}
                disabled={profile?.role !== "admin"}
                className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                เพิ่ม Stage
              </button>
            </div>
            <table className="w-full text-sm border-collapse min-w-[480px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">
                    โอกาสปิดขั้นต่ำ = แนะนำ (%)
                    <span className="block font-normal text-[10px] text-gray-400 mt-0.5">ผูกกับ stage แถวเดียวกัน</span>
                  </th>
                  <th className="py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {seSettings.se_pipeline_stages.map((row, index) => (
                  <tr key={index} className="border-b border-gray-50">
                    <td className="py-2 pr-3">
                      <input
                        value={row.name}
                        onChange={(e) => updatePipelineStage(index, { name: e.target.value })}
                        className={`${inputClass} py-2`}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.min_closing_probability}
                        onChange={(e) =>
                          updatePipelineStage(index, {
                            min_closing_probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                          })
                        }
                        className={`${inputClass} max-w-[120px] py-2`}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        aria-label={`ลบ stage ${row.name}`}
                        onClick={() => removePipelineStage(index)}
                        disabled={profile?.role !== "admin"}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-white rounded-3xl border border-violet-100 p-5">
            <p className="font-bold text-gray-900">Forecast integrity — ดีลในมือ</p>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              เมื่อ SE ติ๊ก &quot;ดีลในมือ&quot; บน Pipeline โอกาสจะถูกบังคับอย่างน้อยเท่าค่านี้ · ตัวเลข{" "}
              <strong>Weighted (ฐานนโยบาย)</strong> บน Dashboard / Forecast ใช้ max(โอกาสที่ใส่, เกณฑ์ stage, ค่านี้เมื่อติ๊กในมือ)
            </p>
            <label className="mt-3 block text-sm max-w-[200px]">
              <span className="text-gray-600">โอกาสขั้นต่ำดีลในมือ (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={seSettings.se_in_hand_min_probability}
                onChange={(e) =>
                  setSESettings((p) => ({
                    ...p,
                    se_in_hand_min_probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  }))
                }
                disabled={profile?.role !== "admin"}
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>

          <div className="mt-6 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 p-5">
              <p className="font-bold text-gray-900">เป้ารวมบริษัท & สัดส่วน Segment</p>
              <p className="text-xs text-gray-500 mt-1">
                T<sub>cap</sub> = ผลรวมเพดานเขต · T<sub>company</sub> = T<sub>cap</sub> × Achieve · แบ่ง T
                <sub>company</sub> ตาม % ด้านล่าง (ระบบ normalize ให้รวม 100 ถ้ากรอกเพี้ยน)
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="block text-sm">
                  <span className="text-gray-600">Achieve factor (% ของ T_cap)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(seSettings.company_achieve_factor * 100)}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      setSESettings((p) => ({
                        ...p,
                        company_achieve_factor: Number.isFinite(n)
                          ? Math.min(100, Math.max(0, n)) / 100
                          : p.company_achieve_factor,
                      }))
                    }}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">รพ.ภาครัฐ (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={seSettings.segment_mix_public_hospital_pct}
                    onChange={(e) =>
                      setSESettings((p) => ({
                        ...p,
                        segment_mix_public_hospital_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Segment อื่น (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={seSettings.segment_mix_other_pct}
                    onChange={(e) =>
                      setSESettings((p) => ({
                        ...p,
                        segment_mix_other_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Buffer / อื่นๆ (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={seSettings.segment_mix_buffer_pct}
                    onChange={(e) =>
                      setSESettings((p) => ({
                        ...p,
                        segment_mix_buffer_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-5 overflow-x-auto">
              <p className="font-bold text-gray-900">เขตสุขภาพ 1–13 — เพดานปี (บาท) & Sales หลัก</p>
              <p className="text-xs text-gray-500 mt-1">
                ปรับเพดานตามมุมมองตลาดได้ตลอด · เลือก Sales จากรายการ SE Owners
              </p>
              <table className="mt-4 w-full text-sm border-collapse min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3">เขต</th>
                    <th className="py-2 pr-3">เพดานปี (THB)</th>
                    <th className="py-2">Sales หลัก</th>
                  </tr>
                </thead>
                <tbody>
                  {seSettings.health_district_targets.map((row, index) => (
                    <tr key={row.district} className="border-b border-gray-50">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatHealthDistrictLabel(row.district)}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={row.annual_cap_thb || ""}
                          onChange={(e) =>
                            updateDistrictRow(index, {
                              annual_cap_thb: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            })
                          }
                          className={`${inputClass} max-w-[160px] py-2`}
                        />
                      </td>
                      <td className="py-2">
                        <select
                          value={row.primary_owner}
                          onChange={(e) => updateDistrictRow(index, { primary_owner: e.target.value })}
                          className={`${inputClass} max-w-[220px] py-2`}
                        >
                          <option value="">—</option>
                          {seSettings.se_owners.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 text-xs text-violet-900 leading-relaxed">
              <p className="font-bold text-violet-950 mb-1">สูตร Funnel (สรุป)</p>
              <p>
                โอกาสปิดต่อ Stage ใช้ทั้ง Booking และ Quote funnel · Win rate = Won / (Won + Lost) · ช่องว่างรายได้ต่อคน =
                max(0, Quota − Won สะสม) · Pipeline เป้าหมาย ≈ ช่องว่าง / Win rate
              </p>
            </div>
          </div>
        </>
      )}

      {tab === "as" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={resetASDefaults}
              disabled={profile?.role !== "admin"}
              className="px-3 py-2 rounded-xl border border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-sm font-semibold hover:bg-gray-50"
            >
              Reset AS Defaults
            </button>
            <button
              type="button"
              onClick={saveAS}
              disabled={profile?.role !== "admin"}
              className="px-4 py-2 rounded-xl bg-blue-500 disabled:bg-gray-300 text-white text-sm font-bold hover:bg-blue-600 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save AS Settings
            </button>
          </div>

          {savedKey === "as" && (
            <div className="mb-4 p-3 rounded-xl border border-green-200 bg-green-50 text-sm font-semibold text-green-700">
              Saved settings successfully.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {asSections.map((section) => (
              <div key={section.key} className="bg-white rounded-3xl border border-gray-100 p-5">
                <p className="font-bold text-gray-900">{section.label}</p>
                <p className="text-xs text-gray-500 mt-1">{section.hint}</p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={draft[section.key]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [section.key]: e.target.value }))}
                    className={inputClass}
                    placeholder="Add new value"
                  />
                  <button
                    type="button"
                    aria-label={`เพิ่ม ${section.label}`}
                    onClick={() => addItem(section.key)}
                    className="px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-2 max-h-[360px] overflow-auto">
                  {config[section.key].length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No items.</p>
                  ) : (
                    config[section.key].map((item) => (
                      <div key={item} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl px-3 py-2">
                        <span className="text-sm text-gray-700">{item}</span>
                        <button
                          type="button"
                          aria-label={`ลบ ${item}`}
                          onClick={() => removeItem(section.key, item)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-white rounded-3xl border border-gray-100 p-5">
            <p className="font-bold text-gray-900">Service Statuses (Repair)</p>
            <p className="text-xs text-gray-500 mt-1">Statuses used for Repair workflow only.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={draft.service_statuses}
                onChange={(e) => setDraft((prev) => ({ ...prev, service_statuses: e.target.value }))}
                className={inputClass}
                placeholder="Add new status"
              />
              <button type="button" aria-label="เพิ่มสถานะงานบริการ" onClick={() => addASStatus("service_statuses")} className="px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {asWorkflow.service_statuses.map((s) => (
                <div key={s} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2">
                  <span className="text-sm text-gray-700">{s}</span>
                  <button type="button" aria-label={`ลบสถานะ ${s}`} onClick={() => removeASStatus("service_statuses", s)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {(serviceStatusChecks.errors.length > 0 || serviceStatusChecks.warnings.length > 0) && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Workflow validation
                </p>
                {serviceStatusChecks.errors.map((e) => (
                  <p key={`e-${e}`} className="text-[11px] text-rose-700 mt-1">- {e}</p>
                ))}
                {serviceStatusChecks.warnings.map((w) => (
                  <p key={`w-${w}`} className="text-[11px] text-amber-700 mt-1">- {w}</p>
                ))}
              </div>
            )}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="font-bold text-gray-900">Calibration Statuses (Calibration + PM)</p>
              <p className="text-xs text-gray-500 mt-1">Statuses used for Calibration และ PM workflow.</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={draft.calibration_statuses}
                  onChange={(e) => setDraft((prev) => ({ ...prev, calibration_statuses: e.target.value }))}
                  className={inputClass}
                  placeholder="Add calibration status"
                />
                <button type="button" aria-label="เพิ่มสถานะ Calibration" onClick={() => addASStatus("calibration_statuses")} className="px-3 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {asWorkflow.calibration_statuses.map((s) => (
                  <div key={`cal-${s}`} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-sm text-gray-700">{s}</span>
                    <button type="button" aria-label={`ลบสถานะ Calibration ${s}`} onClick={() => removeASStatus("calibration_statuses", s)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {(calibrationStatusChecks.errors.length > 0 || calibrationStatusChecks.warnings.length > 0) && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Calibration workflow validation
                  </p>
                  {calibrationStatusChecks.errors.map((e) => (
                    <p key={`ce-${e}`} className="text-[11px] text-rose-700 mt-1">- {e}</p>
                  ))}
                  {calibrationStatusChecks.warnings.map((w) => (
                    <p key={`cw-${w}`} className="text-[11px] text-amber-700 mt-1">- {w}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-800">ถ้าจะเปลี่ยนกระบวนการ Services</p>
              <p className="text-[11px] text-blue-700 mt-1">1) จัดลำดับสถานะในส่วนนี้ให้ถูกต้องตาม flow จริง</p>
              <p className="text-[11px] text-blue-700">2) บันทึกและทดสอบเปลี่ยนสถานะในหน้า Service Request</p>
              <p className="text-[11px] text-blue-700">3) ถ้ามีเงื่อนไขใหม่ (required data/role) ให้เพิ่ม rule ใน FSM</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading settings...</div>}>
      <SettingsPageContent />
    </Suspense>
  )
}
