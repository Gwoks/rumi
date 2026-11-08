/**
 * Kit detail dialog (home + /play-kits): tile, category, description, price,
 * stock badge and a quantity stepper capped so that the cart never holds more
 * than min(stock, 10) of this kit.
 */
import { useState } from 'react'
import type { PlayKit } from '@/api/schemas'
import { KitTile } from '@/components/rumi/kit-card'
import { Price } from '@/components/rumi/price'
import { StockBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { t } from '@/lib/copy'
import { domainMeta } from '@/lib/domains'
import { kitQuantityCap } from '@/stores/cart'
import { useCart } from '@/stores/use-cart'

export interface KitDetailDialogProps {
  kit: PlayKit | null
  onClose: () => void
  onAdd: (kit: PlayKit, quantity: number) => void
}

export function KitDetailDialog({ kit, onClose, onAdd }: KitDetailDialogProps) {
  return (
    <Dialog open={kit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="wide">
        {kit && <KitDetail key={kit.id} kit={kit} onAdd={onAdd} />}
      </DialogContent>
    </Dialog>
  )
}

function KitDetail({ kit, onAdd }: { kit: PlayKit; onAdd: KitDetailDialogProps['onAdd'] }) {
  const { items } = useCart()
  const inCart = items.reduce(
    (n, item) => (item.type === 'KIT' && item.kit_id === kit.id ? n + item.quantity : n),
    0,
  )
  const cap = kitQuantityCap(kit.stock)
  const remaining = Math.max(0, cap - inCart)
  const [quantity, setQuantity] = useState(1)
  const value = Math.min(quantity, Math.max(1, remaining))
  const isOut = kit.stock <= 0
  const canAdd = !isOut && remaining > 0

  return (
    <>
      <DialogHeader title={kit.name} description={kit.description} />
      <div className="grid gap-6 sm:grid-cols-2">
        <KitTile kit={kit} className="min-h-52 rounded-2xl" iconSize={72} />
        <div>
          <p className="text-body-sm font-semibold text-primary-strong">
            {t(domainMeta(kit.category).labelKey)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Price amount={kit.price_idr} className="text-h3 text-ink" />
            <StockBadge stock={kit.stock} />
          </div>
          {!isOut && (
            <div className="mt-6">
              <QuantityStepper
                value={value}
                min={1}
                max={Math.max(1, remaining)}
                onChange={setQuantity}
                label={t('public.cart.quantityFor', { name: kit.name })}
              />
              <p className="mt-2 text-caption text-ink-secondary">
                {t('public.kitDetail.capHint', { n: cap })}{' '}
                {inCart > 0 && t('public.kitDetail.inCart', { n: inCart })}
              </p>
              {remaining === 0 && (
                <p className="mt-2 text-caption font-semibold text-accent-strong">
                  {t('public.kitDetail.maxInCart')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="accent"
          disabled={!canAdd}
          onClick={() => onAdd(kit, value)}
          aria-label={canAdd ? t('public.kitCard.addAria', { name: kit.name }) : undefined}
        >
          {isOut ? t('common.stock.out') : t('public.kitCard.add')}
        </Button>
      </DialogFooter>
    </>
  )
}
