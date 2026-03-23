"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, CalendarClock, Plus, Search, X } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  readJobs,
  readOrganizations,
  readProactiveCalibrationAssets,
  upsertOrganizationByName,
  writeJobs,
  writeOrganizations,
  writeProactiveCalibrationAssets,
  type ASServiceJob,
  type ASProactiveCalibrationAsset,
} from "@/lib/mock/as-store"

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
  const [assets, setAssets] = useState<ASProactiveCalibrationAsset[]>([])
  const [search, setSearch] = useState("")
  const [openForm, setOpenForm] = useState(false)
  const today = new Date().toISOString().split("T")[0]

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
    const sync = () => setAssets(readProactiveCalibrationAssets(SEED_ASSETS))
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("as-store-updated", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("as-store-updated", sync)
    }
  }, [])

  useEffect(() => {
    if (assets.length === 0) return
    writeProactiveCalibrationAssets(assets)
  }, [assets])

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
    const jobs = readJobs([])
    const existed = jobs.find((j) => j.source === "proactive" && j.source_dispatch_id === asset.id)
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
    writeJobs([job, ...jobs])
    setAssets((prev) => [...prev])

    const orgs = readOrganizations([])
    writeOrganizations(upsertOrganizationByName(orgs, asset.customer_org, asset.customer_name))
  }

  const proactiveJobMap = useMemo(() => {
    const jobs = readJobs([])
    return new Map(
      jobs
        .filter((j) => j.source === "proactive" && j.source_dispatch_id)
        .map((j) => [j.source_dispatch_id as string, j.id]),
    )
  }, [assets])

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
                  <td className="px-4 py-3 text-gray-600 text-xs">{a.last_calibration_date || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 font-semibold">{a.due_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stateColor}`}>{stateLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.note || "—"}</td>
                  <td className="px-4 py-3">
                    {proactiveJobMap.has(a.id) ? (
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
                      <button
                        onClick={() => createCalJob(a)}
                        className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-colors"
                      >
                        Create Cal Job
                      </button>
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
                <input required value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="Manufacturer *" />
                <input required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="Model *" />
                <input required value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="SN *" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Last Calibration Date</label>
                  <input type="date" value={form.last_calibration_date} onChange={(e) => setForm((f) => ({ ...f, last_calibration_date: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due Date *</label>
                  <input type="date" required value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" />
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
