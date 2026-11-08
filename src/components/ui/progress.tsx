/**
 * Progress / level bar (DESIGN.md "Motion": bars grow from 0 on mount with the
 * progress transition; the global reduced-motion block neutralizes it).
 * Always pair with a visible text value (never color-only).
 */
import { useEffect, useState } from 'react'
import type { Tone } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { TONE_SOLID } from '@/lib/domains'

export interface ProgressProps {
  value: number
  max: number
  /** Accessible name, e.g. "Kehidupan Praktis: Berkembang (2/4)". */
  label: string
  tone?: Tone
  className?: string
}

export function Progress({ value, max, label, tone = 'teal', className }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(frame)
  }, [pct])
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-border-subtle', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-progress ease-emphasized',
          TONE_SOLID[tone],
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
