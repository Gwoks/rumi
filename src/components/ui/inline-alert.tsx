/**
 * Inline alert (DESIGN.md "Feedback states"): info and attention are
 * `role="status"`, danger is `role="alert"`. Icon + text, never color-only.
 */
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export type InlineAlertVariant = 'info' | 'attention' | 'danger'

const VARIANTS: Record<
  InlineAlertVariant,
  { box: string; icon: string; role: 'status' | 'alert' }
> = {
  info: { box: 'bg-primary-soft text-ink', icon: 'text-primary-strong', role: 'status' },
  attention: { box: 'bg-accent-soft text-ink', icon: 'text-accent-strong', role: 'status' },
  danger: {
    box: 'border border-danger-border bg-danger-soft text-danger',
    icon: '',
    role: 'alert',
  },
}

const ICONS = { info: Info, attention: AlertTriangle, danger: AlertCircle } as const

export interface InlineAlertProps {
  variant?: InlineAlertVariant
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function InlineAlert({
  variant = 'info',
  title,
  children,
  action,
  className,
}: InlineAlertProps) {
  const style = VARIANTS[variant]
  const Icon = ICONS[variant]
  return (
    <div
      role={style.role}
      className={cn('flex items-start gap-3 rounded-xl p-3 text-body-sm', style.box, className)}
    >
      <Icon aria-hidden="true" size={17} className={cn('mt-0.5 shrink-0', style.icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
