"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Gavel, LayoutDashboard } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PotentialPerformanceSection } from "@/components/se/PotentialPerformanceSection"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AS_STORE_KEYS,
  initialSESettingsForSSR,
  readSEDeals,
  readSESettings,
  writeSEDeals,
  type SEDeal,
  type SESettings,
} from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { formatCurrency } from "@/lib/utils"
import { formatHealthDistrictLabel } from "@/lib/data/th-public-hospitals"
import {
  achievedWonRevenueThb,
  collectSalesOwnerRows,
  computeCompanyRevenueTargetThb,
  computeOwnerQuotaThb,
  computeRealtimeWinRate,
  isLostStage,
  isWonStage,
  segmentTargetsFromCompanyThb,
  suggestedOpenPipelineNeedThb,
  sumDistrictCapsThb,
} from "@/lib/se/se-sales-planning"
import { aggregateLostDealsByReason } from "@/lib/se/se-lost-analytics"
import { weightedOpenPipelineThb } from "@/lib/se/se-forecast-integrity"
import {
  EBIDDING_MONITORING_MIN_VALUE_THB,
  isEbiddingDashboardListedDeal,
} from "@/lib/se/se-ebidding"

function isOpenDeal(d: SEDeal) {
  return !isLostStage(d.stage) && !isWonStage(d.stage)
}

