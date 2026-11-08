/**
 * "Ritme pendapatan": six months of PAID revenue (Metrics.revenue_by_month,
 * oldest first) as horizontal bars. Every bar carries its month and Rupiah
 * value as text (never color-only); bars grow from 0 via the Progress
 * transition. A zero-filled series shows an explicit empty note.
 */
import type { MonthRevenue } from '@/api/schemas'
import { Progress } from '@/components/ui/progress'
import { t } from '@/lib/copy'
import { formatMonth, formatRupiah } from '@/lib/format'

export function RevenueChart({ months }: { months: readonly MonthRevenue[] }) {
  const max = Math.max(0, ...months.map((m) => m.revenue_idr))
  return (
    <>
      <ul aria-label={t('admin.overview.revenueCaption')} className="mt-8 space-y-4">
        {months.map((m) => {
          const label = formatMonth(m.month)
          const amount = formatRupiah(m.revenue_idr)
          return (
            <li
              key={m.month}
              className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[5rem_1fr_8.5rem]"
            >
              <span className="text-caption font-semibold text-ink-secondary">{label}</span>
              <Progress
                value={m.revenue_idr}
                max={max}
                label={t('admin.overview.revenueBar', { month: label, amount })}
                className="h-4"
              />
              <span className="col-start-2 text-caption tabular-nums text-ink sm:col-start-3 sm:text-right">
                {amount}
              </span>
            </li>
          )
        })}
      </ul>
      {max === 0 && (
        <p className="mt-6 text-body-sm text-ink-secondary">{t('admin.overview.revenueEmpty')}</p>
      )}
    </>
  )
}
