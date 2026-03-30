import { NextResponse } from "next/server"
import prisma from "@/lib/db/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get("key")?.trim()
  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 })
  }
  const row = await prisma.appStateBlob.findUnique({ where: { key } })
  return NextResponse.json({ ok: true, payload: row?.payload ?? null })
}

export async function POST(req: Request) {
  const body = (await req.json()) as { key?: string; payload?: unknown }
  const key = (body?.key || "").trim()
  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 })
  }
  const payload = (body?.payload ?? null) as Prisma.InputJsonValue
  await prisma.appStateBlob.upsert({
    where: { key },
    update: { payload },
    create: { key, payload },
  })
  return NextResponse.json({ ok: true })
}

