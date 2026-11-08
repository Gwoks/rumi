/**
 * KitCard (DESIGN.md "KitCard", the template ProductCard): a tinted tile with
 * the domain icon (or the kit's image), category, name, Rupiah price, the
 * stock indicator, an optional promo `badge_tag`, and a full-width `soft`
 * "Tambah ke Keranjang" that turns into a disabled "Stok habis" at stock 0.
 */
import type { PlayKit } from '@/api/schemas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { domainMeta, TONE_SOFT } from '@/lib/domains'
import { FOCUS } from '@/lib/styles'
import { Price } from './price'
import { StockBadge } from './status-badge'

export interface KitTileProps {
  kit: Pick<PlayKit, 'name' | 'category' | 'image_url'>
  className?: string
  iconSize?: number
}

/** The kit's media: its image, or a tone-tinted tile with the domain icon. */
export function KitTile({ kit, className, iconSize = 48 }: KitTileProps) {
  if (kit.image_url) {
    return (
      <img
        src={kit.image_url}
        alt={kit.name}
        className={cn('h-44 w-full object-cover', className)}
        loading="lazy"
      />
    )
  }
  const meta = domainMeta(kit.category)
  const Icon = meta.icon
  return (
    <div className={cn('grid h-44 place-items-center', TONE_SOFT[meta.tone], className)}>
      <Icon
        aria-hidden="true"
        size={iconSize}
        className="text-ink/60 transition motion-safe:group-hover:scale-110"
      />
    </div>
  )
}

export interface KitCardProps {
  kit: PlayKit
  onAdd: (kit: PlayKit) => void
  /** Opens the detail dialog; the tile becomes a button when set. */
  onDetails?: (kit: PlayKit) => void
  headingLevel?: 'h2' | 'h3'
  className?: string
}

export function KitCard({
  kit,
  onAdd,
  onDetails,
  headingLevel: Heading = 'h3',
  className,
}: KitCardProps) {
  const isOut = kit.stock <= 0
  return (
    <Card asChild padding="none" className={cn('group flex flex-col overflow-hidden', className)}>
      <article>
        <div className="relative">
          {onDetails ? (
            <button
              type="button"
              onClick={() => onDetails(kit)}
              aria-label={t('public.kitCard.details', { name: kit.name })}
              className={cn('block w-full rounded-t-2xl', FOCUS)}
            >
              <KitTile kit={kit} />
            </button>
          ) : (
            <KitTile kit={kit} />
          )}
          {kit.badge_tag && (
            <Badge variant="pending" className="pointer-events-none absolute left-3 top-3">
              {kit.badge_tag}
            </Badge>
          )}
        </div>
        <div className="flex-1 p-4">
          <p className="text-caption font-semibold text-primary-strong">
            {t(domainMeta(kit.category).labelKey)}
          </p>
          <Heading className="mt-1 text-h4 text-ink">{kit.name}</Heading>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Price amount={kit.price_idr} className="font-semibold text-ink" />
            <StockBadge stock={kit.stock} />
          </div>
        </div>
        <div className="px-4 pb-4">
          <Button
            variant="soft"
            className="w-full"
            disabled={isOut}
            onClick={() => onAdd(kit)}
            aria-label={isOut ? undefined : t('public.kitCard.addAria', { name: kit.name })}
          >
            {isOut ? t('common.stock.out') : t('public.kitCard.add')}
          </Button>
        </div>
      </article>
    </Card>
  )
}
