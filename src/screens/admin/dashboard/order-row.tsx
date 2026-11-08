/**
 * One admin order row plus its expandable detail row (items, recipient,
 * WhatsApp number, address, notes, and the PAID / CANCELLED / auto-cancel
 * timestamps). Actions follow the PRD §5.9.4 state machine: PENDING_WA can
 * be marked PAID or cancelled; PAID can only be cancelled; CANCELLED is final.
 */
import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import type { Order, OrderStatus } from '@/api/schemas'
import { OrderItemsList } from '@/components/rumi/order-items'
import { Price } from '@/components/rumi/price'
import { OrderStatusBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDateTime } from '@/lib/format'
import { FOCUS } from '@/lib/styles'

export interface OrderAction {
  order: Order
  to: Extract<OrderStatus, 'PAID' | 'CANCELLED'>
}

const COLUMN_COUNT = 5

function timeline(order: Order): string | null {
  if (order.status === 'PENDING_WA' && order.expires_at) {
    return t('admin.orders.expiresAt', { date: formatDateTime(order.expires_at) })
  }
  if (order.status === 'PAID' && order.paid_at) {
    return t('admin.orders.paidAt', { date: formatDateTime(order.paid_at) })
  }
  if (order.status === 'CANCELLED' && order.cancelled_at) {
    return t('admin.orders.cancelledAt', { date: formatDateTime(order.cancelled_at) })
  }
  return null
}

function OrderDetail({ order }: { order: Order }) {
  const note = timeline(order)
  return (
    <div className="grid gap-6 rounded-xl bg-surface-subtle p-4 md:grid-cols-[1.4fr_1fr]">
      <div>
        <h4 className="text-overline uppercase text-ink-tertiary">{t('admin.orders.items')}</h4>
        <OrderItemsList
          className="mt-3"
          items={order.items}
          label={t('parent.orderItem.listLabel', { code: order.order_code })}
        />
      </div>
      <div className="space-y-1 text-body-sm">
        <h4 className="text-overline uppercase text-ink-tertiary">{t('admin.orders.delivery')}</h4>
        <p className="pt-2 font-semibold text-ink">{order.delivery_name}</p>
        <p className="text-ink-secondary">
          {t('admin.orders.deliveryPhone', { phone: order.delivery_phone })}
        </p>
        {order.delivery_address && <p className="text-ink-secondary">{order.delivery_address}</p>}
        {order.notes && (
          <p className="text-ink-secondary">{t('admin.orders.notes', { notes: order.notes })}</p>
        )}
        {note && <p className="pt-2 text-caption text-ink-tertiary">{note}</p>}
      </div>
    </div>
  )
}

export interface OrderRowProps {
  order: Order
  onAction: (action: OrderAction) => void
}

export function OrderRow({ order, onAction }: OrderRowProps) {
  const [isExpanded, setExpanded] = useState(false)
  const detailId = useId()
  const canPay = order.status === 'PENDING_WA'
  const canCancel = order.status === 'PENDING_WA' || order.status === 'PAID'
  return (
    <>
      <TableRow className={cn(isExpanded && 'border-b-0')}>
        <TableCell>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailId}
            aria-label={t('admin.orders.toggleAria', { code: order.order_code })}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-lg pr-2 text-left font-semibold text-ink',
              FOCUS,
            )}
          >
            <ChevronRight
              aria-hidden="true"
              size={16}
              className={cn(
                'shrink-0 transition motion-safe:duration-fast',
                isExpanded && 'rotate-90',
              )}
            />
            {order.order_code}
          </button>
          <span className="block pl-6 text-caption text-ink-tertiary">
            {formatDateTime(order.created_at)}
          </span>
        </TableCell>
        <TableCell>
          <span className="block">{order.parent_name}</span>
          <span className="block text-caption text-ink-secondary">{order.parent_email}</span>
        </TableCell>
        <TableCell>
          <Price amount={order.total_amount_idr} className="font-semibold" />
        </TableCell>
        <TableCell>
          <OrderStatusBadge status={order.status} />
        </TableCell>
        <TableCell className="text-right">
          <span className="inline-flex flex-wrap justify-end gap-2">
            {canPay && (
              <Button
                size="sm"
                aria-label={t('admin.orders.markPaidAria', { code: order.order_code })}
                onClick={() => onAction({ order, to: 'PAID' })}
              >
                {t('admin.orders.markPaid')}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="secondary"
                aria-label={t('admin.orders.cancelAria', { code: order.order_code })}
                onClick={() => onAction({ order, to: 'CANCELLED' })}
              >
                {t('admin.orders.cancel')}
              </Button>
            )}
          </span>
        </TableCell>
      </TableRow>
      <TableRow id={detailId} hidden={!isExpanded}>
        <TableCell colSpan={COLUMN_COUNT} className="pt-0">
          {isExpanded && <OrderDetail order={order} />}
        </TableCell>
      </TableRow>
    </>
  )
}
