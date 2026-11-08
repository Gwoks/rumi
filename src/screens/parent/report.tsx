/**
 * `/parent/report/:childId` (PRD §4.1): a print-styled development report
 * (GET /api/me/children/{id}/report). "Unduh PDF" calls `window.print()` — no
 * PDF library; the browser's "Save as PDF" does the rest. Print styles use
 * Tailwind `print:` variants only (the toolbar hides, cards lose borders,
 * tables stop scrolling, sections avoid page breaks). Wrapped in
 * <RequireRole role="PARENT"> by router.tsx; a foreign or unknown child is a
 * 404 (PRD §5.3.1) shown as "Laporan tidak ditemukan".
 */
import { ArrowLeft, FileX, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { ChildReport } from '@/api/schemas'
import { DomainChart } from '@/components/rumi/domain-chart'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { Logo } from '@/components/rumi/logo'
import { MAIN_ID, SkipLink } from '@/components/rumi/skip-link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { t } from '@/lib/copy'
import { ageFromDob, formatDateLong, formatDateTime } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { useAsync } from '@/lib/use-async'
import { AttendanceSummaryList } from './dashboard/attendance'
import { CHILD_PARAM } from './dashboard/tabs'
import {
  AssessmentHistoryTable,
  EnrollmentTable,
  GuideNotes,
  LevelsTable,
  ReportSection,
  RubricLegend,
} from './report/sections'

function parseChildId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function dashboardPath(childId: number | null): string {
  return childId === null
    ? ROUTES.parentDashboard
    : `${ROUTES.parentDashboard}?${CHILD_PARAM}=${childId}`
}

function Toolbar({ childId, canPrint }: { childId: number | null; canPrint: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button asChild variant="ghost">
        <Link to={dashboardPath(childId)}>
          <ArrowLeft aria-hidden="true" size={16} />
          {t('parent.report.back')}
        </Link>
      </Button>
      {canPrint && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-caption text-ink-tertiary">{t('parent.report.printHint')}</p>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" size={16} />
            {t('parent.report.print')}
          </Button>
        </div>
      )}
    </div>
  )
}

function ChildInfo({ report }: { report: ChildReport }) {
  const { child } = report
  const age = ageFromDob(child.dob) ?? child.age_years
  const rows = [
    { label: t('parent.report.child.name'), value: child.name },
    { label: t('parent.report.child.age'), value: t('parent.report.child.ageValue', { n: age }) },
    { label: t('parent.report.child.dob'), value: formatDateLong(child.dob) },
    ...(child.notes ? [{ label: t('parent.report.child.notes'), value: child.notes }] : []),
  ]
  return (
    <ReportSection title={t('parent.report.child.title')}>
      <dl className="grid gap-x-8 gap-y-3 text-body-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-ink-tertiary">{row.label}</dt>
            <dd className="font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </ReportSection>
  )
}

function ReportDocument({ report }: { report: ChildReport }) {
  const name = report.child.name
  return (
    <article className="mt-6 space-y-6 rounded-2xl border border-border bg-surface p-6 sm:p-10 print:mt-0 print:space-y-5 print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-col gap-5 border-b border-border-subtle pb-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <div className="sm:text-right">
          <h1 className="text-h2 text-ink">{t('parent.report.heading', { name })}</h1>
          <p className="mt-1 text-caption text-ink-tertiary">
            {t('parent.report.generatedAt', { date: formatDateTime(report.generated_at) })}
          </p>
        </div>
      </header>
      <ChildInfo report={report} />
      <ReportSection title={t('parent.report.levels.title')}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] print:grid-cols-1">
          <DomainChart levels={report.latest_levels} className="print:hidden" />
          <LevelsTable report={report} />
        </div>
        <RubricLegend />
      </ReportSection>
      <ReportSection title={t('parent.report.history.title')}>
        <AssessmentHistoryTable report={report} />
      </ReportSection>
      <ReportSection title={t('parent.report.attendance.title')}>
        <AttendanceSummaryList attendance={report.attendance} />
        <EnrollmentTable report={report} />
      </ReportSection>
      <ReportSection title={t('parent.report.notes.title')}>
        <GuideNotes report={report} />
      </ReportSection>
      <footer className="border-t border-border-subtle pt-5 text-caption text-ink-tertiary">
        {t('parent.report.footer')}
      </footer>
    </article>
  )
}

/** Keeps exactly one h1 on the page while the report itself is not shown. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">{t('parent.report.title')}</h1>
      <div className="mt-6">{children}</div>
    </>
  )
}

function NotFound() {
  return (
    <Placeholder>
      <EmptyState
        icon={FileX}
        headingLevel="h2"
        title={t('parent.report.notFoundTitle')}
        body={t('parent.report.notFoundBody')}
      />
    </Placeholder>
  )
}

function ReportBody({ childId }: { childId: number }) {
  const report = useAsync(() => api.getChildReport(childId), [childId])
  const data = report.data?.child.id === childId ? report.data : null
  const renderContent = () => {
    if (report.status === 'error' && report.error?.code === 'not_found') return <NotFound />
    if (report.status === 'error') {
      return (
        <Placeholder>
          <LoadError
            title={t('parent.report.loadError')}
            error={report.error}
            onRetry={report.reload}
          />
        </Placeholder>
      )
    }
    if (!data) {
      return (
        <Placeholder>
          <LoadingBlock label={t('parent.report.loading')} rows={5} />
        </Placeholder>
      )
    }
    return <ReportDocument report={data} />
  }
  return (
    <>
      <Toolbar childId={childId} canPrint={data !== null && report.status !== 'error'} />
      {renderContent()}
    </>
  )
}

export function ParentReportScreen() {
  const childId = parseChildId(useParams().childId)
  return (
    <div className="min-h-screen bg-canvas text-ink print:bg-surface">
      <SkipLink />
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="mx-auto max-w-4xl px-5 py-8 outline-none lg:py-12 print:max-w-none print:p-0"
      >
        {childId === null ? (
          <>
            <Toolbar childId={null} canPrint={false} />
            <NotFound />
          </>
        ) : (
          <ReportBody childId={childId} />
        )}
      </main>
    </div>
  )
}
