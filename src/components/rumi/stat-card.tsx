/**
 * StatCard (DESIGN.md "StatCard"): a label, a large value, a tinted icon chip
 * and an optional footnote. Dashboards pass REAL data only — show an empty
 * value ("—") with an explanatory footnote rather than a made-up number.
 * The card is a group named by its label, so the value reads in context.
 */
import type { LucideIcon } from 'lucide-react'
import type { Tone } from '@/api/schemas'
import { Card, IconChip } from '@/components/ui/card'
import { cn } from '@/lib/cn'

export interface StatCardProps {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  tone?: Tone
  footnote?: React.ReactNode
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'teal',
  footnote,
  className,
}: StatCardProps) {
  return (
    <Card role="group" aria-label={label} className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm text-ink-tertiary">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink sm:text-3xl">
            {value}
          </p>
        </div>
        <IconChip tone={tone} size="sm">
          <Icon size={18} />
        </IconChip>
      </div>
      {footnote && (
        <p className="mt-4 text-caption font-semibold text-primary-strong">{footnote}</p>
      )}
    </Card>
  )
}
