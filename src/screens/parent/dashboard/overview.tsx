/**
 * "Ringkasan": the latest guide note (teal feature panel), real stats from
 * the ChildReport (attendance rate, sessions attended, domains assessed), the
 * next upcoming class, and quick links (classes, kits, the cart drawer).
 */
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Heart,
  MapPin,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Child, ChildReport } from '@/api/schemas'
import { StatCard } from '@/components/rumi/stat-card'
import { EnrollmentStatusBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { Card, IconChip } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDateLong, todayWib } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'
import { openCart } from '@/stores/ui'
import { useCart } from '@/stores/use-cart'
import { DateTile } from './date-tile'
import { nextUpcomingEnrollment } from './tabs'

interface OverviewProps {
  child: Child
  report: ChildReport
  onNavigate: (tab: string) => void
}

function NoteCard({ child, report, onNavigate }: OverviewProps) {
  const latest = report.assessments.find((a) => a.notes) ?? report.assessments[0]
  return (
    <Card variant="feature" padding="feature">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-body-sm font-normal text-ink-inverse/80">
            {t('parent.overview.noteEyebrow')}
          </h3>
          {latest ? (
            <figure>
              <blockquote className="mt-2 max-w-lg text-2xl font-semibold leading-tight">
                {t('parent.overview.noteQuote', { text: latest.notes ?? latest.milestone })}
              </blockquote>
              <figcaption className="mt-5 text-body-sm text-ink-inverse/80">
                {t('parent.overview.noteBy', {
                  name: latest.assessor_name,
                  date: formatDateLong(latest.observed_on),
                })}
              </figcaption>
            </figure>
          ) : (
            <p className="mt-2 max-w-lg text-body-lg">
              {t('parent.overview.noteEmpty', { name: child.name })}
            </p>
          )}
        </div>
        <span
          aria-hidden="true"
          className="hidden h-14 w-14 shrink-0 place-items-center rounded-full bg-surface/15 sm:grid"
        >
          <Sparkles />
        </span>
      </div>
      <Button variant="secondary" className="mt-7" onClick={() => onNavigate('progress')}>
        {t('parent.overview.seeProgress')}
        <ArrowRight aria-hidden="true" size={15} />
      </Button>
    </Card>
  )
}

function Stats({ report }: { report: ChildReport }) {
  const { attendance } = report
  const assessed = report.latest_levels.filter((l) => l.level !== null).length
  const rate = attendance.attendance_rate_pct
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label={t('parent.overview.stat.attendance')}
        value={rate === null ? t('parent.stat.empty') : t('parent.stat.percent', { n: rate })}
        icon={CalendarDays}
        footnote={
          rate === null
            ? t('parent.overview.stat.attendanceEmpty')
            : t('parent.overview.stat.attendanceNote', {
                attended: attendance.attended,
                absent: attendance.absent,
              })
        }
      />
      <StatCard
        label={t('parent.overview.stat.sessions')}
        value={attendance.attended}
        icon={Heart}
        tone="orange"
        footnote={t('parent.overview.stat.sessionsNote', { n: attendance.upcoming })}
      />
      <StatCard
        label={t('parent.overview.stat.domains')}
        value={t('parent.overview.stat.domainsValue', { n: assessed })}
        icon={Sparkles}
        tone="yellow"
        footnote={t('parent.overview.stat.domainsNote')}
      />
    </div>
  )
}

function NextClassCard({ child, report, onNavigate }: OverviewProps) {
  const next = nextUpcomingEnrollment(report.enrollments, todayWib())
  return (
    <Card padding="standard" className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-h4 text-ink">{t('parent.overview.nextClass')}</h3>
        {next && <EnrollmentStatusBadge status={next.status} />}
      </div>
      {next ? (
        <div className="mt-6 flex gap-4">
          <DateTile date={next.class_date} />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{next.class_title}</p>
            <p className="mt-1 text-body-sm text-ink-secondary">
              {t('common.time.wib', { time: next.class_time_slot })}
            </p>
            <p className="mt-1 flex items-center gap-1 text-body-sm text-ink-secondary">
              <MapPin aria-hidden="true" size={14} className="shrink-0" />
              {next.class_location}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-body-sm text-ink-secondary">
            {t('parent.overview.nextClassEmpty', { name: child.name })}
          </p>
          <Button asChild variant="link" className="mt-3">
            <Link to={ROUTES.weekendClasses}>
              {t('parent.overview.findClass')}
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </Button>
        </div>
      )}
      <Button
        variant="link"
        className="mt-auto self-start pt-6"
        onClick={() => onNavigate('attendance')}
      >
        {t('parent.overview.viewAttendance')}
        <ArrowRight aria-hidden="true" size={14} />
      </Button>
    </Card>
  )
}

const TILE = cn(
  'group flex w-full items-start gap-4 rounded-2xl border border-border bg-surface p-5 text-left transition duration-base hover:border-primary/40 hover:shadow-card motion-safe:hover:-translate-y-1',
  FOCUS,
)

function TileBody({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <>
      <IconChip>
        <Icon size={18} />
      </IconChip>
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-body-sm text-ink-secondary">{body}</span>
      </span>
    </>
  )
}

function QuickLinks() {
  const { itemCount } = useCart()
  return (
    <section aria-labelledby="quick-links" className="xl:col-span-2">
      <h3 id="quick-links" className="text-h4 text-ink">
        {t('parent.overview.quickTitle')}
      </h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Link to={ROUTES.weekendClasses} className={TILE}>
          <TileBody
            icon={CalendarCheck}
            title={t('parent.overview.quick.classes')}
            body={t('parent.overview.quick.classesBody')}
          />
        </Link>
        <Link to={ROUTES.playKits} className={TILE}>
          <TileBody
            icon={BookOpen}
            title={t('parent.overview.quick.kits')}
            body={t('parent.overview.quick.kitsBody')}
          />
        </Link>
        <button type="button" onClick={openCart} className={TILE}>
          <TileBody
            icon={ShoppingBag}
            title={t('parent.overview.quick.cart')}
            body={t('parent.overview.quick.cartBody', { count: itemCount })}
          />
        </button>
      </div>
    </section>
  )
}

export function OverviewSection({ child, report, onNavigate }: OverviewProps) {
  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <NoteCard child={child} report={report} onNavigate={onNavigate} />
      <NextClassCard child={child} report={report} onNavigate={onNavigate} />
      <div className="xl:col-span-2">
        <Stats report={report} />
      </div>
      <QuickLinks />
    </div>
  )
}
