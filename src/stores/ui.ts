/**
 * Tiny in-memory UI store for app-wide overlays. The header (and anything
 * else) calls `openCart()`; the cart drawer reads `useUi().cartOpen`.
 */
import { createStore, useStore } from '@/lib/create-store'

export interface UiState {
  cartOpen: boolean
}

export const uiStore = createStore<UiState>({ cartOpen: false })

export function openCart(): void {
  uiStore.setState((prev) => ({ ...prev, cartOpen: true }))
}

export function closeCart(): void {
  uiStore.setState((prev) => ({ ...prev, cartOpen: false }))
}

export function setCartOpen(open: boolean): void {
  uiStore.setState((prev) => ({ ...prev, cartOpen: open }))
}

export function useUi(): UiState {
  return useStore(uiStore)
}
