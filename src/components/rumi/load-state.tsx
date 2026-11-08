/**
 * Loading and load-error blocks shared by the dashboards and the report:
 * a busy region of skeletons (with an sr-only label) and a danger alert that
 * shows the API error in Indonesian plus a "Coba lagi" retry.
 */
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'

export interface LoadingBlockProps {
  /** Screen-reader text, e.g. "Memuat pesanan…". */
  label: string
  rows?: number
  className?: string
}

export function LoadingBlock({ label, rows = 3, className }: LoadingBlockProps) {
  return (
    <div aria-busy="true" className={cn('space-y-3', className)}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}

export interface LoadErrorProps {
  title: string
  error: unknown
  onRetry?: () => void
  className?: string
}

export function LoadError({ title, error, onRetry, className }: LoadErrorProps) {
  return (
    <InlineAlert
      variant="danger"
      title={title}
      className={className}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )
      }
    >
      {apiErrorMessage(error)}
    </InlineAlert>
  )
}
