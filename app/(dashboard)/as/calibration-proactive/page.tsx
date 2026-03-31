"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, CalendarClock, Plus, Search, X } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  AS_STORE_KEYS,
  readJobs,
  readOrganizations,
  readDropdownConfig,
  readProductCatalog,
  readProactiveCalibrationAssets,
  syncCalibrationBySerial,
  upsertOrganizationByName,
  writeJobs,
  writeOrganizations,
  writeProactiveCalibrationAssets,
  type ASServiceJob,
  type ASProactiveCalibrationAsset,
  type ASDropdownConfig,
  type ProductCatalogGroup,
} from "@/lib/mock/as-store"
import { formatThDateFromYMD, thDateInputBeHint } from "@/lib/format-th-datetime"
import { getStockPatternManufacturers, getStockPatternModelsForManufacturer } from "@/lib/product-catalog-options"

function daysDiff(fromISO: string, toISO: string) {
  const from = new Date(`${fromISO}T00:00:00.000Z`).getTime()
  const to = new Date(`${toISO}T00:00:00.000Z`).getTime()
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

function getDueState(dueDate: string, todayISO: string): "ok" | "near" | "urgent" | "overdue" {
  const overdueDays = daysDiff(dueDate, todayISO)
  if (overdueDays > 0) return "overdue"
  const leftDays = daysDiff(todayISO, dueDate)
  if (leftDays <= 7) return "urgent"
  if (leftDays <= 30) return "near"
  return "ok"
}

const SEED_ASSETS: ASProactiveCalibrationAsset[] = [
  {
    id: "pc-1",
    customer_org: "โรงพยาบาลกรุงเทพ",
    customer_name: "นพ.สมชาย",
    manufacturer: "Fluke Biomedical",
    model: "ProSim 8",
    serial_number: "PS8-2023-1001",
    last_calibration_date: "2025-04-10",
    due_date: "2026-04-10",
    note: "เครื่องสาธิตที่ตัดขายแล้ว",
    created_at: "2025-04-10",
  },
]

export default function CalibrationProactivePage() {
  const useDevSeed = false
  const useDb = true
  const [assets, setAssets] = useState<ASProactiveCalibrationAsset[]>([])
  const [jobs, setJobs] = useState<ASServiceJob[]>([])
  const [search, setSearch] = useState("")
  const [openForm, setOpenForm] = useState(false)
  const today = new Date().toISOString().split("T")[0]
  const [productCatalog, setProductCatalog] = useState<ProductCatalogGroup[]>([])
  const [stockDropdownConfig, setStockDropdownConfig] = useState<ASDropdownConfig>(readDropdownConfig())

  const [form, setForm] = useState({
    customer_org: "",
    customer_name: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    last_calibration_date: "",
    due_date: "",
    note: "",
  })

  useEffect(() => {
    const sync = () => {
      setAssets(readProactiveCalibrationAssets(useDevSeed ? SEED_ASSETS : []))
      setProductCatalog(readProductCatalog())
      setStockDropdownConfig(readDropdownConfig())
    }
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [useDevSeed])

  useEffect(() => {
    const syncJobs = () => setJobs(readJobs([]))
    syncJobs()
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key !== AS_STORE_KEYS.jobs && ev.key !== AS_STORE_KEYS.jobsVersion) return
      syncJobs()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key && key !== AS_STORE_KEYS.jobs && key !== AS_STORE_KEYS.jobsVersion) return
      syncJobs()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  useEffect(() => {
    if (assets.length === 0) return
    writeProactiveCalibrationAssets(assets)
  }, [assets])

  async function upsertJobsToDb(patchJobs: ASServiceJob[]) {
    if (!useDb || patchJobs.length === 0) return
    try {
      await fetch("/api/as/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobs: patchJobs }),
      })
    } catch {
      // best-effort mirror during pilot
    }
  }

  const manufacturerOptions = useMemo(
    () => getStockPatternManufacturers(productCatalog, stockDropdownConfig),
    [productCatalog, stockDropdownConfig],
  )
  const modelOptions = useMemo(
    () => getStockPatternModelsForManufacturer(form.manufacturer, productCatalog, stockDropdownConfig),
    [form.manufacturer, productCatalog, stockDropdownConfig],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) =>
      [a.customer_org, a.customer_name || "", a.manufacturer, a.model, a.serial_number]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [assets, search])

  const counts = useMemo(() => {
    const overdue = assets.filter((a) => getDueState(a.due_date, today) === "overdue").length
    const urgent = assets.filter((a) => getDueState(a.due_date, today) === "urgent").length
    const near = assets.filter((a) => getDueState(a.due_date, today) === "near").length
    return { overdue, urgent, near }
  }, [assets, today])

  function addAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_org || !form.manufacturer || !form.model || !form.serial_number || !form.due_date) return
    const next: ASProactiveCalibrationAsset = {
      id: `pc-${Date.now()}`,
      customer_org: form.customer_org,
      customer_name: form.customer_name || undefined,
      manufacturer: form.manufacturer,
      model: form.model,
      serial_number: form.serial_number,
      last_calibration_date: form.last_calibration_date || undefined,
      due_date: form.due_date,
      note: form.note || undefined,
      created_at: today,
    }
    setAssets((prev) => [next, ...prev])
    if (next.last_calibration_date) {
      syncCalibrationBySerial({
        serial_number: next.serial_number,
        last_calibration_date: next.last_calibration_date,
        due_date: next.due_date,
        customer_org: next.customer_org,
        customer_name: next.customer_name,
        manufacturer: next.manufacturer,
        model: next.model,
        note: "Updated from Proactive form",
      })
    }
    setForm({
      customer_org: "",
      customer_name: "",
      manufacturer: "",
      model: "",
      serial_number: "",
      last_calibration_date: "",
      due_date: "",
      note: "",
    })
    setOpenForm(false)
  }

  function createCalJob(asset: ASProactiveCalibrationAsset) {
    const liveJobs = readJobs([])
    const existed = liveJobs.find(
      (j) =>
        j.source === "proactive" &&
        j.source_dispatch_id === asset.id &&
        j.status !== "ปิดงาน" &&
        j.status !== "ยกเลิก",
    )
    if (existed) return

    const todayISO = new Date().toISOString().split("T")[0]
    const count = Math.floor(Math.random() * 900) + 100
    const job: ASServiceJob = {
      id: `pj-${Date.now()}`,
      job_no: `JOB-2024-0${count}`,
      job_type: "calibration",
      status: "รอประเมิน",
      priority: "normal",
      serial_number: asset.serial_number,
      manufacturer: asset.manufacturer,
      model: asset.model,
      received_date: todayISO,
      tracking_in: "—",
      receive_channel: "พนักงาน",
      customer_name: asset.customer_name || "",
      customer_org: asset.customer_org,
      routing: "in_country",
      symptom_reported: `Proactive calibration ตามกำหนด Due ${asset.due_date}`,
      requires_approval: true,
      due_date: asset.due_date,
      source: "proactive",
      source_dispatch_id: asset.id,
      created_at: todayISO,
    }
    writeJobs([job, ...liveJobs])
    void upsertJobsToDb([job])
    setAssets((prev) => [...prev])

    const orgs = readOrganizations([])
    writeOrganizations(upsertOrganizationByName(orgs, asset.customer_org, asset.customer_name))
  }

  const proactiveOpenJobMap = useMemo(() => {
    return new Map(
      jobs
        .filter(
          (j) =>
            j.source === "proactive" &&
            j.source_dispatch_id &&
            j.status !== "ปิดงาน" &&
            j.status !== "ยกเลิก",
        )
        .map((j) => [j.source_dispatch_id as string, j.id]),
    )
  }, [jobs])
  const proactiveClosedJobMap = useMemo(() => {
    return new Map(
      jobs
        .filter(
          (j) =>
            j.source === "proactive" &&
            j.source_dispatch_id &&
            (j.status === "ปิดงาน" || j.status === "ยกเลิก"),
        )
        .map((j) => [j.source_dispatch_id as string, j.id]),
    )
  }, [jobs])

  return (
    <div className="relative z-10">
      <PageHeader
        title="Calibration Proactive Monitor"
        description="ติดตามเครื่องลูกค้าที่ใกล้ครบกำหนดสอบเทียบแบบเชิงรุก"
        icon={CalendarClock}
      />

      {(counts.overdue > 0 || counts.urgent > 0 || counts.near > 0) && (
        <div className="glass-panel flex items-center gap-3 p-4 rounded-2xl mb-4">
          <Bell className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 font-semibold">
            Calibration Alerts ·
            {counts.overdue > 0 && <span className="text-red-600"> เกิน Due {counts.overdue} เครื่อง</span>}
            {counts.urgent > 0 && <span className="text-orange-700"> · เร่งด่วนใน 7 วัน {counts.urgent} เครื่อง</span>}
            {counts.near > 0 && <span className="text-amber-700"> · ใกล้ครบใน 30 วัน {counts.near} เครื่อง</span>}
          </p>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            placeholder="ค้นหาลูกค้า / รุ่น / SN"
          />
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" /> เพิ่มเครื่องเชิงรุก
        </button>
      </div>

      <div className="overflow-auto rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["ลูกค้า", "เครื่อง", "SN", "Last Cal", "Due Date", "สถานะ", "หมายเหตุ", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((a) => {
              const state = getDueState(a.due_date, today)
              const stateLabel =
                state === "overdue"
                  ? "Overdue"
                  : state === "urgent"
                    ? "Urgent (<=7d)"
                    : state === "near"
                      ? "Near (<=30d)"
                      : "On Track"
              const stateColor =
                state === "overdue"
                  ? "bg-red-100 text-red-700"
                  : state === "urgent"
                    ? "bg-orange-100 text-orange-700"
                    : state === "near"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{a.customer_org}</p>
                    {a.customer_name && <p className="text-xs text-gray-500 mt-0.5">{a.customer_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.manufacturer} {a.model}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{a.serial_number}</td>
                  <td className="px-4 py-2 text-gray-600 align-top">
                    {a.last_calibration_date ? (
                      <div className="space-y-px">
                        <span className="block text-[10px] font-medium text-gray-700 leading-tight">
                          {formatThDateFromYMD(a.last_calibration_date)}
                        </span>
                        <span className="block font-mono text-[9px] leading-none text-gray-400">{a.last_calibration_date}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700 align-top">
                    <div className="space-y-px">
                      <span className="block text-[10px] font-medium text-gray-800 leading-tight">
                        {formatThDateFromYMD(a.due_date)}
                      </span>
                      <span className="block font-mono text-[9px] leading-none text-gray-400">{a.due_date}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stateColor}`}>{stateLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.note || "—"}</td>
                  <td className="px-4 py-3">
                    {proactiveOpenJobMap.has(a.id) ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">สร้างแล้ว</span>
                        <Link
                          href={`/as/service-request?proactive_id=${a.id}`}
                          className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors"
                        >
                          เปิดงาน
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {proactiveClosedJobMap.has(a.id) && (
                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">รอบก่อนปิดแล้ว</span>
                        )}
                        <button
                          onClick={() => createCalJob(a)}
                          className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-colors"
                        >
                          {proactiveClosedJobMap.has(a.id) ? "Create รอบใหม่" : "Create Cal Job"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  ยังไม่มีข้อมูล calibration proactive
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpenForm(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">เพิ่มเครื่องสำหรับ Proactive Calibration</h3>
              <button aria-label="ปิดหน้าต่าง" onClick={() => setOpenForm(false)} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={addAsset} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input required value={form.customer_org} onChange={(e) => setForm((f) => ({ ...f, customer_org: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="หน่วยงานลูกค้า *" />
                <input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="ผู้ติดต่อ" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  required
                  value={form.manufacturer}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value, model: "" }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                >
                  <option value="">-- เลือกยี่ห้อ --</option>
                  {manufacturerOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  required
                  value={form.model}
                  disabled={!form.manufacturer}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 disabled:bg-gray-100"
                >
                  <option value="">{form.manufacturer ? "-- เลือกรุ่น --" : "เลือกยี่ห้อก่อน"}</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input required value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="SN *" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Last Calibration Date</label>
                  <input type="date" value={form.last_calibration_date} onChange={(e) => setForm((f) => ({ ...f, last_calibration_date: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" />
                  <p className="text-[10px] text-gray-500 mt-1 leading-snug">{thDateInputBeHint(form.last_calibration_date)}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due Date *</label>
                  <input type="date" required value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" />
                  <p className="text-[10px] text-gray-500 mt-1 leading-snug">{thDateInputBeHint(form.due_date)}</p>
                </div>
              </div>
              <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="หมายเหตุ" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpenForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
