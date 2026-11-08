/**
 * Shared loading / error states for data sections (DESIGN.md "Feedback
 * states"): `LoadError` is a danger InlineAlert carrying the API message and a
 * "Coba lagi" action; `CardGridSkeleton` fills a card grid while it loads
 * (decorative — the region it sits in sets `aria-busy`).
 */
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'

export interface LoadErrorProps {
  /** What failed, e.g. "Jadwal kelas gagal dimuat." */
  title: string
  error: unknown
  onRetry: () => void
  className?: string
}

export function LoadError({ title, error, onRetry, className }: LoadErrorProps) {
  return (
    <InlineAlert
      variant="danger"
      title={title}
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    >
      {apiErrorMessage(error)}
    </InlineAlert>
  )
}

export interface CardGridSkeletonProps {
  count: number
  /** Grid classes, e.g. "md:grid-cols-2 lg:grid-cols-3". */
  className?: string
  itemClassName?: string
}

export function CardGridSkeleton({ count, className, itemClassName }: CardGridSkeletonProps) {
  return (
    <div aria-hidden="true" className={cn('grid gap-4', className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn('h-56 rounded-2xl', itemClassName)} />
      ))}
    </div>
  )
}
