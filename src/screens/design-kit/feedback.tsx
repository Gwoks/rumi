/** /design-kit 07: inline alerts, empty state, skeleton, spinner, level bars. */
import { Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Progress } from '@/components/ui/progress'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { AssessmentLevel } from '@/api/schemas'
import { t } from '@/lib/copy'
import { DOMAINS, LEVELS, MAX_LEVEL } from '@/lib/domains'
import { ROUTES } from '@/lib/navigation'
import { DemoLabel, KitSection } from './kit-section'

const SAMPLE_LEVELS: readonly AssessmentLevel[] = [3, 3, 2, 2, 3]

function LevelBars() {
  return (
    <div className="space-y-6">
      {DOMAINS.map((domain, index) => {
        const level = SAMPLE_LEVELS[index]
        const levelLabel = t(LEVELS[level - 1].labelKey)
        const name = t(domain.labelKey)
        return (
          <div key={domain.key}>
            <div className="mb-2 flex justify-between text-body-sm">
              <span className="font-semibold text-ink">{name}</span>
              <span className="text-ink-secondary">
                {levelLabel} ({level}/{MAX_LEVEL})
              </span>
            </div>
            <Progress
              value={level}
              max={MAX_LEVEL}
              tone={domain.tone}
              label={t('designKit.progress.label', {
                domain: name,
                level: levelLabel,
                value: level,
              })}
            />
          </div>
        )
      })}
    </div>
  )
}

export function FeedbackSection() {
  return (
    <KitSection
      id="umpan-balik"
      eyebrow={t('designKit.feedback.eyebrow')}
      title={t('designKit.feedback.title')}
      intro={t('designKit.feedback.intro')}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <InlineAlert variant="info" title={t('designKit.alert.info.title')}>
            {t('designKit.alert.info.body')}
          </InlineAlert>
          <InlineAlert variant="attention" title={t('designKit.alert.attention.title')}>
            {t('designKit.alert.attention.body')}
          </InlineAlert>
          <InlineAlert variant="danger" title={t('designKit.alert.danger.title')}>
            {t('designKit.alert.danger.body')}
          </InlineAlert>
        </div>
        <EmptyState
          icon={Package}
          title={t('designKit.empty.title')}
          body={t('designKit.empty.body')}
          action={
            <Button asChild variant="soft">
              <Link to={ROUTES.playKits}>{t('designKit.empty.action')}</Link>
            </Button>
          }
        />
        <Card padding="standard">
          <DemoLabel>{t('designKit.loading.title')}</DemoLabel>
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0" />
            <SkeletonText className="flex-1" />
          </div>
          <div className="mt-6 flex items-center gap-3 text-primary-strong">
            <Spinner />
            <span className="text-body-sm text-ink-secondary">{t('common.loading')}</span>
          </div>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.progress.title')}</DemoLabel>
          <LevelBars />
        </Card>
      </div>
    </KitSection>
  )
}
