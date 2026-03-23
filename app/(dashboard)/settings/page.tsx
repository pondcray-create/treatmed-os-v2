"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Save, Settings2, Trash2 } from "lucide-react"
import {
  AS_STORE_KEYS,
  DEFAULT_AS_DROPDOWN_CONFIG,
  DEFAULT_AS_WORKFLOW_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PRODUCT_CATALOG,
  DEFAULT_SE_SETTINGS,
  readDropdownConfig,
  readASWorkflowSettings,
  readGlobalSettings,
  readProductCatalog,
  readSESettings,
  writeDropdownConfig,
  writeASWorkflowSettings,
  writeGlobalSettings,
  writeProductCatalog,
  writeSESettings,
  type ASDropdownConfig,
  type ASWorkflowSettings,
  type GlobalSettings,
  type ProductCatalogGroup,
  type SESettings,
} from "@/lib/mock/as-store"
import { useSearchParams } from "next/navigation"

type SettingsTab = "global" | "as" | "se"

function normalizeUnique(values: string[]) {
  const cleaned = values.map((v) => v.trim()).filter(Boolean)
  // Preserve workflow/entry order while deduplicating.
  return Array.from(new Set(cleaned))
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") as SettingsTab) || "global"
  const [tab, setTab] = useState<SettingsTab>(initialTab)

  const [config, setConfig] = useState<ASDropdownConfig>(readDropdownConfig())
  const [asWorkflow, setASWorkflow] = useState<ASWorkflowSettings>(readASWorkflowSettings())
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(readGlobalSettings())
  const [seSettings, setSESettings] = useState<SESettings>(readSESettings())
  const [productCatalog, setProductCatalog] = useState<ProductCatalogGroup[]>(readProductCatalog())
  const [selectedCatalogCode, setSelectedCatalogCode] = useState<string>("")
  const [draft, setDraft] = useState({
    stock_models: "",
    stock_manufacturers: "",
    calibration_labs: "",
    service_statuses: "",
    se_customers: "",
    se_owners: "",
    product_code: "",
    product_label: "",
    product_manufacturer: "",
    product_model: "",
  })
  const [savedKey, setSavedKey] = useState<"as" | "se" | "global" | null>(null)

  useEffect(() => {
    const qp = (searchParams.get("tab") as SettingsTab) || "global"
    setTab(qp)
  }, [searchParams])

  const asSections = useMemo(
    () => [
      { key: "stock_models" as const, label: "Stock Models", hint: "Model dropdown for Stock In" },
      { key: "stock_manufacturers" as const, label: "Stock Manufacturers", hint: "Manufacturer dropdown for Stock In" },
      { key: "calibration_labs" as const, label: "Calibration Labs", hint: "Calibration routing lab options" },
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

  function addASStatus() {
    const value = draft.service_statuses.trim()
    if (!value) return
    setASWorkflow((prev) => ({
      ...prev,
      service_statuses: normalizeUnique([...prev.service_statuses, value]) as ASWorkflowSettings["service_statuses"],
    }))
    setDraft((prev) => ({ ...prev, service_statuses: "" }))
  }

  function addSEItem(key: keyof SESettings) {
    const value = draft[key].trim()
    if (!value) return
    setSESettings((prev) => ({
      ...prev,
      [key]: normalizeUnique([...prev[key], value]),
    }))
    setDraft((prev) => ({ ...prev, [key]: "" }))
  }

  function removeItem(key: keyof ASDropdownConfig, value: string) {
    setConfig((prev) => ({
      ...prev,
      [key]: prev[key].filter((x) => x !== value),
    }))
  }

  function removeASStatus(value: string) {
    setASWorkflow((prev) => ({
      ...prev,
      service_statuses: prev.service_statuses.filter((x) => x !== value),
    }))
  }

  function removeSEItem(key: keyof SESettings, value: string) {
    setSESettings((prev) => ({
      ...prev,
      [key]: prev[key].filter((x) => x !== value),
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
    setProductCatalog(DEFAULT_PRODUCT_CATALOG)
  }

  function saveAS() {
    writeDropdownConfig({
      stock_models: normalizeUnique(config.stock_models),
      stock_manufacturers: normalizeUnique(config.stock_manufacturers),
      calibration_labs: normalizeUnique(config.calibration_labs),
    })
    writeASWorkflowSettings({
      service_statuses: normalizeUnique(asWorkflow.service_statuses) as ASWorkflowSettings["service_statuses"],
    })
    setSavedKey("as")
    window.setTimeout(() => setSavedKey(null), 2000)
  }

  function saveSE() {
    writeSESettings({
      se_customers: normalizeUnique(seSettings.se_customers),
      se_owners: normalizeUnique(seSettings.se_owners),
    })
    setSavedKey("se")
    window.setTimeout(() => setSavedKey(null), 2000)
  }

  function saveGlobal() {
    writeGlobalSettings({
      app_name: globalSettings.app_name.trim() || DEFAULT_GLOBAL_SETTINGS.app_name,
      default_currency: globalSettings.default_currency.trim() || DEFAULT_GLOBAL_SETTINGS.default_currency,
    })
    writeProductCatalog(productCatalog)
    setSavedKey("global")
    window.setTimeout(() => setSavedKey(null), 2000)
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
    const next: ProductCatalogGroup = { code, label, manufacturer, models: [] }
    setProductCatalog((prev) => [...prev, next].sort((a, b) => a.code.localeCompare(b.code)))
    setSelectedCatalogCode(code)
    setDraft((prev) => ({ ...prev, product_code: "", product_label: "", product_manufacturer: "" }))
  }

  function removeProductGroup(code: string) {
    setProductCatalog((prev) => prev.filter((g) => g.code !== code))
    if (selectedCatalogCode === code) setSelectedCatalogCode("")
  }

  function addProductModelToGroup() {
    const model = draft.product_model.trim()
    if (!model || !selectedCatalogCode) return
    setProductCatalog((prev) =>
      prev.map((g) =>
        g.code === selectedCatalogCode
          ? { ...g, models: normalizeUnique([...g.models, model]) }
          : g,
      ),
    )
    setDraft((prev) => ({ ...prev, product_model: "" }))
  }

  function removeProductModelFromGroup(code: string, model: string) {
    setProductCatalog((prev) =>
      prev.map((g) =>
        g.code === code
          ? { ...g, models: g.models.filter((m) => m !== model) }
          : g,
      ),
    )
  }

  const selectedCatalog = productCatalog.find((g) => g.code === selectedCatalogCode)
  const seSections = useMemo(
    () => [
      { key: "se_customers" as const, label: "SE Customers", hint: "Customer options used by SE pages" },
      { key: "se_owners" as const, label: "SE Owners", hint: "Sales owner options used by SE pages" },
    ],
    [],
  )


  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "global", label: "Global" },
    { id: "as", label: "AS Module" },
    { id: "se", label: "SE Module" },
  ]

  return (
    <div className="h-full p-1">
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
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              Reset Global Defaults
            </button>
            <button
              type="button"
              onClick={saveGlobal}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 flex items-center gap-2"
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
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              Reset SE Defaults
            </button>
            <button
              type="button"
              onClick={saveSE}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 flex items-center gap-2"
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
        </>
      )}

      {tab === "as" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={resetASDefaults}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              Reset AS Defaults
            </button>
            <button
              type="button"
              onClick={saveAS}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 flex items-center gap-2"
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
            <p className="font-bold text-gray-900">Service Statuses</p>
            <p className="text-xs text-gray-500 mt-1">Statuses used in AS Service Request workflow and badges.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={draft.service_statuses}
                onChange={(e) => setDraft((prev) => ({ ...prev, service_statuses: e.target.value }))}
                className={inputClass}
                placeholder="Add new status"
              />
              <button type="button" aria-label="เพิ่มสถานะงานบริการ" onClick={addASStatus} className="px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {asWorkflow.service_statuses.map((s) => (
                <div key={s} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2">
                  <span className="text-sm text-gray-700">{s}</span>
                  <button type="button" aria-label={`ลบสถานะ ${s}`} onClick={() => removeASStatus(s)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
