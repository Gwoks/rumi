/**
 * `/weekend-classes` Kelas Akhir Pekan (PRD §5.8.2 #3): URL-synced filters,
 * a ClassCard grid with live seat badges (re-fetched every 30 s while the
 * page is open), a detail dialog and "Pesan Kursi" → cart + toast + drawer.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { ClassQuery, WeekendClass } from '@/api/schemas'
import { CardGridSkeleton, LoadError } from '@/components/rumi/async-states'
import { ClassCard } from '@/components/rumi/class-card'
import { Container, PageHeader } from '@/components/rumi/section'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { t } from '@/lib/copy'
import { useAsync } from '@/lib/use-async'
import { ClassDetailDialog } from './shared/class-detail-dialog'
import { useCartActions } from './shared/use-cart-actions'
import {
  ClassFilters,
  FILTER_KEYS,
  hasRangeError,
  readClassFilters,
  type ClassFilterValues,
} from './weekend-classes/class-filters'

/** Seats change as other families book; refresh the list quietly. */
const SEAT_REFRESH_MS = 30_000
const GRID = 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'

interface ClassResultsProps {
  items: readonly WeekendClass[]
  isFiltered: boolean
  onReset: () => void
  onBook: (cls: WeekendClass) => void
  onDetails: (cls: WeekendClass) => void
}

function ClassResults({ items, isFiltered, onReset, onBook, onDetails }: ClassResultsProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={isFiltered ? t('public.classes.empty.title') : t('public.classes.none.title')}
        body={isFiltered ? t('public.classes.empty.body') : t('public.classes.none.body')}
        action={
          isFiltered && (
            <Button variant="secondary" onClick={onReset}>
              {t('public.classes.filters.reset')}
            </Button>
          )
        }
      />
    )
  }
  return (
    <>
      <p role="status" className="mb-4 text-body-sm text-ink-secondary">
        {t('public.classes.results', { n: items.length })}
      </p>
      <div className={GRID}>
        {items.map((cls) => (
          <ClassCard key={cls.id} cls={cls} onBook={onBook} onDetails={onDetails} />
        ))}
      </div>
    </>
  )
}

function toQuery(values: ClassFilterValues): ClassQuery {
  return {
    location: values.location || undefined,
    from: values.from || undefined,
    to: values.to || undefined,
    age: values.age ? Number(values.age) : undefined,
  }
}

export function WeekendClassesScreen() {
  const [params, setParams] = useSearchParams()
  const values = readClassFilters(params)
  const isRangeInvalid = hasRangeError(values)
  const isFiltered = FILTER_KEYS.some((key) => values[key] !== '')
  const { bookClass } = useCartActions()
  const [detail, setDetail] = useState<WeekendClass | null>(null)
  const [locations, setLocations] = useState<string[]>([])

  const classes = useAsync(
    () => (isRangeInvalid ? Promise.resolve(null) : api.listClasses(toQuery(values))),
    [values.location, values.from, values.to, values.age, isRangeInvalid],
  )
  const { reload } = classes

  useEffect(() => {
    if (classes.data) setLocations(classes.data.locations)
  }, [classes.data])

  useEffect(() => {
    const id = window.setInterval(reload, SEAT_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [reload])

  const setFilter = (key: keyof ClassFilterValues, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  const resetFilters = () => setParams(new URLSearchParams(), { replace: true })
  const book = (cls: WeekendClass) => {
    setDetail(null)
    bookClass(cls)
  }

  const items = classes.data?.items ?? []
  const isInitialLoad = classes.status === 'loading' && !classes.data

  return (
    <>
      <PageHeader
        eyebrow={t('public.classes.eyebrow')}
        eyebrowTone="primary"
        title={t('public.weekendClasses.title')}
        intro={t('public.classes.intro')}
      />
      <Container className="pb-20">
        <ClassFilters
          values={values}
          locations={locations}
          onChange={setFilter}
          onReset={resetFilters}
        />
        <section
          aria-label={t('public.weekendClasses.title')}
          aria-busy={isInitialLoad || undefined}
          className="mt-6"
        >
          {isRangeInvalid ? null : classes.status === 'error' ? (
            <LoadError
              title={t('public.classes.loadError')}
              error={classes.error}
              onRetry={reload}
            />
          ) : isInitialLoad ? (
            <CardGridSkeleton count={3} className={GRID} />
          ) : (
            <ClassResults
              items={items}
              isFiltered={isFiltered}
              onReset={resetFilters}
              onBook={book}
              onDetails={setDetail}
            />
          )}
        </section>
      </Container>
      <ClassDetailDialog cls={detail} onClose={() => setDetail(null)} onBook={book} />
    </>
  )
}
