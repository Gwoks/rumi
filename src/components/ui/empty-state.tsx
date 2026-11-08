/** Empty state (DESIGN.md "Feedback states"): dashed card, icon chip, title,
 * body and an optional action. Prefer this over a made-up number. */
import { Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconChip } from './card'

export interface EmptyStateProps {
  title: string
  body?: React.ReactNode
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
  /** Heading level for the title (keep the page outline in order). */
  headingLevel?: 'h2' | 'h3' | 'h4'
}

export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
  action,
  className,
  headingLevel = 'h3',
}: EmptyStateProps) {
  const Heading = headingLevel
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <IconChip tone="teal">
        <Icon size={20} />
      </IconChip>
      <Heading className="text-h4 text-ink">{title}</Heading>
      {body && <p className="max-w-sm text-body-sm text-ink-secondary">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
