/**
 * "Kehadiran": the attendance summary (AttendanceSummary) and every class
 * enrollment of the selected child with its status badge.
 */
import { CalendarCheck } from 'lucide-react'
import type { AttendanceSummary, Child, ChildReport } from '@/api/schemas'
import { EnrollmentStatusBadge } from '@/components/rumi/status-badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { t } from '@/lib/copy'
import { formatDateLong } from '@/lib/format'

export function AttendanceSummaryList({ attendance }: { attendance: AttendanceSummary }) {
  const rate = attendance.attendance_rate_pct
  const items = [
    { label: t('parent.attendance.summary.attended'), value: String(attendance.attended) },
    { label: t('parent.attendance.summary.absent'), value: String(attendance.absent) },
    { label: t('parent.attendance.summary.upcoming'), value: String(attendance.upcoming) },
    {
      label: t('parent.attendance.summary.rate'),
      value: rate === null ? t('parent.stat.empty') : t('parent.stat.percent', { n: rate }),
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-primary-soft p-4">
          <dt className="text-caption text-ink-secondary">{item.label}</dt>
          <dd className="mt-1 text-h3 tabular-nums text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AttendanceSection({ child, report }: { child: Child; report: ChildReport }) {
  return (
    <Card padding="standard" className="mt-8">
      <h3 className="text-h4 text-ink">{t('parent.attendance.title')}</h3>
      <p className="mt-1 text-body-sm text-ink-secondary">
        {t('parent.attendance.description', { name: child.name })}
      </p>
      <div className="mt-6">
        <AttendanceSummaryList attendance={report.attendance} />
      </div>
      {report.enrollments.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={CalendarCheck}
          headingLevel="h4"
          title={t('parent.attendance.emptyTitle')}
          body={t('parent.attendance.emptyBody', { name: child.name })}
        />
      ) : (
        <Table
          wrapperClassName="mt-6"
          caption={t('parent.attendance.caption', { name: child.name })}
        >
          <TableHead>
            <tr>
              <TableHeaderCell>{t('parent.attendance.col.class')}</TableHeaderCell>
              <TableHeaderCell>{t('parent.attendance.col.date')}</TableHeaderCell>
              <TableHeaderCell>{t('parent.attendance.col.location')}</TableHeaderCell>
              <TableHeaderCell>{t('parent.attendance.col.order')}</TableHeaderCell>
              <TableHeaderCell>{t('parent.attendance.col.status')}</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {report.enrollments.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-semibold">{e.class_title}</TableCell>
                <TableCell className="text-ink-secondary">
                  {formatDateLong(e.class_date)}
                  <span className="block text-caption">
                    {t('common.time.wib', { time: e.class_time_slot })}
                  </span>
                </TableCell>
                <TableCell className="text-ink-secondary">{e.class_location}</TableCell>
                <TableCell className="text-ink-secondary">
                  {e.order_code ?? t('parent.stat.empty')}
                </TableCell>
                <TableCell>
                  <EnrollmentStatusBadge status={e.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
