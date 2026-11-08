/**
 * Status → badge variant + label (DESIGN.md status table, PRD §5.5 labels) and
 * the seat / stock indicators. Status is never shown by color alone: every
 * entry carries a text label.
 */
import type { ClassStatus, EnrollmentStatus, OrderStatus } from '@/api/schemas'
import { t, type CopyKey } from './copy'

export type BadgeTone = 'success' | 'pending' | 'attention' | 'neutral' | 'danger'

export interface StatusMeta {
  variant: BadgeTone
  labelKey: CopyKey
}

/** PRD §5.5 shared constant: a kit is "low stock" when stock ≤ 5 (0 included). */
export const LOW_STOCK_THRESHOLD = 5
/** Frontend constant: "Sisa {n} kursi" when seats_left ≤ 3. */
export const FEW_SEATS_THRESHOLD = 3

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  PENDING_WA: { variant: 'pending', labelKey: 'common.orderStatus.PENDING_WA' },
  PAID: { variant: 'success', labelKey: 'common.orderStatus.PAID' },
  CANCELLED: { variant: 'neutral', labelKey: 'common.orderStatus.CANCELLED' },
}

export const CLASS_STATUS: Record<ClassStatus, StatusMeta> = {
  DRAFT: { variant: 'pending', labelKey: 'common.classStatus.DRAFT' },
  OPEN: { variant: 'success', labelKey: 'common.classStatus.OPEN' },
  CLOSED: { variant: 'neutral', labelKey: 'common.classStatus.CLOSED' },
  CANCELLED: { variant: 'neutral', labelKey: 'common.classStatus.CANCELLED' },
}

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, StatusMeta> = {
  RESERVED: { variant: 'pending', labelKey: 'common.enrollmentStatus.RESERVED' },
  CONFIRMED: { variant: 'success', labelKey: 'common.enrollmentStatus.CONFIRMED' },
  ATTENDED: { variant: 'success', labelKey: 'common.enrollmentStatus.ATTENDED' },
  ABSENT: { variant: 'attention', labelKey: 'common.enrollmentStatus.ABSENT' },
  CANCELLED: { variant: 'neutral', labelKey: 'common.enrollmentStatus.CANCELLED' },
}

export interface Indicator {
  variant: BadgeTone
  label: string
}

/** Seat indicator: full → "Penuh"; ≤ 3 left → "Sisa {n} kursi"; else "{n} kursi tersedia". */
export function seatIndicator(seatsLeft: number, isFull: boolean): Indicator {
  if (isFull || seatsLeft <= 0) return { variant: 'attention', label: t('common.seats.full') }
  if (seatsLeft <= FEW_SEATS_THRESHOLD) {
    return { variant: 'attention', label: t('common.seats.few', { n: seatsLeft }) }
  }
  return { variant: 'success', label: t('common.seats.available', { n: seatsLeft }) }
}

/** Stock indicator: 0 → "Stok habis"; ≤ 5 → "Sisa {n}"; else "Stok tersedia". */
export function stockIndicator(stock: number): Indicator {
  if (stock <= 0) return { variant: 'neutral', label: t('common.stock.out') }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return { variant: 'attention', label: t('common.stock.low', { n: stock }) }
  }
  return { variant: 'success', label: t('common.stock.available') }
}
