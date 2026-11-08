/** Spinner (DESIGN.md "Feedback states"): a ring that spins only under
 * motion-safe, plus an sr-only "Memuat…" label. */
import { t } from '@/lib/copy'
import { cn } from '@/lib/cn'

export interface SpinnerProps {
  className?: string
  /** Screen-reader label; defaults to "Memuat…". */
  label?: string
}

export function Spinner({ className, label = t('common.loading') }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-5 w-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin',
          className,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
