import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { closeCart, openCart, setCartOpen, useUi } from './ui'

describe('ui store', () => {
  it('opens and closes the cart drawer', () => {
    const { result } = renderHook(() => useUi())
    expect(result.current.cartOpen).toBe(false)
    act(() => openCart())
    expect(result.current.cartOpen).toBe(true)
    act(() => closeCart())
    expect(result.current.cartOpen).toBe(false)
    act(() => setCartOpen(true))
    expect(result.current.cartOpen).toBe(true)
    act(() => setCartOpen(false))
  })
})
