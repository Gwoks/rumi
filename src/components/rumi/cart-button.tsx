/**
 * Header cart button: icon + count chip; opens the global cart drawer through
 * the UI store. The count change is announced politely.
 */
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { openCart } from '@/stores/ui'
import { useCart } from '@/stores/use-cart'

export function CartButton({ className }: { className?: string }) {
  const { itemCount } = useCart()
  return (
    <>
      <Button
        variant="icon"
        size="icon"
        aria-label={t('common.cart.open.aria', { count: itemCount })}
        onClick={openCart}
        className={cn('relative', className)}
      >
        <ShoppingBag aria-hidden="true" size={20} />
        {itemCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold leading-none text-accent-on"
          >
            {itemCount}
          </span>
        )}
      </Button>
      <span className="sr-only" aria-live="polite">
        {itemCount > 0 ? t('common.cart.countAnnouncement', { count: itemCount }) : ''}
      </span>
    </>
  )
}
