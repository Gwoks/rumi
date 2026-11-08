/**
 * ClassCard (DESIGN.md "ClassCard", the template ScheduleCard) plus the date
 * tile and the bookability rule shared by the class detail dialog and the
 * quick-booking panel. A class is bookable only while it is OPEN, upcoming
 * (start in WIB is in the future) and has seats left (PRD §5.9.1, §6.12).
 */
import { ArrowRight, Clock3, MapPin, Users } from 'lucide-react'
import type { WeekendClass } from '@/api/schemas'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { dateTileParts } from '@/lib/format'
import { FOCUS } from '@/lib/styles'
import { Price } from './price'
import { SeatBadge } from './status-badge'

export type ClassAvailability = 'bookable' | 'full' | 'closed'

type AvailabilityFields = Pick<WeekendClass, 'status' | 'is_upcoming' | 'is_full' | 'seats_left'>

export function classAvailability(cls: AvailabilityFields): ClassAvailability {
  if (cls.status !== 'OPEN' || !cls.is_upcoming) return 'closed'
  if (cls.is_full || cls.seats_left <= 0) return 'full'
  return 'bookable'
}

/** Footer / dialog label for a class that cannot be booked. */
export function unavailableLabel(availability: ClassAvailability): string {
  return availability === 'full' ? t('public.classCard.full') : t('public.classCard.closed')
}

export function ClassAvailabilityBadge({ cls }: { cls: WeekendClass }) {
  if (classAvailability(cls) === 'closed') {
    return <Badge variant="neutral">{t('public.classCard.closed')}</Badge>
  }
  return <SeatBadge seatsLeft={cls.seats_left} isFull={cls.is_full} />
}

/** Yellow date tile; the full date is the accessible name (micro text is not enough). */
export function DateTile({ date, className }: { date: string; className?: string }) {
  const parts = dateTileParts(date)
  return (
    <div
      role="img"
      aria-label={parts.label}
      className={cn(
        'grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-highlight-soft text-center text-ink',
        className,
      )}
    >
      <span aria-hidden="true">
        <span className="block text-xl font-bold leading-none">{parts.day}</span>
        <span className="text-micro uppercase">{parts.month}</span>
      </span>
    </div>
  )
}

const META = 'mt-1 flex items-start gap-1.5 text-caption text-ink-secondary'

/** Location, time (WIB) and age rows — shared by the card and the detail dialog. */
export function ClassMeta({ cls, className }: { cls: WeekendClass; className?: string }) {
  return (
    <div className={cn('mt-2', className)}>
      <p className={META}>
        <MapPin aria-hidden="true" size={13} className="mt-0.5 shrink-0" />
        {cls.location}
      </p>
      <p className={META}>
        <Clock3 aria-hidden="true" size={13} className="mt-0.5 shrink-0" />
        {t('common.time.wib', { time: cls.time_slot })}
      </p>
      <p className={META}>
        <Users aria-hidden="true" size={13} className="mt-0.5 shrink-0" />
        {t('common.age.range', { range: cls.age_range })}
      </p>
    </div>
  )
}

export interface ClassCardProps {
  cls: WeekendClass
  onBook: (cls: WeekendClass) => void
  /** Opens the detail dialog; the title becomes a button when set. */
  onDetails?: (cls: WeekendClass) => void
  headingLevel?: 'h2' | 'h3'
  className?: string
}

export function ClassCard({
  cls,
  onBook,
  onDetails,
  headingLevel: Heading = 'h3',
  className,
}: ClassCardProps) {
  const availability = classAvailability(cls)
  const isBookable = availability === 'bookable'
  return (
    <Card variant="interactive" asChild className={cn('flex flex-col justify-between', className)}>
      <article>
        <div className="flex gap-4">
          <DateTile date={cls.date} />
          <div className="min-w-0 flex-1">
            <ClassAvailabilityBadge cls={cls} />
            <Heading className="mt-2 text-h4 text-ink">
              {onDetails ? (
                <button
                  type="button"
                  onClick={() => onDetails(cls)}
                  aria-label={t('public.classCard.details', { title: cls.title })}
                  className={cn('rounded-lg text-left hover:underline', FOCUS)}
                >
                  {cls.title}
                </button>
              ) : (
                cls.title
              )}
            </Heading>
            <ClassMeta cls={cls} />
            <Price amount={cls.fee_idr} className="mt-3 block text-body font-semibold text-ink" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onBook(cls)}
          disabled={!isBookable}
          aria-label={isBookable ? t('public.classCard.bookAria', { title: cls.title }) : undefined}
          className={cn(
            'mt-6 flex min-h-10 w-full items-center justify-between rounded-lg border-t border-border-subtle pt-4 text-body-sm font-semibold text-accent-strong',
            FOCUS,
            'disabled:cursor-not-allowed disabled:text-ink-tertiary',
          )}
        >
          {isBookable ? t('public.classCard.book') : unavailableLabel(availability)}
          {isBookable && (
            <ArrowRight
              aria-hidden="true"
              size={16}
              className="transition motion-safe:group-hover:translate-x-1"
            />
          )}
        </button>
      </article>
    </Card>
  )
}
