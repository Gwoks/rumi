/** Class detail dialog (home + /weekend-classes): full date, time, place, age,
 * fee, the live seat badge and the "Pesan Kursi" commitment button. */
import type { WeekendClass } from '@/api/schemas'
import {
  ClassAvailabilityBadge,
  classAvailability,
  unavailableLabel,
} from '@/components/rumi/class-card'
import { Price } from '@/components/rumi/price'
import { Button } from '@/components/ui/button'
import { InlineNote } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { t } from '@/lib/copy'
import { formatDateLong } from '@/lib/format'

export interface ClassDetailDialogProps {
  cls: WeekendClass | null
  onClose: () => void
  onBook: (cls: WeekendClass) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-tertiary">{label}</dt>
      <dd className="mt-0.5 text-body-sm font-semibold text-ink">{children}</dd>
    </div>
  )
}

export function ClassDetailDialog({ cls, onClose, onBook }: ClassDetailDialogProps) {
  return (
    <Dialog open={cls !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{cls && <ClassDetail cls={cls} onBook={onBook} />}</DialogContent>
    </Dialog>
  )
}

function ClassDetail({ cls, onBook }: { cls: WeekendClass; onBook: (cls: WeekendClass) => void }) {
  const availability = classAvailability(cls)
  const isBookable = availability === 'bookable'
  return (
    <>
      <DialogHeader title={cls.title} description={cls.description} />
      <ClassAvailabilityBadge cls={cls} />
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Row label={t('public.classDetail.date')}>{formatDateLong(cls.date)}</Row>
        <Row label={t('public.classDetail.time')}>
          {t('common.time.wib', { time: cls.time_slot })}
        </Row>
        <Row label={t('public.classDetail.location')}>{cls.location}</Row>
        <Row label={t('public.classDetail.age')}>
          {t('common.age.range', { range: cls.age_range })}
        </Row>
        <Row label={t('public.classDetail.fee')}>
          <Price amount={cls.fee_idr} />
        </Row>
      </dl>
      <InlineNote className="mt-5">{t('public.classDetail.note')}</InlineNote>
      <DialogFooter>
        <Button
          variant="accent"
          disabled={!isBookable}
          onClick={() => onBook(cls)}
          aria-label={isBookable ? t('public.classCard.bookAria', { title: cls.title }) : undefined}
        >
          {isBookable ? t('public.classCard.book') : unavailableLabel(availability)}
        </Button>
      </DialogFooter>
    </>
  )
}
