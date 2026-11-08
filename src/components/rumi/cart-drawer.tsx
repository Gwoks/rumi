/**
 * Global cart drawer (DESIGN.md "Drawer"), mounted once in `app-root.tsx` and
 * opened via `openCart()` from `@/stores/ui`. Kit lines get a quantity
 * stepper capped at min(stock, 10); class lines show the date, time, place
 * and the picked child. "Lanjut ke Pembayaran":
 *  - anonymous → /login?next=<here>&cart=open (the login screen reopens the cart);
 *  - ADMIN     → disabled (checkout is a PARENT action, PRD §5.8.4);
 *  - PARENT    → closes the drawer and opens the CheckoutDialog.
 */
import { useState } from 'react'
import { CalendarDays, Package, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '@/api/client'
import type { Child } from '@/api/schemas'
import { useAuth } from '@/api/use-auth'
import { Button } from '@/components/ui/button'
import { IconChip } from '@/components/ui/card'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '@/components/ui/drawer'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineAlert } from '@/components/ui/inline-alert'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { t } from '@/lib/copy'
import { formatDateLong, formatRupiah } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { useAsync } from '@/lib/use-async'
import {
  kitQuantityCap,
  lineTotal,
  removeItem,
  setQuantity,
  type CartClassItem,
  type CartItem,
  type CartKitItem,
} from '@/stores/cart'
import { closeCart, openCart, setCartOpen, useUi } from '@/stores/ui'
import { useCart } from '@/stores/use-cart'
import { CheckoutDialog } from './checkout/checkout-dialog'
import { Price } from './price'

/** `/login?next=<path>&cart=open` — never loops back to the auth pages. */
export function checkoutLoginPath(pathWithSearch: string): string {
  const isAuthPage = [ROUTES.login, ROUTES.register].some((p) => pathWithSearch.startsWith(p))
  const next = isAuthPage ? ROUTES.home : pathWithSearch
  return `${ROUTES.login}?next=${encodeURIComponent(next)}&cart=open`
}

function RemoveButton({ item }: { item: CartItem }) {
  const name = item.type === 'KIT' ? item.name : item.title
  return (
    <Button
      variant="icon"
      size="icon"
      aria-label={t('common.cart.remove', { name })}
      onClick={() => removeItem(item.line_id)}
      className="-mr-1 -mt-1 shrink-0"
    >
      <Trash2 aria-hidden="true" size={16} />
    </Button>
  )
}

function KitLine({ item }: { item: CartKitItem }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border-subtle p-3">
      <IconChip tone="teal" size="sm">
        <Package size={18} />
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-ink">{item.name}</p>
        <p className="text-caption text-ink-secondary">
          {t('public.cart.kit.unit', { price: formatRupiah(item.price_idr) })}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            value={item.quantity}
            max={Math.max(1, kitQuantityCap(item.max_stock))}
            onChange={(quantity) => setQuantity(item.line_id, quantity)}
            label={t('public.cart.quantityFor', { name: item.name })}
          />
          <Price amount={lineTotal(item)} className="text-body-sm font-semibold text-ink" />
        </div>
      </div>
      <RemoveButton item={item} />
    </li>
  )
}

function ClassLine({ item, childName }: { item: CartClassItem; childName: string | null }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border-subtle p-3">
      <IconChip tone="yellow" size="sm">
        <CalendarDays size={18} />
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-ink">{item.title}</p>
        <p className="text-caption text-ink-secondary">
          {formatDateLong(item.date)} · {t('common.time.wib', { time: item.time_slot })}
        </p>
        <p className="text-caption text-ink-secondary">{item.location}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption font-semibold text-primary-strong">
            {childName
              ? t('public.cart.class.child', { name: childName })
              : t('public.cart.class.childPending')}
          </p>
          <Price amount={lineTotal(item)} className="text-body-sm font-semibold text-ink" />
        </div>
      </div>
      <RemoveButton item={item} />
    </li>
  )
}

function EmptyCart() {
  return (
    <EmptyState
      icon={ShoppingBag}
      title={t('common.cart.empty.title')}
      body={t('common.cart.empty.body')}
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link to={ROUTES.weekendClasses} onClick={closeCart}>
              {t('public.cart.empty.classes')}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to={ROUTES.playKits} onClick={closeCart}>
              {t('public.cart.empty.kits')}
            </Link>
          </Button>
        </div>
      }
    />
  )
}

function CheckoutAction({ onCheckout }: { onCheckout: () => void }) {
  const { user, status } = useAuth()
  const location = useLocation()
  const label = t('public.cart.checkout')

  if (status === 'loading') {
    return (
      <Button variant="accent" size="lg" className="w-full" loading disabled>
        {label}
      </Button>
    )
  }
  if (!user) {
    return (
      <>
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link
            to={checkoutLoginPath(`${location.pathname}${location.search}`)}
            onClick={closeCart}
          >
            {label}
          </Link>
        </Button>
        <p className="text-caption text-ink-secondary">{t('public.cart.loginHint')}</p>
      </>
    )
  }
  if (user.role !== 'PARENT') {
    return (
      <>
        <InlineAlert variant="attention">{t('public.cart.adminHint')}</InlineAlert>
        <Button variant="accent" size="lg" className="w-full" disabled>
          {label}
        </Button>
      </>
    )
  }
  return (
    <Button variant="accent" size="lg" className="w-full" onClick={onCheckout}>
      {label}
    </Button>
  )
}

/** Child names for class lines that already have a child (PARENT only). */
function useChildNames(isEnabled: boolean): (id: number | null) => string | null {
  const children = useAsync<Child[]>(
    () => (isEnabled ? api.listChildren() : Promise.resolve([])),
    [isEnabled],
  )
  return (id) => (id === null ? null : (children.data?.find((c) => c.id === id)?.name ?? null))
}

export function CartDrawer() {
  const { cartOpen } = useUi()
  const { items, itemCount, totalIdr } = useCart()
  const { user } = useAuth()
  const [isCheckoutOpen, setCheckoutOpen] = useState(false)
  const hasPickedChild = items.some((i) => i.type === 'CLASS' && i.child_id !== null)
  const childName = useChildNames(cartOpen && user?.role === 'PARENT' && hasPickedChild)

  const startCheckout = () => {
    closeCart()
    setCheckoutOpen(true)
  }

  return (
    <>
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent>
          <DrawerHeader
            title={t('common.cart.title')}
            description={
              items.length > 0 ? t('public.cart.description', { count: itemCount }) : undefined
            }
          />
          <DrawerBody>
            {items.length === 0 ? (
              <EmptyCart />
            ) : (
              <ul aria-label={t('public.cart.lines')} className="space-y-3">
                {items.map((item) =>
                  item.type === 'KIT' ? (
                    <KitLine key={item.line_id} item={item} />
                  ) : (
                    <ClassLine
                      key={item.line_id}
                      item={item}
                      childName={childName(item.child_id)}
                    />
                  ),
                )}
              </ul>
            )}
          </DrawerBody>
          {items.length > 0 && (
            <DrawerFooter>
              <p className="flex justify-between text-body font-semibold text-ink">
                <span>{t('public.cart.total')}</span>
                <Price amount={totalIdr} />
              </p>
              <p className="text-caption text-ink-secondary">{t('public.cart.totalNote')}</p>
              <CheckoutAction onCheckout={startCheckout} />
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setCheckoutOpen}
        onEditCart={() => {
          setCheckoutOpen(false)
          openCart()
        }}
      />
    </>
  )
}
