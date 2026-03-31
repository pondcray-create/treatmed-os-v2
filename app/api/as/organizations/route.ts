import { NextResponse } from "next/server"
import prisma from "@/lib/db/prisma"

type ASContactPayload = {
  id: string
  name: string
  position: string
  email: string
  tel: string
  is_primary: boolean
}

type ASOrganizationPayload = {
  id: string
  name: string
  name_english?: string
  org_type: string
  org_format: string
  province: string
  region: string
  health_district: number
  one_qa: boolean
  contacts: ASContactPayload[]
  created_at?: string
}

function toPayloadOrganization(o: {
  id: string
  name: string
  nameEnglish: string | null
  orgType: string
  orgFormat: string | null
  province: string | null
  region: string | null
  healthDistrict: number | null
  oneQa: boolean
  contacts: Array<{
    id: string
    name: string
    position: string | null
    email: string | null
    tel: string | null
    isPrimary: boolean
  }>
  createdAt: Date
}): ASOrganizationPayload {
  return {
    id: o.id,
    name: o.name,
    name_english: (o.nameEnglish ?? undefined) || undefined,
    org_type: o.orgType,
    org_format: o.orgFormat ?? "",
    province: o.province ?? "",
    region: o.region ?? "",
    health_district: o.healthDistrict ?? 0,
    one_qa: o.oneQa,
    contacts: o.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position ?? "",
      email: c.email ?? "",
      tel: c.tel ?? "",
      is_primary: c.isPrimary,
    })),
    created_at: o.createdAt.toISOString(),
  }
}

export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      include: { contacts: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(orgs.map(toPayloadOrganization))
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { orgs?: ASOrganizationPayload[] }
    const orgs = body?.orgs
    if (!Array.isArray(orgs)) {
      return NextResponse.json({ ok: false, error: "Missing orgs[]" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const o of orgs) {
        // Upsert organization by explicit id (UI generates it).
        await tx.organization.upsert({
          where: { id: o.id },
          update: {
            name: o.name,
            nameEnglish: (o.name_english ?? null) as string | null,
            orgType: o.org_type,
            orgFormat: o.org_format ?? null,
            province: o.province ?? null,
            region: o.region ?? null,
            healthDistrict: o.health_district && o.health_district > 0 ? o.health_district : null,
            oneQa: o.one_qa,
            // createdAt remains as original when record exists.
          },
          create: {
            id: o.id,
            name: o.name,
            nameEnglish: (o.name_english ?? null) as string | null,
            orgType: o.org_type,
            orgFormat: o.org_format ?? null,
            province: o.province ?? null,
            region: o.region ?? null,
            healthDistrict: o.health_district && o.health_district > 0 ? o.health_district : null,
            oneQa: o.one_qa,
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
          },
        })

        // Replace contacts for this organization.
        await tx.contact.deleteMany({ where: { organizationId: o.id } })
        if (Array.isArray(o.contacts) && o.contacts.length > 0) {
          await tx.contact.createMany({
            data: o.contacts.map((c) => ({
              id: c.id,
              organizationId: o.id,
              name: c.name,
              position: c.position || null,
              email: c.email || null,
              tel: c.tel || null,
              isPrimary: !!c.is_primary,
              createdAt: new Date(),
            })),
          })
        }
      }
    })

    const persisted = await prisma.organization.findMany({
      include: { contacts: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ ok: true, orgs: persisted.map(toPayloadOrganization) })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

