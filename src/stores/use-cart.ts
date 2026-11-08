/** React binding over the cart store: items plus memoized derived totals. */
import { useMemo } from 'react'
import { useStore } from '@/lib/create-store'
import { cartStore, cartTotals, type CartItem, type CartTotals } from './cart'

export interface CartSnapshot extends CartTotals {
  items: readonly CartItem[]
}

export function useCart(): CartSnapshot {
  const { items } = useStore(cartStore)
  const totals = useMemo(() => cartTotals(items), [items])
  return useMemo(() => ({ items, ...totals }), [items, totals])
}
