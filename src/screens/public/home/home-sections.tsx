/**
 * Beranda sections below the hero: quick booking, "Cara RUMI" (CMS), the next
 * three classes, the latest four kits and the join band. Each data section
 * owns its loading skeleton, error alert (with retry) and empty state.
 */
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlayKit, RumiWayBody, WeekendClass } from '@/api/schemas'
import { CardGridSkeleton, LoadError } from '@/components/rumi/async-states'
import { ClassCard, classAvailability, DateTile } from '@/components/rumi/class-card'
import { InfoCard } from '@/components/rumi/cms-section'
import { KitCard } from '@/components/rumi/kit-card'
import { Container, Section, SectionHeading } from '@/components/rumi/section'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDateLong } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'
import type { AsyncState } from '@/lib/use-async'

function HeaderRow({
  id,
  eyebrow,
  eyebrowTone,
  title,
  linkTo,
  linkLabel,
}: {
  id: string
  eyebrow: string
  eyebrowTone: 'accent' | 'primary'
  title: string
  linkTo: string
  linkLabel: string
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <SectionHeading id={id} eyebrow={eyebrow} eyebrowTone={eyebrowTone} title={title} />
      <Button asChild variant="link" className="self-start sm:self-auto">
        <Link to={linkTo}>
          {linkLabel}
          <ArrowRight aria-hidden="true" size={15} />
        </Link>
      </Button>
    </div>
  )
}

export function QuickBooking({
  classes,
  onBook,
}: {
  classes: AsyncState<WeekendClass[]>
  onBook: (cls: WeekendClass) => void
}) {
  if (classes.status === 'error') return null
  if (!classes.data) {
    return (
      <Container aria-hidden="true">
        <Skeleton className="h-32 rounded-2xl" />
      </Container>
    )
  }
  const next = classes.data.find((cls) => classAvailability(cls) === 'bookable')
  return (
    <Container>
      <Card
        variant="feature"
        padding="feature"
        asChild
        className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <section aria-labelledby="quick-booking-heading">
          <div className="flex items-center gap-4">
            {next && <DateTile date={next.date} />}
            <div>
              <p className="text-overline uppercase text-ink-inverse/80">
                {t('public.home.quick.eyebrow')}
              </p>
              <h2 id="quick-booking-heading" className="mt-1 text-h3">
                {next
                  ? t('public.home.quick.title', { title: next.title })
                  : t('public.home.quick.empty')}
              </h2>
              {next && (
                <p className="mt-1 text-body-sm text-ink-inverse/80">
                  {formatDateLong(next.date)} · {t('common.time.wib', { time: next.time_slot })} ·{' '}
                  {next.location}
                </p>
              )}
            </div>
          </div>
          {next ? (
            <Button variant="secondary" size="lg" className="shrink-0" onClick={() => onBook(next)}>
              {t('public.home.quick.cta')}
            </Button>
          ) : (
            <Button asChild variant="secondary" size="lg" className="shrink-0">
              <Link to={ROUTES.weekendClasses}>{t('public.home.quick.browse')}</Link>
            </Button>
          )}
        </section>
      </Card>
    </Container>
  )
}

export function RumiWaySection({ body }: { body: RumiWayBody }) {
  return (
    <Section tone="surface" aria-labelledby="rumi-way-heading" className="mt-20">
      <SectionHeading
        id="rumi-way-heading"
        eyebrow={body.eyebrow}
        title={body.heading}
        intro={body.intro}
      />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {body.cards.map((card) => (
          <InfoCard key={card.title} {...card} />
        ))}
      </div>
    </Section>
  )
}

export function UpcomingClassesSection({
  classes,
  onBook,
  onDetails,
}: {
  classes: AsyncState<WeekendClass[]>
  onBook: (cls: WeekendClass) => void
  onDetails: (cls: WeekendClass) => void
}) {
  const grid = 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
  return (
    <Section
      aria-labelledby="upcoming-heading"
      aria-busy={classes.status === 'loading' || undefined}
    >
      <HeaderRow
        id="upcoming-heading"
        eyebrow={t('public.home.classes.eyebrow')}
        eyebrowTone="primary"
        title={t('public.home.classes.title')}
        linkTo={ROUTES.weekendClasses}
        linkLabel={t('public.home.classes.viewAll')}
      />
      <div className="mt-8">
        {classes.status === 'error' ? (
          <LoadError
            title={t('public.classes.loadError')}
            error={classes.error}
            onRetry={classes.reload}
          />
        ) : !classes.data ? (
          <CardGridSkeleton count={3} className={grid} />
        ) : classes.data.length === 0 ? (
          <EmptyState title={t('public.classes.none.title')} body={t('public.classes.none.body')} />
        ) : (
          <div className={grid}>
            {classes.data.map((cls) => (
              <ClassCard key={cls.id} cls={cls} onBook={onBook} onDetails={onDetails} />
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

export function LatestKitsSection({
  kits,
  onAdd,
  onDetails,
}: {
  kits: AsyncState<PlayKit[]>
  onAdd: (kit: PlayKit) => void
  onDetails: (kit: PlayKit) => void
}) {
  const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
  return (
    <section
      aria-labelledby="kits-heading"
      aria-busy={kits.status === 'loading' || undefined}
      className="bg-primary-soft/50 py-20"
    >
      <Container>
        <HeaderRow
          id="kits-heading"
          eyebrow={t('public.home.kits.eyebrow')}
          eyebrowTone="accent"
          title={t('public.home.kits.title')}
          linkTo={ROUTES.playKits}
          linkLabel={t('public.home.kits.viewAll')}
        />
        <div className="mt-8">
          {kits.status === 'error' ? (
            <LoadError
              title={t('public.kits.loadError')}
              error={kits.error}
              onRetry={kits.reload}
            />
          ) : !kits.data ? (
            <CardGridSkeleton count={4} className={grid} itemClassName="h-80" />
          ) : kits.data.length === 0 ? (
            <EmptyState title={t('public.kits.none.title')} body={t('public.kits.none.body')} />
          ) : (
            <div className={grid}>
              {kits.data.map((kit) => (
                <KitCard key={kit.id} kit={kit} onAdd={onAdd} onDetails={onDetails} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}

export function JoinBand({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <Section aria-labelledby="join-heading">
      <Card
        variant="feature"
        padding="feature"
        className="lg:flex lg:items-center lg:justify-between lg:gap-10"
      >
        <div className="max-w-2xl">
          <p className="text-overline uppercase text-ink-inverse/80">
            {t('public.home.band.eyebrow')}
          </p>
          <h2 id="join-heading" className="mt-2 text-h2">
            {t('public.home.band.title')}
          </h2>
          <p className="mt-3 text-body text-ink-inverse/80">{t('public.home.band.body')}</p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 lg:mt-0 lg:shrink-0">
          {!isSignedIn && (
            <Button asChild variant="secondary" size="lg">
              <Link to={ROUTES.register}>{t('public.home.band.register')}</Link>
            </Button>
          )}
          <Link
            to={ROUTES.weekendClasses}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-xl px-1 font-semibold text-ink-inverse underline-offset-4 hover:underline',
              FOCUS,
            )}
          >
            {t('public.home.band.classes')}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </Card>
    </Section>
  )
}
