/**
 * `/play-kits` Kit Edukasi (PRD §5.8.2 #5): a category filter (the five
 * domains, synced to `?category=`), the KitCard grid with stock badges and
 * promo tags, a detail dialog with a capped quantity stepper, and
 * "Tambah ke Keranjang".
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { domainSchema, type Domain, type PlayKit } from '@/api/schemas'
import { CardGridSkeleton, LoadError } from '@/components/rumi/async-states'
import { KitCard } from '@/components/rumi/kit-card'
import { Container, PageHeader } from '@/components/rumi/section'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { t } from '@/lib/copy'
import { DOMAINS } from '@/lib/domains'
import { useAsync } from '@/lib/use-async'
import { KitDetailDialog } from './shared/kit-detail-dialog'
import { useCartActions } from './shared/use-cart-actions'

const ALL = 'ALL'
type CategoryFilter = Domain | typeof ALL

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'

const OPTIONS: readonly SegmentedOption<CategoryFilter>[] = [
  { value: ALL, label: t('public.kits.filter.all') },
  ...DOMAINS.map((d) => ({ value: d.key, label: t(d.labelKey) })),
]

function readCategory(params: URLSearchParams): CategoryFilter {
  const parsed = domainSchema.safeParse(params.get('category'))
  return parsed.success ? parsed.data : ALL
}

export function PlayKitsScreen() {
  const [params, setParams] = useSearchParams()
  const category = readCategory(params)
  const { addKitToCart } = useCartActions()
  const [detail, setDetail] = useState<PlayKit | null>(null)

  const kits = useAsync(
    () => api.listKits({ category: category === ALL ? undefined : category }),
    [category],
  )
  const isInitialLoad = kits.status === 'loading' && !kits.data
  const items = kits.data ?? []

  const setCategory = (next: CategoryFilter) =>
    setParams(next === ALL ? new URLSearchParams() : new URLSearchParams({ category: next }), {
      replace: true,
    })
  const add = (kit: PlayKit, quantity = 1) => {
    setDetail(null)
    addKitToCart(kit, quantity)
  }

  return (
    <>
      <PageHeader
        eyebrow={t('public.kits.eyebrow')}
        title={t('public.playKits.title')}
        intro={t('public.kits.intro')}
      />
      <Container className="pb-20">
        <div className="-mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
          <Segmented
            aria-label={t('public.kits.filter.label')}
            options={OPTIONS}
            value={category}
            onChange={setCategory}
          />
        </div>
        <section
          aria-label={t('public.playKits.title')}
          aria-busy={isInitialLoad || undefined}
          className="mt-6"
        >
          {kits.status === 'error' ? (
            <LoadError
              title={t('public.kits.loadError')}
              error={kits.error}
              onRetry={kits.reload}
            />
          ) : isInitialLoad ? (
            <CardGridSkeleton count={4} className={GRID} itemClassName="h-80" />
          ) : items.length === 0 ? (
            <EmptyState
              title={category === ALL ? t('public.kits.none.title') : t('public.kits.empty.title')}
              body={category === ALL ? t('public.kits.none.body') : t('public.kits.empty.body')}
              action={
                category !== ALL && (
                  <Button variant="secondary" onClick={() => setCategory(ALL)}>
                    {t('public.kits.empty.showAll')}
                  </Button>
                )
              }
            />
          ) : (
            <div className={GRID}>
              {items.map((kit) => (
                <KitCard key={kit.id} kit={kit} onAdd={(k) => add(k)} onDetails={setDetail} />
              ))}
            </div>
          )}
        </section>
      </Container>
      <KitDetailDialog kit={detail} onClose={() => setDetail(null)} onAdd={add} />
    </>
  )
}
