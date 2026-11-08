/** /design-kit 06: card family, icon chips, feature/tint panels, domain chips, date tile. */
import { ArrowRight, Clock3, MapPin, Star } from 'lucide-react'
import { Price } from '@/components/rumi/price'
import { SeatBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle, IconChip, InlineNote } from '@/components/ui/card'
import { t } from '@/lib/copy'
import { DOMAINS } from '@/lib/domains'
import { dateTileParts } from '@/lib/format'
import { DemoLabel, KitSection } from './kit-section'

const SAMPLE_DATE = '2026-11-14'

function DateTile({ date }: { date: string }) {
  const parts = dateTileParts(date)
  return (
    <div
      role="img"
      aria-label={parts.label}
      className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-highlight-soft text-center text-ink"
    >
      <span aria-hidden="true">
        <span className="block text-xl font-bold leading-none">{parts.day}</span>
        <span className="text-micro uppercase">{parts.month}</span>
      </span>
    </div>
  )
}

export function CardsSection() {
  return (
    <KitSection
      id="kartu"
      eyebrow={t('designKit.cards.eyebrow')}
      title={t('designKit.cards.title')}
      intro={t('designKit.cards.intro')}
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between">
            <IconChip tone="yellow">
              <Star size={19} fill="currentColor" />
            </IconChip>
            <SeatBadge seatsLeft={9} isFull={false} />
          </div>
          <CardTitle className="mt-6">{t('designKit.card.class.title')}</CardTitle>
          <CardDescription>{t('designKit.card.class.body')}</CardDescription>
        </Card>
        <Card variant="interactive">
          <div className="flex gap-4">
            <DateTile date={SAMPLE_DATE} />
            <div className="min-w-0">
              <CardTitle>{t('designKit.card.interactive.title')}</CardTitle>
              <p className="mt-2 flex items-center gap-1 text-caption text-ink-secondary">
                <MapPin aria-hidden="true" size={13} /> Kemang
              </p>
              <p className="mt-1 flex items-center gap-1 text-caption text-ink-secondary">
                <Clock3 aria-hidden="true" size={13} />{' '}
                {t('common.time.wib', { time: '09:30–11:30' })}
              </p>
              <Price amount={200000} className="mt-3 block text-body font-semibold" />
            </div>
          </div>
          <p className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4 text-body-sm font-semibold text-accent-strong">
            {t('designKit.card.interactive.body')}
            <ArrowRight
              aria-hidden="true"
              size={16}
              className="transition motion-safe:group-hover:translate-x-1"
            />
          </p>
        </Card>
        <Card variant="canvas" padding="standard">
          <CardTitle>{t('designKit.card.canvas.title')}</CardTitle>
          <CardDescription>{t('designKit.card.canvas.body')}</CardDescription>
          <InlineNote className="mt-4">{t('designKit.card.note')}</InlineNote>
        </Card>
        <Card variant="feature" padding="feature" className="md:col-span-2">
          <p className="text-overline uppercase text-ink-inverse/80">
            {t('designKit.card.feature.title')}
          </p>
          <p className="mt-3 text-h3">{t('designKit.card.feature.body')}</p>
          <Button variant="secondary" className="mt-6">
            {t('designKit.card.feature.action')}
          </Button>
        </Card>
        <Card variant="tint" tone="orange" padding="standard">
          <CardTitle>{t('designKit.card.tint.title')}</CardTitle>
          <CardDescription>{t('designKit.card.tint.body')}</CardDescription>
        </Card>
      </div>
      <div className="mt-8">
        <DemoLabel>{t('designKit.card.domains')}</DemoLabel>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DOMAINS.map((domain) => {
            const Icon = domain.icon
            return (
              <li
                key={domain.key}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <IconChip tone={domain.tone}>
                  <Icon size={19} />
                </IconChip>
                <span className="text-body-sm font-semibold text-ink">{t(domain.labelKey)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </KitSection>
  )
}
