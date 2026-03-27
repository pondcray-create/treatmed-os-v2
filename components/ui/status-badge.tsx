import { Badge } from "@/components/ui/badge"

type ServiceStatus = "pending" | "in_progress" | "completed" | "cancelled"
type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
type Priority = "low" | "medium" | "high" | "urgent"
type FollowupStatus = "pending" | "done" | "cancelled"

const serviceStatusMap: Record<ServiceStatus, { label: string; variant: "warning" | "info" | "success" | "destructive" }> = {
  pending: { label: "รอดำเนินการ", variant: "warning" },
  in_progress: { label: "กำลังดำเนินการ", variant: "info" },
  completed: { label: "เสร็จสิ้น", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "destructive" },
}

const dealStageMap: Record<DealStage, { label: string; variant: "secondary" | "info" | "warning" | "default" | "success" | "destructive" }> = {
  lead: { label: "Lead", variant: "secondary" },
  qualified: { label: "Qualified", variant: "info" },
  proposal: { label: "Proposal", variant: "warning" },
  negotiation: { label: "Negotiation", variant: "default" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "destructive" },
}

const priorityMap: Record<Priority, { label: string; variant: "secondary" | "warning" | "default" | "destructive" }> = {
  low: { label: "ต่ำ", variant: "secondary" },
  medium: { label: "ปานกลาง", variant: "warning" },
  high: { label: "สูง", variant: "default" },
  urgent: { label: "เร่งด่วน", variant: "destructive" },
}

const followupStatusMap: Record<FollowupStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  pending: { label: "รอติดตาม", variant: "warning" },
  done: { label: "ติดตามแล้ว", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "destructive" },
}

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const config = serviceStatusMap[status] ?? { label: status, variant: "secondary" as const }
  return <Badge variant={config.variant as any}>{config.label}</Badge>
}

export function DealStageBadge({ stage }: { stage: string }) {
  const known = dealStageMap[stage as DealStage]
  const config = known ?? { label: stage, variant: "secondary" as const }
  return <Badge variant={config.variant as any}>{config.label}</Badge>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityMap[priority] ?? { label: priority, variant: "secondary" as const }
  return <Badge variant={config.variant as any}>{config.label}</Badge>
}

export function FollowupStatusBadge({ status }: { status: FollowupStatus }) {
  const config = followupStatusMap[status] ?? { label: status, variant: "secondary" as const }
  return <Badge variant={config.variant as any}>{config.label}</Badge>
}
