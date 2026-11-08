/**
 * Pagination for the PRD §5.4.10 `Paginated<T>` lists (admin students and
 * orders): "Halaman {page} dari {pages}" plus Sebelumnya / Berikutnya. Renders
 * nothing when everything fits on one page.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'

export interface PaginationProps {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  /** What is being paged, e.g. "daftar siswa" (names the nav landmark). */
  label: string
  className?: string
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)))
}

export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  label,
  className,
}: PaginationProps) {
  const pages = pageCount(total, perPage)
  if (pages <= 1) return null
  return (
    <nav
      aria-label={t('admin.pagination.label', { label })}
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <p className="text-body-sm text-ink-secondary" aria-live="polite">
        {t('admin.pagination.status', { page, pages })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          {t('admin.pagination.prev')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('admin.pagination.next')}
          <ChevronRight aria-hidden="true" size={16} />
        </Button>
      </div>
    </nav>
  )
}
