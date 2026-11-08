import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeKit } from '@/test/factories'
import { addKit, clearCart } from './cart'
import { useCart } from './use-cart'

beforeEach(() => clearCart())

describe('useCart', () => {
  it('returns items with derived totals and stable identity between renders', () => {
    const { result, rerender } = renderHook(() => useCart())
    expect(result.current).toMatchObject({ items: [], itemCount: 0, totalIdr: 0 })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    act(() => {
      addKit(makeKit(), 2)
    })
    expect(result.current).toMatchObject({ itemCount: 2, totalIdr: 370000, hasKit: true })
  })
})
