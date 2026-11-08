/**
 * Stepper (DESIGN.md "Stepper"): an <ol> of steps; the current one has
 * aria-current="step". Done steps show a check (and sr-only "selesai").
 * `current` is 0-based.
 */
import { Check } from 'lucide-react'
import { Fragment } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'

export interface StepperProps {
  steps: readonly string[]
  current: number
  className?: string
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol aria-label={t('common.stepper.label')} className={cn('flex items-center gap-2', className)}>
      {steps.map((label, index) => {
        const isDone = index < current
        const isCurrent = index === current
        return (
          <Fragment key={label}>
            <li aria-current={isCurrent ? 'step' : undefined} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold',
                  isDone || isCurrent
                    ? 'bg-primary-strong text-primary-on'
                    : 'bg-surface-subtle text-ink-tertiary',
                )}
              >
                {isDone ? <Check size={15} /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-caption font-semibold max-sm:sr-only',
                  isCurrent ? 'text-ink' : 'text-ink-tertiary',
                )}
              >
                {label}
                {isDone && <span className="sr-only"> ({t('common.stepper.done')})</span>}
              </span>
            </li>
            {index < steps.length - 1 && (
              <li aria-hidden="true" className="h-px min-w-4 flex-1 bg-border" />
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}
