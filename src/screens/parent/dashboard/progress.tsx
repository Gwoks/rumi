/**
 * "Perkembangan": the learning map (DomainChart of the latest level per
 * domain), recent milestones, and a per-domain trend line built from the
 * assessment history. Empty state until the first assessment.
 */
import { Check, Sprout } from 'lucide-react'
import type { Child, ChildReport } from '@/api/schemas'
import { DomainChart, DomainTrend, levelLabel } from '@/components/rumi/domain-chart'
import { Card, InlineNote } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { t } from '@/lib/copy'
import { DOMAINS, domainMeta } from '@/lib/domains'
import { formatDate } from '@/lib/format'

const MILESTONE_LIMIT = 5

export function ProgressSection({ child, report }: { child: Child; report: ChildReport }) {
  if (report.assessments.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={Sprout}
        title={t('parent.progress.emptyTitle')}
        body={t('parent.progress.emptyBody', { name: child.name })}
      />
    )
  }
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <Card padding="standard">
        <h3 className="text-h4 text-ink">{t('parent.progress.mapTitle', { name: child.name })}</h3>
        <p className="mt-1 text-body-sm text-ink-secondary">{t('parent.progress.mapBody')}</p>
        <DomainChart levels={report.latest_levels} showMilestones className="mt-8" />
      </Card>
      <Card padding="standard">
        <h3 className="text-h4 text-ink">{t('parent.progress.milestonesTitle')}</h3>
        <ul className="mt-6 space-y-5">
          {report.assessments.slice(0, MILESTONE_LIMIT).map((a) => (
            <li key={a.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-strong"
              >
                <Check size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink">{a.milestone}</p>
                <p className="mt-1 text-caption text-ink-secondary">
                  {t('parent.progress.milestoneMeta', {
                    domain: t(domainMeta(a.domain).labelKey),
                    level: levelLabel(a.level),
                    date: formatDate(a.observed_on),
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <InlineNote className="mt-8">{t('parent.progress.reminder')}</InlineNote>
      </Card>
      <Card padding="standard" className="lg:col-span-2">
        <h3 className="text-h4 text-ink">{t('parent.progress.trendTitle')}</h3>
        <p className="mt-1 text-body-sm text-ink-secondary">{t('parent.progress.trendBody')}</p>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {DOMAINS.map((d) => (
            <DomainTrend key={d.key} domain={d.key} assessments={report.assessments} />
          ))}
        </div>
      </Card>
    </div>
  )
}
