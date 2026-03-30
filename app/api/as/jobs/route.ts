import { NextResponse } from "next/server"
import prisma from "@/lib/db/prisma"
import type { ASServiceJob } from "@/lib/mock/as-store"
import type { Prisma } from "@/lib/generated/prisma/client"

function toIsoDate(v?: string): Date | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function sourceToDb(v?: string): "manual" | "se_request" | "stock_dispatch" | "proactive" {
  if (v === "se") return "se_request"
  if (v === "stock") return "stock_dispatch"
  if (v === "proactive") return "proactive"
  return "manual"
}

function sourceFromDb(v: "manual" | "se_request" | "stock_dispatch" | "proactive"): ASServiceJob["source"] {
  if (v === "se_request") return "se"
  if (v === "stock_dispatch") return "stock"
  if (v === "proactive") return "proactive"
  return "manual"
}

export async function GET() {
  const rows = await prisma.serviceJob.findMany({
    orderBy: { createdAt: "desc" },
  })

  const jobs: ASServiceJob[] = rows.map((r) => {
    const raw = (r.rawPayload || {}) as Partial<ASServiceJob>
    return {
      ...raw,
      id: r.id,
      job_no: raw.job_no || r.jobNo,
      job_type: (raw.job_type as ASServiceJob["job_type"]) || (r.jobType as ASServiceJob["job_type"]),
      status: (raw.status as ASServiceJob["status"]) || (r.status as ASServiceJob["status"]),
      serial_number: raw.serial_number || r.serialNumber || "",
      manufacturer: raw.manufacturer || r.manufacturer || "",
      model: raw.model || r.model || "",
      customer_name: raw.customer_name || r.customerName || "",
      customer_org: raw.customer_org || r.customerOrgNameSnapshot || "",
      source: raw.source || sourceFromDb(r.source),
      created_at: raw.created_at || r.createdAt.toISOString(),
    } as ASServiceJob
  })
  return NextResponse.json(jobs)
}

export async function POST(req: Request) {
  const body = (await req.json()) as { jobs?: ASServiceJob[] }
  const jobs = body?.jobs
  if (!Array.isArray(jobs)) {
    return NextResponse.json({ ok: false, error: "Missing jobs[]" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    const keepIds = jobs.map((j) => j.id)
    await tx.serviceJob.deleteMany({
      where: keepIds.length > 0 ? { id: { notIn: keepIds } } : undefined,
    })

    for (const j of jobs) {
      await tx.serviceJob.upsert({
        where: { id: j.id },
        update: {
          jobNo: j.job_no,
          jobType: j.job_type,
          status: j.status,
          source: sourceToDb(j.source),
          sourceDispatchId: j.source_dispatch_id || null,
          customerOrgNameSnapshot: j.customer_org || "",
          customerName: j.customer_name || null,
          manufacturer: j.manufacturer || null,
          model: j.model || null,
          serialNumber: j.serial_number || null,
          routing: j.routing || null,
          rmaCode: j.rma_code || null,
          symptom: j.symptom_reported || null,
          symptomActual: j.symptom_actual || null,
          fixMethod: j.fix_method || null,
          receivedDate: toIsoDate(j.received_date) || null,
          calibrationDate: toIsoDate(j.calibration_date) || null,
          dueDate: toIsoDate(j.due_date) || null,
          trackingIn: j.tracking_in || null,
          trackingOut: j.tracking_out || null,
          invoiceNo: j.invoice_no || null,
          warrantyDays: j.warranty_days || null,
          stockReturnReceivedAt: toIsoDate(j.stock_return_received_at) || null,
          rawPayload: j as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: j.id,
          jobNo: j.job_no,
          jobType: j.job_type,
          status: j.status,
          source: sourceToDb(j.source),
          sourceDispatchId: j.source_dispatch_id || null,
          customerOrgNameSnapshot: j.customer_org || "",
          customerName: j.customer_name || null,
          manufacturer: j.manufacturer || null,
          model: j.model || null,
          serialNumber: j.serial_number || null,
          routing: j.routing || null,
          rmaCode: j.rma_code || null,
          symptom: j.symptom_reported || null,
          symptomActual: j.symptom_actual || null,
          fixMethod: j.fix_method || null,
          receivedDate: toIsoDate(j.received_date) || null,
          calibrationDate: toIsoDate(j.calibration_date) || null,
          dueDate: toIsoDate(j.due_date) || null,
          trackingIn: j.tracking_in || null,
          trackingOut: j.tracking_out || null,
          invoiceNo: j.invoice_no || null,
          warrantyDays: j.warranty_days || null,
          stockReturnReceivedAt: toIsoDate(j.stock_return_received_at) || null,
          createdAt: toIsoDate(j.created_at) || new Date(),
          rawPayload: j as unknown as Prisma.InputJsonValue,
        },
      })
    }
  })

  return NextResponse.json({ ok: true, count: jobs.length })
}

