/**
 * Cart actions for the public pages: add to the cart store, toast the outcome
 * in Indonesian, and (for a class seat) open the cart drawer so the parent
 * sees where the child is picked next.
 */
import type { PlayKit, WeekendClass } from '@/api/schemas'
import { useToast } from '@/components/ui/toast'
import { t } from '@/lib/copy'
import { addClass, addKit, type AddResult } from '@/stores/cart'
import { openCart } from '@/stores/ui'

export interface CartActions {
  bookClass: (cls: WeekendClass) => AddResult
  addKitToCart: (kit: PlayKit, quantity?: number) => AddResult
}

export function useCartActions(): CartActions {
  const { toast } = useToast()

  const bookClass = (cls: WeekendClass): AddResult => {
    const result = addClass(cls)
    if (result === 'cart_full') {
      toast(t('public.cart.toast.full'), 'error')
      return result
    }
    toast(
      result === 'added'
        ? t('public.cart.toast.classAdded', { title: cls.title })
        : t('public.cart.toast.classAlready', { title: cls.title }),
    )
    openCart()
    return result
  }

  const addKitToCart = (kit: PlayKit, quantity = 1): AddResult => {
    const result = addKit(kit, quantity)
    if (result === 'out_of_stock')
      toast(t('public.cart.toast.outOfStock', { name: kit.name }), 'error')
    else if (result === 'cart_full') toast(t('public.cart.toast.full'), 'error')
    else if (result === 'updated') toast(t('public.cart.toast.kitUpdated', { name: kit.name }))
    else toast(t('public.cart.toast.kitAdded', { name: kit.name, n: quantity }))
    return result
  }

  return { bookClass, addKitToCart }
}
