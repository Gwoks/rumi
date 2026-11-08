/**
 * Status badges (DESIGN.md status table, PRD §5.5 labels): order, class and
 * enrollment statuses plus the seat and stock indicators. Always text, never
 * color alone.
 */
import type { ClassStatus, EnrollmentStatus, OrderStatus } from '@/api/schemas'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/copy'
import {
  CLASS_STATUS,
  ENROLLMENT_STATUS,
  ORDER_STATUS,
  seatIndicator,
  stockIndicator,
  type StatusMeta,
} from '@/lib/status'

function MetaBadge({ meta, className }: { meta: StatusMeta; className?: string }) {
  return (
    <Badge variant={meta.variant} className={className}>
      {t(meta.labelKey)}
    </Badge>
  )
}

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus
  className?: string
}) {
  return <MetaBadge meta={ORDER_STATUS[status]} className={className} />
}

export interface ClassStatusBadgeProps {
  status: ClassStatus
  /** An OPEN class with no seats left shows "Penuh" (attention). */
  isFull?: boolean
  className?: string
}

export function ClassStatusBadge({ status, isFull = false, className }: ClassStatusBadgeProps) {
  if (isFull && status === 'OPEN') {
    return (
      <Badge variant="attention" className={className}>
        {t('common.seats.full')}
      </Badge>
    )
  }
  return <MetaBadge meta={CLASS_STATUS[status]} className={className} />
}

export function EnrollmentStatusBadge({
  status,
  className,
}: {
  status: EnrollmentStatus
  className?: string
}) {
  return <MetaBadge meta={ENROLLMENT_STATUS[status]} className={className} />
}

export function SeatBadge({
  seatsLeft,
  isFull,
  className,
}: {
  seatsLeft: number
  isFull: boolean
  className?: string
}) {
  const indicator = seatIndicator(seatsLeft, isFull)
  return (
    <Badge variant={indicator.variant} className={className}>
      {indicator.label}
    </Badge>
  )
}

export function StockBadge({ stock, className }: { stock: number; className?: string }) {
  const indicator = stockIndicator(stock)
  return (
    <Badge variant={indicator.variant} className={className}>
      {indicator.label}
    </Badge>
  )
}
