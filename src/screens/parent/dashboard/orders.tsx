/**
 * "Pesanan": the parent's orders (GET /api/me/orders): order code, date,
 * items, total in Rp and the status badge. A PENDING_WA order offers
 * "Kirim ulang ke WhatsApp" (the server-built `wa_url`) plus its auto-cancel
 * deadline (`expires_at`).
 */
import { ArrowRight, MessageCircle, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { Order } from '@/api/schemas'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { OrderItemsList } from '@/components/rumi/order-items'
import { Price } from '@/components/rumi/price'
import { OrderStatusBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { t } from '@/lib/copy'
import { formatDateTime } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { useAsync } from '@/lib/use-async'
import { isWhatsAppUrl } from './tabs'

function statusNote(order: Order): string | null {
  if (order.status === 'PENDING_WA' && order.expires_at) {
    return t('parent.orders.expiresAt', { date: formatDateTime(order.expires_at) })
  }
  if (order.status === 'PAID' && order.paid_at) {
    return t('parent.orders.paidAt', { date: formatDateTime(order.paid_at) })
  }
  if (order.status === 'CANCELLED' && order.cancelled_at) {
    return t('parent.orders.cancelledAt', { date: formatDateTime(order.cancelled_at) })
  }
  return null
}

function OrderCard({ order }: { order: Order }) {
  const note = statusNote(order)
  const canResend = order.status === 'PENDING_WA' && isWhatsAppUrl(order.wa_url)
  return (
    <Card padding="standard" asChild>
      <article aria-labelledby={`order-${order.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id={`order-${order.id}`} className="text-h4 text-ink">
              {order.order_code}
            </h3>
            <p className="mt-1 text-caption text-ink-tertiary">
              {t('parent.orders.placedAt', { date: formatDateTime(order.created_at) })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderItemsList
          className="mt-5"
          items={order.items}
          label={t('parent.orderItem.listLabel', { code: order.order_code })}
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <p className="flex items-baseline gap-2 text-body-sm text-ink-secondary">
            {t('parent.orders.total')}
            <Price amount={order.total_amount_idr} className="text-body font-semibold text-ink" />
          </p>
          {canResend && (
            <Button asChild variant="accent" size="sm">
              <a
                href={order.wa_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('parent.orders.resendWaAria')}
              >
                <MessageCircle aria-hidden="true" size={16} />
                {t('parent.orders.resendWa')}
              </a>
            </Button>
          )}
        </div>
        {note && <p className="mt-3 text-caption text-ink-secondary">{note}</p>}
      </article>
    </Card>
  )
}

export function ParentOrders() {
  const orders = useAsync(() => api.listMyOrders(), [])

  const renderBody = () => {
    if (orders.status === 'error' && !orders.data) {
      return (
        <LoadError
          title={t('parent.orders.loadError')}
          error={orders.error}
          onRetry={orders.reload}
        />
      )
    }
    if (!orders.data) return <LoadingBlock label={t('parent.orders.loading')} />
    if (orders.data.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title={t('parent.orders.emptyTitle')}
          body={t('parent.orders.emptyBody')}
          action={
            <Button asChild variant="link">
              <Link to={ROUTES.weekendClasses}>
                {t('parent.orders.browse')}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </Button>
          }
        />
      )
    }
    return (
      <ul className="space-y-4">
        {orders.data.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby="parent-orders-title">
      <h2 id="parent-orders-title" className="text-h2 text-ink">
        {t('parent.orders.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-body-sm text-ink-secondary">
        {t('parent.orders.description')}
      </p>
      <div className="mt-6">{renderBody()}</div>
    </section>
  )
}
