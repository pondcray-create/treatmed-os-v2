"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Gavel, LayoutDashboard } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PerformanceHexSection } from "@/components/se/PerformanceHexSection"
import { AS_STORE_KEYS, readSEDeals, type SEDeal } from "@/lib/mock/as-store"
import { useAuth } from "@/hooks/useAuth"
import { formatCurrency } from "@/lib/utils"
import { formatHealthDistrictLabel } from "@/lib/data/th-public-hospitals"

/** ดีลที่น่าจะต้องขึ้น E-bidding — มอนิเตอร์ทีมขาย */
const EBIDDING_MIN_PROB_EXCLUSIVE = 70
const EBIDDING_MIN_VALUE_EXCLUSIVE = 500_000

function isOpenDeal(d: SEDeal) {
  const lost = (d.stage || "").toLowerCase() === "lost"
  const won = (d.stage || "").toLowerCase() === "won"
  return !lost && !won
}

function isEbiddingWatch(d: SEDeal) {
  return d.probability > EBIDDING_MIN_PROB_EXCLUSIVE && d.value > EBIDDING_MIN_VALUE_EXCLUSIVE && isOpenDeal(d)
}

export default function SEDashboardPage() {
  const { profile } = useAuth()
  const [deals, setDeals] = useState<SEDeal[]>(() => readSEDeals([]))

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

  const ownerName = profile?.full_name?.trim() || ""
  const isAdmin = profile?.role === "admin"
  const visibleDeals = useMemo(
    () =>
      !isAdmin && ownerName ? deals.filter((d) => (d.owner || "").trim() === ownerName) : deals,
    [deals, isAdmin, ownerName],
  )

  const ebiddingDeals = useMemo(() => visibleDeals.filter(isEbiddingWatch), [visibleDeals])

  const openPipeline = visibleDeals.filter(isOpenDeal)
  const weighted = useMemo(
    () => openPipeline.reduce((s, d) => s + d.value * (d.probability / 100), 0),
    [openPipeline],
  )

  return (
    <div className="relative">
      <PageHeader
        title="SE Dashboard"
        description={`มอนิเตอร์ดีล E-bidding (โอกาส > ${EBIDDING_MIN_PROB_EXCLUSIVE}% และมูลค่า > ${formatCurrency(EBIDDING_MIN_VALUE_EXCLUSIVE)}) · Performance Hex`}
        icon={LayoutDashboard}
      />
      {!isAdmin && (
        <div className="mb-3">
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
            My Data Only (enforced)
          </Badge>
        </div>
      )}

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
                <p className="text-xs text-muted-foreground">เฝ้า E-bidding</p>
                <p className="text-2xl font-bold text-amber-700">{ebiddingDeals.length}</p>
              </CardContent>
            </Card>
            <Card className="border-indigo-100">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Weighted (เปิด)</p>
                <p className="text-xl font-bold text-indigo-700">{formatCurrency(weighted)}</p>
              </CardContent>
            </Card>
          </div>

          <PerformanceHexSection chartHeight={300} />
        </div>

        <aside className="w-full xl:w-[min(100%,280px)] shrink-0 xl:sticky xl:top-4">
          <Card className="border-amber-200 shadow-sm bg-amber-50/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                <Gavel className="h-4 w-4 shrink-0" />
                เฝ้า E-bidding
              </CardTitle>
              <p className="text-[10px] text-amber-800/90 font-normal leading-snug">
                โอกาส &gt; {EBIDDING_MIN_PROB_EXCLUSIVE}% · มูลค่า &gt; {formatCurrency(EBIDDING_MIN_VALUE_EXCLUSIVE)} · ยังไม่ Won/Lost
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2 max-h-[min(70vh,520px)] overflow-y-auto">
              {ebiddingDeals.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">ไม่มีดีลในช่วงนี้</p>
              ) : (
                ebiddingDeals.map((d) => (
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
