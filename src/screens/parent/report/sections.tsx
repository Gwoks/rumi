/**
 * Building blocks of the printable report: titled sections that avoid page
 * breaks, the latest-level table with rubric labels, the rubric legend, the
 * assessment history, the enrollment table and the guide's written notes.
 * Tables drop their horizontal scroll and min width in print.
 */
import type { ChildReport } from '@/api/schemas'
import { levelValueText, orderedLevels } from '@/components/rumi/domain-chart'
import { EnrollmentStatusBadge } from '@/components/rumi/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { t } from '@/lib/copy'
import { domainMeta, LEVELS } from '@/lib/domains'
import { formatDate, formatDateLong } from '@/lib/format'

const PRINT_TABLE = 'print:min-w-0'
const PRINT_WRAPPER = 'print:overflow-visible'

export function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-4">
      <h2 className="text-h3 text-ink">{title}</h2>
      {children}
    </section>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-body-sm text-ink-secondary">{children}</p>
}

export function LevelsTable({ report }: { report: ChildReport }) {
  return (
    <Table
      className={PRINT_TABLE}
      wrapperClassName={PRINT_WRAPPER}
      caption={t('parent.report.levels.caption', { name: report.child.name })}
    >
      <TableHead>
        <tr>
          <TableHeaderCell>{t('parent.report.col.domain')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.level')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.milestone')}</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {orderedLevels(report.latest_levels).map((item) => (
          <TableRow key={item.domain}>
            <TableCell className="font-semibold">{t(domainMeta(item.domain).labelKey)}</TableCell>
            <TableCell>{levelValueText(item.level)}</TableCell>
            <TableCell className="text-ink-secondary">
              {item.milestone ?? t('parent.stat.empty')}
              {item.observed_on && (
                <span className="block text-caption">{formatDate(item.observed_on)}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function RubricLegend() {
  return (
    <div className="rounded-xl bg-highlight-soft p-4 print:border print:border-border">
      <h3 className="text-body-sm font-semibold text-ink">{t('parent.report.rubric.title')}</h3>
      <dl className="mt-2 grid gap-2 text-body-sm sm:grid-cols-2">
        {LEVELS.map(({ level, labelKey }) => (
          <div key={level}>
            <dt className="font-semibold text-ink">
              {t('parent.report.rubric.item', { level, label: t(labelKey) })}
            </dt>
            <dd className="text-ink-secondary">{t(`parent.report.rubric.${level}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function AssessmentHistoryTable({ report }: { report: ChildReport }) {
  if (report.assessments.length === 0) {
    return <EmptyLine>{t('parent.report.history.empty')}</EmptyLine>
  }
  return (
    <Table
      className={PRINT_TABLE}
      wrapperClassName={PRINT_WRAPPER}
      caption={t('parent.report.history.caption', { name: report.child.name })}
    >
      <TableHead>
        <tr>
          <TableHeaderCell>{t('parent.report.col.date')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.domain')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.level')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.milestone')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.assessor')}</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {report.assessments.map((a) => (
          <TableRow key={a.id} className="break-inside-avoid">
            <TableCell className="whitespace-nowrap text-ink-secondary">
              {formatDate(a.observed_on)}
            </TableCell>
            <TableCell>{t(domainMeta(a.domain).labelKey)}</TableCell>
            <TableCell>{levelValueText(a.level)}</TableCell>
            <TableCell>
              {a.milestone}
              {a.class_title && (
                <span className="block text-caption text-ink-secondary">{a.class_title}</span>
              )}
            </TableCell>
            <TableCell className="text-ink-secondary">{a.assessor_name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function EnrollmentTable({ report }: { report: ChildReport }) {
  if (report.enrollments.length === 0) {
    return <EmptyLine>{t('parent.report.attendance.empty')}</EmptyLine>
  }
  return (
    <Table
      className={PRINT_TABLE}
      wrapperClassName={PRINT_WRAPPER}
      caption={t('parent.report.attendance.caption', { name: report.child.name })}
    >
      <TableHead>
        <tr>
          <TableHeaderCell>{t('parent.report.col.class')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.date')}</TableHeaderCell>
          <TableHeaderCell>{t('parent.report.col.status')}</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {report.enrollments.map((e) => (
          <TableRow key={e.id} className="break-inside-avoid">
            <TableCell className="font-semibold">
              {e.class_title}
              <span className="block text-caption font-normal text-ink-secondary">
                {e.class_location}
              </span>
            </TableCell>
            <TableCell className="text-ink-secondary">
              {formatDateLong(e.class_date)}
              <span className="block text-caption">
                {t('common.time.wib', { time: e.class_time_slot })}
              </span>
            </TableCell>
            <TableCell>
              <EnrollmentStatusBadge status={e.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function GuideNotes({ report }: { report: ChildReport }) {
  const notes = report.assessments.filter((a) => a.notes)
  if (notes.length === 0) return <EmptyLine>{t('parent.report.notes.empty')}</EmptyLine>
  return (
    <ul className="space-y-3">
      {notes.map((a) => (
        <li
          key={a.id}
          className="break-inside-avoid rounded-xl bg-primary-soft p-4 print:border print:border-border"
        >
          <p className="text-body-sm text-ink">{a.notes}</p>
          <p className="mt-2 text-caption text-ink-secondary">
            {t('parent.report.notes.by', {
              name: a.assessor_name,
              date: formatDateLong(a.observed_on),
            })}
          </p>
        </li>
      ))}
    </ul>
  )
}
