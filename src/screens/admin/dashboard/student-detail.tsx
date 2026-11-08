/**
 * Student profile dialog (GET /api/admin/students/{id} → StudentDetail):
 * child info, parent contact (mailto + wa.me), attendance with ATTENDED /
 * ABSENT marking (PATCH /api/admin/enrollments/{id}, PRD §5.9.5 — only for
 * CONFIRMED/ATTENDED/ABSENT on or after the class date), latest levels, the
 * assessment history and the assessment logger.
 */
import { Mail, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import type { Enrollment, StudentDetail } from '@/api/schemas'
import { DomainChart, levelLabel } from '@/components/rumi/domain-chart'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { EnrollmentStatusBadge } from '@/components/rumi/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { domainMeta } from '@/lib/domains'
import { formatDate, formatDateLong, todayWib } from '@/lib/format'
import { useAsync } from '@/lib/use-async'
import { AssessmentForm } from './assessment-form'

type Mark = 'ATTENDED' | 'ABSENT'

const MARKABLE: ReadonlySet<Enrollment['status']> = new Set(['CONFIRMED', 'ATTENDED', 'ABSENT'])

function markHint(e: Enrollment, today: string): string | null {
  if (e.status === 'RESERVED') return t('admin.student.waitingPayment')
  if (!MARKABLE.has(e.status)) return t('admin.student.notMarkable')
  if (e.class_date > today) return t('admin.student.afterClassDate')
  return null
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-h4 text-ink">{children}</h3>
}

function Profile({ detail }: { detail: StudentDetail }) {
  const { child, parent } = detail
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl bg-highlight-soft p-4">
        <p className="text-body-sm font-semibold text-ink">
          {t('admin.student.summary', { age: child.age_years, dob: formatDateLong(child.dob) })}
        </p>
        {child.notes && (
          <p className="mt-2 text-body-sm text-ink-secondary">
            {t('admin.student.notes', { notes: child.notes })}
          </p>
        )}
      </div>
      <div className="rounded-xl bg-primary-soft p-4">
        <p className="text-caption text-ink-secondary">{t('admin.student.parentTitle')}</p>
        <p className="mt-1 font-semibold text-ink">{parent.full_name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <a href={`mailto:${parent.email}`}>
              <Mail aria-hidden="true" size={15} />
              {parent.email}
            </a>
          </Button>
          <Button asChild variant="accent" size="sm">
            <a
              href={`https://wa.me/${encodeURIComponent(parent.phone_wa)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('admin.student.whatsappAria', { name: parent.full_name })}
            >
              <MessageCircle aria-hidden="true" size={15} />
              {t('admin.student.whatsapp')}
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

interface AttendanceProps {
  detail: StudentDetail
  onChanged: () => void
}

function Attendance({ detail, onChanged }: AttendanceProps) {
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)
  const today = todayWib()
  const { attendance } = detail

  const mark = async (e: Enrollment, status: Mark) => {
    setBusyId(e.id)
    try {
      await api.adminUpdateEnrollment(e.id, { status })
      toast(t('admin.student.attendanceSaved', { name: e.child_name, class: e.class_title }))
      onChanged()
    } catch (err) {
      toast(apiErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <SubHeading>{t('admin.student.attendanceTitle')}</SubHeading>
      <p className="text-body-sm text-ink-secondary">
        {t('admin.student.attendanceSummary', {
          attended: attendance.attended,
          absent: attendance.absent,
          upcoming: attendance.upcoming,
        })}
      </p>
      {attendance.attendance_rate_pct !== null && (
        <p className="text-body-sm font-semibold text-primary-strong">
          {t('admin.student.attendanceRate', { pct: attendance.attendance_rate_pct })}
        </p>
      )}
      {detail.enrollments.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">{t('admin.student.enrollmentsEmpty')}</p>
      ) : (
        <Table
          className="min-w-[520px]"
          caption={t('admin.student.enrollmentsCaption', { name: detail.child.name })}
        >
          <TableHead>
            <tr>
              <TableHeaderCell>{t('admin.student.col.class')}</TableHeaderCell>
              <TableHeaderCell>{t('admin.student.col.status')}</TableHeaderCell>
              <TableHeaderCell>{t('admin.student.col.mark')}</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {detail.enrollments.map((e) => {
              const hint = markHint(e, today)
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <span className="block font-semibold">{e.class_title}</span>
                    <span className="block text-caption text-ink-secondary">
                      {formatDateLong(e.class_date)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <EnrollmentStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell>
                    {hint ? (
                      <span className="text-caption text-ink-tertiary">{hint}</span>
                    ) : (
                      <span className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={e.status === 'ATTENDED' ? 'primary' : 'secondary'}
                          aria-pressed={e.status === 'ATTENDED'}
                          aria-label={t('admin.student.markAttendedAria', { class: e.class_title })}
                          disabled={busyId !== null}
                          loading={busyId === e.id}
                          onClick={() => void mark(e, 'ATTENDED')}
                        >
                          {t('admin.student.markAttended')}
                        </Button>
                        <Button
                          size="sm"
                          variant={e.status === 'ABSENT' ? 'primary' : 'secondary'}
                          aria-pressed={e.status === 'ABSENT'}
                          aria-label={t('admin.student.markAbsentAria', { class: e.class_title })}
                          disabled={busyId !== null}
                          onClick={() => void mark(e, 'ABSENT')}
                        >
                          {t('admin.student.markAbsent')}
                        </Button>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function History({ detail }: { detail: StudentDetail }) {
  return (
    <section className="space-y-3">
      <SubHeading>{t('admin.student.historyTitle')}</SubHeading>
      {detail.assessments.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">{t('admin.student.historyEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {detail.assessments.map((a) => (
            <li key={a.id} className="rounded-xl border border-border-subtle p-3">
              <p className="text-body-sm font-semibold text-ink">{a.milestone}</p>
              <p className="mt-1 text-caption text-ink-secondary">
                {t('admin.student.historyMeta', {
                  domain: t(domainMeta(a.domain).labelKey),
                  level: levelLabel(a.level),
                  date: formatDate(a.observed_on),
                  assessor: a.assessor_name,
                })}
              </p>
              {a.notes && <p className="mt-2 text-body-sm text-ink-secondary">{a.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DetailBody({ childId, onChanged }: { childId: number; onChanged: () => void }) {
  const detail = useAsync(() => api.adminGetStudent(childId), [childId])
  const data = detail.data?.child.id === childId ? detail.data : null
  const refresh = () => {
    detail.reload()
    onChanged()
  }
  const renderContent = () => {
    if (detail.status === 'error' && !data) {
      return (
        <LoadError
          title={t('admin.student.loadError')}
          error={detail.error}
          onRetry={detail.reload}
        />
      )
    }
    if (!data) return <LoadingBlock label={t('admin.student.loading')} />
    return (
      <div className="space-y-8">
        <Profile detail={data} />
        <Attendance detail={data} onChanged={refresh} />
        <section className="space-y-4">
          <SubHeading>{t('admin.student.levelsTitle')}</SubHeading>
          <DomainChart levels={data.latest_levels} />
        </section>
        <AssessmentForm detail={data} onSaved={refresh} />
        <History detail={data} />
      </div>
    )
  }
  return (
    <>
      <DialogHeader title={data ? data.child.name : t('admin.student.title')} />
      {renderContent()}
    </>
  )
}

export interface StudentDetailDialogProps {
  childId: number | null
  onOpenChange: (open: boolean) => void
  /** Called after attendance or an assessment changes (refreshes the list). */
  onChanged: () => void
}

export function StudentDetailDialog({
  childId,
  onOpenChange,
  onChanged,
}: StudentDetailDialogProps) {
  return (
    <Dialog open={childId !== null} onOpenChange={onOpenChange}>
      <DialogContent size="wide" aria-describedby={undefined}>
        {childId !== null && <DetailBody childId={childId} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  )
}
