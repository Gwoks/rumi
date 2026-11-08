import { describe, expect, it } from 'vitest'
import {
  CLASS_STATUS,
  ENROLLMENT_STATUS,
  ORDER_STATUS,
  seatIndicator,
  stockIndicator,
} from './status'

describe('status maps (DESIGN.md)', () => {
  it('maps order, class and enrollment statuses to badge variants', () => {
    expect(ORDER_STATUS.PENDING_WA.variant).toBe('pending')
    expect(ORDER_STATUS.PAID.variant).toBe('success')
    expect(CLASS_STATUS.DRAFT.variant).toBe('pending')
    expect(CLASS_STATUS.CLOSED.variant).toBe('neutral')
    expect(ENROLLMENT_STATUS.ABSENT.variant).toBe('attention')
    expect(ENROLLMENT_STATUS.ATTENDED.variant).toBe('success')
  })
})

describe('seatIndicator', () => {
  it('reads full, few and available', () => {
    expect(seatIndicator(0, true)).toEqual({ variant: 'attention', label: 'Penuh' })
    expect(seatIndicator(3, false)).toEqual({ variant: 'attention', label: 'Sisa 3 kursi' })
    expect(seatIndicator(4, false)).toEqual({ variant: 'success', label: '4 kursi tersedia' })
  })
})

describe('stockIndicator (LOW_STOCK_THRESHOLD = 5)', () => {
  it('reads out, low and available', () => {
    expect(stockIndicator(0)).toEqual({ variant: 'neutral', label: 'Stok habis' })
    expect(stockIndicator(5)).toEqual({ variant: 'attention', label: 'Sisa 5' })
    expect(stockIndicator(6)).toEqual({ variant: 'success', label: 'Stok tersedia' })
  })
})
