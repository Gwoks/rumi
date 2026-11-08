/** /design-kit 08: tabs, segmented control and the stepper. */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Stepper } from '@/components/ui/stepper'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t } from '@/lib/copy'
import { DemoLabel, KitSection } from './kit-section'

const TABS = [
  { value: 'overview', label: t('designKit.tabs.overview') },
  { value: 'attendance', label: t('designKit.tabs.attendance') },
  { value: 'progress', label: t('designKit.tabs.progress') },
] as const

type Range = 'week' | 'month' | 'all'
const RANGES = [
  { value: 'week', label: t('designKit.segmented.week') },
  { value: 'month', label: t('designKit.segmented.month') },
  { value: 'all', label: t('designKit.segmented.all') },
] as const

const STEPS = [
  t('designKit.stepper.summary'),
  t('designKit.stepper.detail'),
  t('designKit.stepper.confirm'),
]

export function NavigationSection() {
  const [range, setRange] = useState<Range>('week')
  const [step, setStep] = useState(1)

  return (
    <KitSection
      id="navigasi"
      eyebrow={t('designKit.navigation.eyebrow')}
      title={t('designKit.navigation.title')}
      intro={t('designKit.navigation.intro')}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="standard" className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList aria-label={t('designKit.tabs.label')}>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="text-body-sm text-ink-secondary"
              >
                {t('designKit.tabs.panel', { tab: tab.label })}
              </TabsContent>
            ))}
          </Tabs>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.segmented.label')}</DemoLabel>
          <Segmented<Range>
            options={RANGES}
            value={range}
            onChange={setRange}
            aria-label={t('designKit.segmented.label')}
          />
        </Card>
        <Card padding="standard">
          <Stepper steps={STEPS} current={step} />
          <div className="mt-6 flex justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              {t('designKit.stepper.prev')}
            </Button>
            <Button
              size="sm"
              disabled={step === STEPS.length - 1}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              {t('designKit.stepper.next')}
            </Button>
          </div>
        </Card>
      </div>
    </KitSection>
  )
}
