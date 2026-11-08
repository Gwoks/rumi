/**
 * "Siswa": the student directory (GET /api/admin/students, Paginated, `q`
 * matches child name, parent name or email). "Lihat" opens the profile
 * dialog: parent contact, attendance marking and the assessment logger.
 */
import { Users } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import { Pagination } from '@/components/admin/pagination'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, SearchInput } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowAction,
} from '@/components/ui/table'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDate, initials } from '@/lib/format'
import { useAsync } from '@/lib/use-async'
import { StudentDetailDialog } from './student-detail'
import { PER_PAGE, useListQuery } from './use-list-query'

export function StudentDirectory() {
  const query = useListQuery()
  const students = useAsync(
    () => api.adminListStudents({ q: query.q || undefined, page: query.page, per_page: PER_PAGE }),
    [query.q, query.page],
  )
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const data = students.data

  const renderBody = () => {
    if (students.status === 'error' && !data) {
      return (
        <LoadError
          title={t('admin.students.loadError')}
          error={students.error}
          onRetry={students.reload}
        />
      )
    }
    if (!data) return <LoadingBlock label={t('admin.students.loading')} />
    if (data.items.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title={t('admin.students.emptyTitle')}
          body={t(query.q ? 'admin.students.emptySearchBody' : 'admin.students.emptyBody')}
        />
      )
    }
    return (
      <Table caption={t('admin.students.caption')}>
        <TableHead>
          <tr>
            <TableHeaderCell>{t('admin.students.col.student')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.students.col.parent')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.students.col.active')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.students.col.attendance')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.students.col.lastAssessment')}</TableHeaderCell>
            <TableHeaderCell className="text-right">{t('admin.resource.actions')}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {data.items.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-highlight-soft text-xs font-bold"
                  >
                    {initials(s.name)}
                  </span>
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-caption text-ink-secondary">
                      {t('admin.students.age', { n: s.age_years })}
                    </span>
                  </span>
                </span>
              </TableCell>
              <TableCell>
                <span className="block">{s.parent_name}</span>
                <span className="block text-caption text-ink-secondary">{s.parent_email}</span>
              </TableCell>
              <TableCell className="tabular-nums">{s.active_enrollments}</TableCell>
              <TableCell className="font-semibold tabular-nums text-primary-strong">
                {s.attendance.attendance_rate_pct === null
                  ? t('admin.empty')
                  : t('parent.stat.percent', { n: s.attendance.attendance_rate_pct })}
              </TableCell>
              <TableCell className="text-ink-secondary">
                {s.latest_assessment_on ? formatDate(s.latest_assessment_on) : t('admin.empty')}
              </TableCell>
              <TableCell className="text-right">
                <TableRowAction
                  aria-label={t('admin.students.viewAria', { name: s.name })}
                  onClick={() => setSelectedId(s.id)}
                >
                  {t('admin.students.view')}
                </TableRowAction>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <section aria-labelledby="students-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="students-title" className="text-h2 text-ink">
            {t('admin.students.title')}
          </h2>
          <p className="mt-2 text-body-sm text-ink-secondary">
            {data
              ? t('admin.students.total', { n: data.meta.total })
              : t('admin.students.description')}
          </p>
        </div>
        <Field label={t('admin.students.search')} className="w-full sm:w-80">
          {(control) => (
            <SearchInput
              {...control}
              value={query.search}
              placeholder={t('admin.students.searchPlaceholder')}
              onChange={(e) => query.setSearch(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Card
        padding="standard"
        className={cn('mt-6', students.status === 'loading' && data && 'opacity-70')}
        aria-busy={students.status === 'loading' || undefined}
      >
        {renderBody()}
        {data && (
          <Pagination
            className="mt-6"
            page={data.meta.page}
            perPage={data.meta.per_page}
            total={data.meta.total}
            onPageChange={query.setPage}
            label={t('admin.students.paginationLabel')}
          />
        )}
      </Card>
      <StudentDetailDialog
        childId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={students.reload}
      />
    </section>
  )
}
