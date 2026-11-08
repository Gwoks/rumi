/**
 * "Ringkasan" (GET /api/admin/metrics): real aggregates only — revenue from
 * PAID orders, enrolled students, pending orders + amount, paid orders, the
 * six-month revenue bars, low-stock kits and the fill rate of upcoming classes.
 */
import { ArrowRight, BarChart3, CheckCircle2, Clock3, RefreshCw, Users } from 'lucide-react'
import { api } from '@/api/client'
import type { Metrics } from '@/api/schemas'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { StatCard } from '@/components/rumi/stat-card'
import { StockBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { t } from '@/lib/copy'
import { domainMeta } from '@/lib/domains'
import { formatDateLong, formatDateTime, formatRupiah } from '@/lib/format'
import { LOW_STOCK_THRESHOLD } from '@/lib/status'
import { useAsync } from '@/lib/use-async'
import { RevenueChart } from './revenue-chart'

interface NavigateProps {
  onNavigate: (tab: string) => void
}

function Stats({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('admin.overview.stat.revenue')}
        value={formatRupiah(metrics.total_revenue_idr)}
        icon={BarChart3}
        tone="yellow"
        footnote={t('admin.overview.stat.revenueNote', { n: metrics.paid_orders })}
      />
      <StatCard
        label={t('admin.overview.stat.students')}
        value={metrics.enrolled_students}
        icon={Users}
        footnote={t('admin.overview.stat.studentsNote')}
      />
      <StatCard
        label={t('admin.overview.stat.pending')}
        value={metrics.pending_orders}
        icon={Clock3}
        tone="orange"
        footnote={t('admin.overview.stat.pendingNote', {
          amount: formatRupiah(metrics.pending_amount_idr),
        })}
      />
      <StatCard
        label={t('admin.overview.stat.paid')}
        value={metrics.paid_orders}
        icon={CheckCircle2}
        footnote={t('admin.overview.stat.paidNote')}
      />
    </div>
  )
}

function LowStock({ metrics, onNavigate }: { metrics: Metrics } & NavigateProps) {
  return (
    <Card padding="standard" className="flex flex-col">
      <h3 className="text-h4 text-ink">{t('admin.overview.lowStockTitle')}</h3>
      <p className="mt-1 text-body-sm text-ink-secondary">
        {t('admin.overview.lowStockBody', { n: LOW_STOCK_THRESHOLD })}
      </p>
      {metrics.low_stock_kits.length === 0 ? (
        <p className="mt-6 text-body-sm text-ink-secondary">{t('admin.overview.lowStockEmpty')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {metrics.low_stock_kits.map((kit) => (
            <li
              key={kit.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft p-3"
            >
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-ink">{kit.name}</span>
                <span className="block text-caption text-ink-secondary">
                  {t(domainMeta(kit.category).labelKey)}
                </span>
              </span>
              <StockBadge stock={kit.stock} className="bg-surface" />
            </li>
          ))}
        </ul>
      )}
      <Button variant="link" className="mt-auto self-start pt-6" onClick={() => onNavigate('kits')}>
        {t('admin.overview.manageKits')}
        <ArrowRight aria-hidden="true" size={14} />
      </Button>
    </Card>
  )
}

function UpcomingClasses({ metrics, onNavigate }: { metrics: Metrics } & NavigateProps) {
  return (
    <Card padding="standard" className="flex flex-col lg:col-span-2">
      <h3 className="text-h4 text-ink">{t('admin.overview.classesTitle')}</h3>
      <p className="mt-1 text-body-sm text-ink-secondary">{t('admin.overview.classesBody')}</p>
      {metrics.upcoming_classes.length === 0 ? (
        <p className="mt-6 text-body-sm text-ink-secondary">{t('admin.overview.classesEmpty')}</p>
      ) : (
        <ul className="mt-6 space-y-5">
          {metrics.upcoming_classes.map((c) => (
            <li key={c.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-ink">{c.title}</span>
                  <span className="block text-caption text-ink-secondary">
                    {t('admin.overview.classMeta', {
                      date: formatDateLong(c.date),
                      time: c.time_slot,
                      location: c.location,
                    })}
                  </span>
                </span>
                <span className="text-body-sm tabular-nums text-ink-secondary">
                  {t('admin.overview.classFill', {
                    booked: c.seats_booked,
                    capacity: c.capacity,
                    pct: c.fill_rate_pct,
                  })}
                </span>
              </div>
              <Progress
                value={c.fill_rate_pct}
                max={100}
                tone={c.fill_rate_pct >= 100 ? 'orange' : 'teal'}
                label={t('admin.overview.classFillAria', { title: c.title, pct: c.fill_rate_pct })}
              />
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="link"
        className="mt-auto self-start pt-6"
        onClick={() => onNavigate('classes')}
      >
        {t('admin.overview.manageClasses')}
        <ArrowRight aria-hidden="true" size={14} />
      </Button>
    </Card>
  )
}

export function AdminOverview({ onNavigate }: NavigateProps) {
  const metrics = useAsync(() => api.adminMetrics(), [])

  const renderBody = () => {
    if (metrics.status === 'error' && !metrics.data) {
      return (
        <LoadError
          title={t('admin.overview.loadError')}
          error={metrics.error}
          onRetry={metrics.reload}
        />
      )
    }
    if (!metrics.data) return <LoadingBlock label={t('admin.overview.loading')} rows={4} />
    const data = metrics.data
    return (
      <div className="space-y-5">
        <Stats metrics={data} />
        <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <Card padding="standard">
            <h3 className="text-h4 text-ink">{t('admin.overview.revenueTitle')}</h3>
            <p className="mt-1 text-body-sm text-ink-secondary">
              {t('admin.overview.revenueBody')}
            </p>
            <RevenueChart months={data.revenue_by_month} />
          </Card>
          <LowStock metrics={data} onNavigate={onNavigate} />
          <UpcomingClasses metrics={data} onNavigate={onNavigate} />
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="admin-overview-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="admin-overview-title" className="text-h2 text-ink">
            {t('admin.overview.title')}
          </h2>
          <p className="mt-2 text-body-sm text-ink-secondary">
            {metrics.data
              ? t('admin.overview.updatedAt', { date: formatDateTime(metrics.data.generated_at) })
              : t('admin.overview.description')}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={metrics.reload}
          loading={metrics.status === 'loading' && metrics.data !== undefined}
        >
          <RefreshCw aria-hidden="true" size={16} />
          {t('admin.overview.refresh')}
        </Button>
      </div>
      <div className="mt-6">{renderBody()}</div>
    </section>
  )
}
