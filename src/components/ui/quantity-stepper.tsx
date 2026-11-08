/**
 * Quantity stepper (DESIGN.md "Quantity stepper"): − value + with Indonesian
 * aria-labels; the value is announced politely. Steps are 32px (the one
 * allowed exception to the 40px target, still above WCAG 2.2's 24px).
 */
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { FOCUS } from '@/lib/styles'

export interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
  className?: string
  /** Names the group, e.g. the item name. */
  label?: string
}

const STEP = cn(
  'grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-subtle disabled:opacity-40',
  FOCUS,
)

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  className,
  label,
}: QuantityStepperProps) {
  return (
    <div
      role="group"
      aria-label={label ?? t('common.quantity.label')}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-border px-2 py-1',
        className,
      )}
    >
      <button
        type="button"
        className={STEP}
        aria-label={t('common.quantity.decrease')}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus aria-hidden="true" size={14} />
      </button>
      <span aria-live="polite" className="w-6 text-center text-body-sm font-semibold">
        {value}
      </span>
      <button
        type="button"
        className={STEP}
        aria-label={t('common.quantity.increase')}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus aria-hidden="true" size={14} />
      </button>
    </div>
  )
}