export default function SEDashboardPage() {
  const { profile } = useAuth()
  const [deals, setDeals] = useState<SEDeal[]>([])
  const [seSettings, setSeSettings] = useState<SESettings>(() => initialSESettingsForSSR())

  useEffect(() => {
    const hydrate = () => setDeals(readSEDeals([]))
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seDeals) hydrate()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seDeals) hydrate()
    }
    hydrate()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  useEffect(() => {
    const sync = () => setSeSettings(readSESettings())
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === AS_STORE_KEYS.seSettings) sync()
    }
    const onStoreUpdated = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key
      if (key === AS_STORE_KEYS.seSettings) sync()
    }
    sync()
    window.addEventListener("storage", onStorage)
    window.addEventListener("as-store-updated", onStoreUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("as-store-updated", onStoreUpdated)
    }
  }, [])

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleDeals = useMemo(
    () =>
      !isAdmin && ownerName ? deals.filter((d) => (d.owner || "").trim() === ownerName) : deals,
    [deals, isAdmin, ownerName],
  )

  const ebiddingEligibleDeals = useMemo(() => {
    const rows = visibleDeals.filter(isEbiddingDashboardListedDeal)
    return [...rows].sort((a, b) => {
      const bc = b.on_ebidding ? 1 : 0
      const ac = a.on_ebidding ? 1 : 0
      if (bc !== ac) return bc - ac
      return (Number(b.value) || 0) - (Number(a.value) || 0)
    })
  }, [visibleDeals])

  const ebiddingConfirmedCount = useMemo(
    () => ebiddingEligibleDeals.filter((d) => d.on_ebidding).length,
    [ebiddingEligibleDeals],
  )

  const setEbiddingConfirmed = useCallback((dealId: string, on: boolean) => {
    setDeals((prev) => {
      const next = prev.map((d) => (d.id === dealId ? { ...d, on_ebidding: on } : d))
      writeSEDeals(next)
      return next
    })
  }, [])

  const openPipeline = visibleDeals.filter(isOpenDeal)
  const weighted = useMemo(
    () => openPipeline.reduce((s, d) => s + d.value * (d.probability / 100), 0),
    [openPipeline],
  )
  const weightedPolicyFloor = useMemo(
    () => weightedOpenPipelineThb(visibleDeals, seSettings, "policy_floor"),
    [visibleDeals, seSettings],
  )

  const lostByReason = useMemo(() => aggregateLostDealsByReason(visibleDeals), [visibleDeals])
  const lostDealCount = useMemo(
    () => visibleDeals.filter((d) => isLostStage(d.stage)).length,
    [visibleDeals],
  )

  const winRate01 = useMemo(() => computeRealtimeWinRate(deals), [deals])
  const sumCapsThb = useMemo(() => sumDistrictCapsThb(seSettings), [seSettings])
  const companyTargetThb = useMemo(() => computeCompanyRevenueTargetThb(seSettings), [seSettings])
  const segmentTargets = useMemo(
    () => segmentTargetsFromCompanyThb(companyTargetThb, seSettings),
    [companyTargetThb, seSettings],
  )
  const planningOwners = useMemo(() => {
    if (isAdmin) {
      const rows = collectSalesOwnerRows(seSettings)
      return rows.length ? rows : []
    }
    return ownerName ? [ownerName] : []
  }, [isAdmin, ownerName, seSettings])

  return (
    <div className="relative">
      <PageHeader
        title="SE Dashboard"
        description={`E-Bidding — ดีลเปิดมูลค่า ≥ ${formatCurrency(EBIDDING_MONITORING_MIN_VALUE_THB)} ขึ้นรายการอัตโนมัติ · ติ๊กยืนยันเมื่อประมูลจริง · Potential Performance`}
        icon={LayoutDashboard}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {!isAdmin && (
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
            My Data Only — Dashboard / Pipeline / Deals แสดงเฉพาะดีลของคุณ
          </Badge>
        )}
        {isAdmin && (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            Admin — เห็นดีลทั้งองค์กร (รวม E-Bidding)
          </Badge>
        )}
      </div>

      <div className="flex flex-col xl:flex-row gap-6 xl:items-start">
        <div className="flex-1 min-w-0 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-violet-100">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">ดีลเปิดอยู่</p>
                <p className="text-2xl font-bold text-violet-700">{openPipeline.length}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-100">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">E-Bidding (เกณฑ์มูลค่า)</p>
                <p className="text-2xl font-bold text-amber-700">{ebiddingEligibleDeals.length}</p>
                <p className="text-[10px] text-amber-900/80 mt-1 leading-tight">
                  ≥ {formatCurrency(EBIDDING_MONITORING_MIN_VALUE_THB)} · ยืนยันประมูลจริง {ebiddingConfirmedCount} รายการ
                </p>
              </CardContent>
            </Card>
            <Card className="border-indigo-100">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Weighted (เปิด — ตามที่ใส่)</p>
                <p className="text-xl font-bold text-indigo-700">{formatCurrency(weighted)}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  ฐานนโยบาย (ไม่ต่ำกว่า min stage / ดีลในมือ):{" "}
                  <span className="font-semibold text-indigo-900">{formatCurrency(weightedPolicyFloor)}</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-violet-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-violet-900">แผนเป้า & Funnel</CardTitle>
              <p className="text-xs text-muted-foreground font-normal leading-snug">
                T<sub>cap</sub> = ผลรวมเพดานเขต · T<sub>company</sub> = T<sub>cap</sub> × Achieve · Win rate จากดีลปิดจริง ·
                Pipeline เป้าหมาย ≈ ช่องว่างรายได้ / Win rate
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
                  <p className="text-muted-foreground">T_cap (เขต)</p>
                  <p className="text-sm font-bold text-violet-800">{formatCurrency(sumCapsThb)}</p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
                  <p className="text-muted-foreground">T_company</p>
                  <p className="text-sm font-bold text-violet-800">{formatCurrency(companyTargetThb)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <p className="text-muted-foreground">Win rate (ปิดแล้ว)</p>
                  <p className="text-sm font-bold text-emerald-800">
                    {(winRate01 * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-emerald-900/70 mt-1 leading-tight">
                    Won ÷ (Won + Lost) — ไม่ใช้ % โอกาสหรือสาเหตุแพ้ในสูตร
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-3 sm:col-span-1 col-span-2">
                  <p className="text-muted-foreground">Segment จาก Settings</p>
                  <p className="text-[11px] font-medium text-amber-900 leading-tight mt-0.5">
                    รพ.รัฐ {formatCurrency(segmentTargets.publicHospitalThb)} · อื่นๆ{" "}
                    {formatCurrency(segmentTargets.otherThb)} · buffer {formatCurrency(segmentTargets.bufferThb)}
                  </p>
                </div>
              </div>

              {planningOwners.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  ตั้งค่า SE Owners และมอบหมายเขตที่ Settings → SE Module เพื่อแสดงตาราง Quota / Pipeline
                </p>
              ) : (
                <div className="rounded-2xl border border-gray-100 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Sales</TableHead>
                        <TableHead className="text-right">Quota</TableHead>
                        <TableHead className="text-right">Won สะสม</TableHead>
                        <TableHead className="text-right">ช่องว่าง</TableHead>
                        <TableHead className="text-right">Pipeline เป้าหมาย (ดิบ)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planningOwners.map((name) => {
                        const quota = computeOwnerQuotaThb(name, seSettings)
                        const won = achievedWonRevenueThb(name, deals)
                        const gap = Math.max(0, quota - won)
                        const need = suggestedOpenPipelineNeedThb(gap, winRate01)
                        return (
                          <TableRow key={name} className="text-xs">
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(quota)}</TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700">
                              {formatCurrency(won)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(gap)}</TableCell>
                            <TableCell className="text-right tabular-nums text-violet-800">
                              {formatCurrency(need)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-rose-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-rose-900">สรุปสาเหตุแพ้ (Lost)</CardTitle>
              <p className="text-xs text-muted-foreground font-normal leading-snug">
                จากดีลที่ stage เป็น Lost ทั้งหมด {lostDealCount} รายการ (ขอบเขตเดียวกับการ์ดด้านบน) · มูลค่า = มูลค่าดีลตอนปิดแพ้
              </p>
            </CardHeader>
            <CardContent>
              {lostByReason.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">ยังไม่มีดีล Lost ในช่วงนี้</p>
              ) : (
                <div className="rounded-2xl border border-rose-100/80 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>สาเหตุ</TableHead>
                        <TableHead className="text-right">จำนวนดีล</TableHead>
                        <TableHead className="text-right">มูลค่ารวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lostByReason.map((row) => (
                        <TableRow key={row.reason} className="text-xs">
                          <TableCell className="font-medium text-rose-900/90">{row.reason}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                          <TableCell className="text-right tabular-nums text-rose-800">
                            {formatCurrency(row.lostValueThb)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <PotentialPerformanceSection chartHeight={300} />
        </div>

        <aside className="w-full xl:w-[min(100%,280px)] shrink-0 xl:sticky xl:top-4">
          <Card className="border-amber-200 shadow-sm bg-amber-50/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                <Gavel className="h-4 w-4 shrink-0" />
                E-Bidding Monitoring
              </CardTitle>
              <p className="text-[10px] text-amber-800/90 font-normal leading-snug">
                ระบบดึงดีลเปิดที่มูลค่า ≥ {formatCurrency(EBIDDING_MONITORING_MIN_VALUE_THB)} อัตโนมัติ — ติ๊กด้านล่างเมื่อเข้าประมูลจริง
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2 max-h-[min(70vh,520px)] overflow-y-auto">
              {ebiddingEligibleDeals.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  ไม่มีดีลเปิดที่ถึงเกณฑ์มูลค่าในขอบเขตที่คุณเห็น
                </p>
              ) : (
                ebiddingEligibleDeals.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-amber-200/80 bg-white p-3 text-xs shadow-sm"
                  >
                    <p className="font-mono text-[10px] text-muted-foreground">{d.deal_no}</p>
                    <p className="font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">{d.title}</p>
                    <p className="text-muted-foreground truncate mt-0.5">{d.customer_name}</p>
                    {(d.province || d.health_district) && (
                      <p className="text-[10px] text-violet-700 mt-1">
                        {d.province}
                        {d.health_district != null ? ` · ${formatHealthDistrictLabel(d.health_district)}` : ""}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {d.probability}%
                      </Badge>
                      <span className="text-[11px] font-bold text-primary">{formatCurrency(d.value)}</span>
                    </div>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-amber-400 text-amber-700"
                        checked={!!d.on_ebidding}
                        onChange={(e) => setEbiddingConfirmed(d.id, e.target.checked)}
                      />
                      <span className="text-[10px] font-semibold text-amber-900 leading-snug">ประมูลจริง (E-bidding)</span>
                    </label>
                    <Link
                      href="/se/pipeline"
                      className="mt-2 inline-block text-[10px] font-bold text-amber-800 underline underline-offset-2"
                    >
                      ไป Pipeline
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
