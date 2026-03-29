import type { ReactNode } from "react"
import { SEDealNeglectSync } from "@/components/se/SEDealNeglectSync"

export default function SELayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SEDealNeglectSync />
      {children}
    </>
  )
}
