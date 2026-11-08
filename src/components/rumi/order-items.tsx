/**
 * Order item lines shared by the parent "Pesanan" tab and the admin orders
 * table: "Kit {name} ×{qty}" or "Kelas {name} ({child})" with the class date,
 * time (WIB) and location, the live enrollment status, and the line total.
 */
import type { OrderItem } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDateLong } from '@/lib/format'
import { Price } from './price'
import { EnrollmentStatusBadge } from './status-badge'

function itemTitle(item: OrderItem): string {
  if (item.type === 'KIT') return t('parent.orderItem.kit', { name: item.name, qty: item.quantity })
  return t('parent.orderItem.class', { name: item.name, child: item.child_name ?? '' })
}

function classMeta(item: OrderItem): string | null {
  if (item.type !== 'CLASS' || !item.class_date) return null
  return t('parent.orderItem.classMeta', {
    date: formatDateLong(item.class_date),
    time: item.class_time_slot ?? '',
    location: item.class_location ?? '',
  })
}

export interface OrderItemsListProps {
  items: readonly OrderItem[]
  /** Accessible name, e.g. "Isi pesanan RUMI-2026-0001". */
  label?: string
  className?: string
}

export function OrderItemsList({ items, label, className }: OrderItemsListProps) {
  return (
    <ul aria-label={label} className={cn('space-y-3', className)}>
      {items.map((item) => {
        const meta = classMeta(item)
        return (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="text-body-sm font-medium text-ink">{itemTitle(item)}</p>
              {meta && <p className="text-caption text-ink-secondary">{meta}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.enrollment_status && <EnrollmentStatusBadge status={item.enrollment_status} />}
              <Price amount={item.line_total_idr} className="text-body-sm font-semibold text-ink" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
