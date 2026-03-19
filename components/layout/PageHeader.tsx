import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  children?: ReactNode
}

export function PageHeader({ title, description, icon: Icon, action, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action && (
          <Button onClick={action.onClick}>
            {action.icon && <action.icon className="h-4 w-4" />}
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
