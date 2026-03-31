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
    const normalized: ASServiceJob = {
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
    // Guardrail: once Stock has confirmed receive, never surface as pending return again.
    if (normalized.stock_return_received_at) {
      normalized.stock_return_pending = false
    }
    return normalized
  })
  return NextResponse.json(jobs)
}

export async function POST(req: Request) {
  const body = (await req.json()) as { jobs?: ASServiceJob[]; full_replace?: boolean }
  const jobs = body?.jobs
  const fullReplace = body?.full_replace === true
  if (!Array.isArray(jobs)) {
    return NextResponse.json({ ok: false, error: "Missing jobs[]" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    if (fullReplace) {
      const keepIds = jobs.map((j) => j.id)
      await tx.serviceJob.deleteMany({
        where: keepIds.length > 0 ? { id: { notIn: keepIds } } : undefined,
      })
    }

    for (const j of jobs) {
      const normalizedJob: ASServiceJob = j.stock_return_received_at
        ? { ...j, stock_return_pending: false }
        : j
      await tx.serviceJob.upsert({
        where: { id: normalizedJob.id },
        update: {
          jobNo: normalizedJob.job_no,
          jobType: normalizedJob.job_type,
          status: normalizedJob.status,
          source: sourceToDb(normalizedJob.source),
          sourceDispatchId: normalizedJob.source_dispatch_id || null,
          customerOrgNameSnapshot: normalizedJob.customer_org || "",
          customerName: normalizedJob.customer_name || null,
          manufacturer: normalizedJob.manufacturer || null,
          model: normalizedJob.model || null,
          serialNumber: normalizedJob.serial_number || null,
          routing: normalizedJob.routing || null,
          rmaCode: normalizedJob.rma_code || null,
          symptom: normalizedJob.symptom_reported || null,
          symptomActual: normalizedJob.symptom_actual || null,
          fixMethod: normalizedJob.fix_method || null,
          receivedDate: toIsoDate(normalizedJob.received_date) || null,
          calibrationDate: toIsoDate(normalizedJob.calibration_date) || null,
          dueDate: toIsoDate(normalizedJob.due_date) || null,
          trackingIn: normalizedJob.tracking_in || null,
          trackingOut: normalizedJob.tracking_out || null,
          invoiceNo: normalizedJob.invoice_no || null,
          warrantyDays: normalizedJob.warranty_days || null,
          stockReturnReceivedAt: toIsoDate(normalizedJob.stock_return_received_at) || null,
          rawPayload: normalizedJob as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: normalizedJob.id,
          jobNo: normalizedJob.job_no,
          jobType: normalizedJob.job_type,
          status: normalizedJob.status,
          source: sourceToDb(normalizedJob.source),
          sourceDispatchId: normalizedJob.source_dispatch_id || null,
          customerOrgNameSnapshot: normalizedJob.customer_org || "",
          customerName: normalizedJob.customer_name || null,
          manufacturer: normalizedJob.manufacturer || null,
          model: normalizedJob.model || null,
          serialNumber: normalizedJob.serial_number || null,
          routing: normalizedJob.routing || null,
          rmaCode: normalizedJob.rma_code || null,
          symptom: normalizedJob.symptom_reported || null,
          symptomActual: normalizedJob.symptom_actual || null,
          fixMethod: normalizedJob.fix_method || null,
          receivedDate: toIsoDate(normalizedJob.received_date) || null,
          calibrationDate: toIsoDate(normalizedJob.calibration_date) || null,
          dueDate: toIsoDate(normalizedJob.due_date) || null,
          trackingIn: normalizedJob.tracking_in || null,
          trackingOut: normalizedJob.tracking_out || null,
          invoiceNo: normalizedJob.invoice_no || null,
          warrantyDays: normalizedJob.warranty_days || null,
          stockReturnReceivedAt: toIsoDate(normalizedJob.stock_return_received_at) || null,
          createdAt: toIsoDate(normalizedJob.created_at) || new Date(),
          rawPayload: normalizedJob as unknown as Prisma.InputJsonValue,
        },
      })
    }
  })

  return NextResponse.json({ ok: true, count: jobs.length, full_replace: fullReplace })
}

