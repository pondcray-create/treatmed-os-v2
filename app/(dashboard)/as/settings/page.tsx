"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ASSettingsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/settings?tab=as")
  }, [router])

  return null
}
