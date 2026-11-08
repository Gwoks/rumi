/**
 * `/our-approach` Pendekatan Kami (CMS `our-approach`, PRD §5.7): the intro,
 * the five Montessori domains as interactive tabs (domain icon + tone from
 * lib/domains), and the Islamic values as numbered infographic cards with the
 * Arabic word rendered `lang="ar" dir="rtl"`.
 */
import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { DomainsBody, ValuesBody } from '@/api/schemas'
import { CardGridSkeleton, LoadError } from '@/components/rumi/async-states'
import { cmsBody, CmsIcon, ProseBlock } from '@/components/rumi/cms-section'
import { Container, PageHeader, Section, SectionHeading } from '@/components/rumi/section'
import { Button } from '@/components/ui/button'
import { Card, IconChip } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { domainMeta, TONE_SOFT, TONE_SOLID } from '@/lib/domains'
import { ROUTES } from '@/lib/navigation'
import { useAsync } from '@/lib/use-async'

function DomainTabs({ body }: { body: DomainsBody }) {
  const first = body.items[0]?.domain
  return (
    <Section tone="surface" aria-labelledby="domains-heading">
      <SectionHeading
        id="domains-heading"
        eyebrow={body.eyebrow}
        eyebrowTone="primary"
        title={body.heading}
        intro={body.intro}
      />
      <Tabs defaultValue={first} className="mt-10">
        <TabsList aria-label={t('public.ourApproach.domains.tabsLabel')}>
          {body.items.map((item) => (
            <TabsTrigger key={item.domain} value={item.domain}>
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {body.items.map((item) => {
          const meta = domainMeta(item.domain)
          const Icon = meta.icon
          return (
            <TabsContent key={item.domain} value={item.domain}>
              <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                <Card variant="tint" tone={meta.tone} padding="feature">
                  <IconChip tone={meta.tone} className="bg-surface">
                    <Icon size={20} />
                  </IconChip>
                  <h3 className="mt-6 text-h3 text-ink">{item.title}</h3>
                  <p className="mt-3 text-body text-ink-secondary">{item.summary}</p>
                </Card>
                <Card padding="feature">
                  <h4 className="text-overline uppercase text-accent-strong">
                    {t('public.ourApproach.domains.activities')}
                  </h4>
                  <ul className="mt-4 space-y-3">
                    {item.activities.map((activity) => (
                      <li key={activity} className="flex items-start gap-3 text-body-sm text-ink">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full',
                            TONE_SOFT[meta.tone],
                          )}
                        >
                          <Check size={14} />
                        </span>
                        {activity}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </Section>
  )
}

const VALUE_TONES = ['teal', 'orange', 'yellow'] as const

function ValuesInfographic({ body }: { body: ValuesBody }) {
  return (
    <Section aria-labelledby="values-heading">
      <SectionHeading
        id="values-heading"
        eyebrow={body.eyebrow}
        title={body.heading}
        intro={body.intro}
      />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {body.items.map((item, index) => {
          const tone = VALUE_TONES[index % VALUE_TONES.length]
          return (
            <Card key={item.title} asChild className="relative overflow-hidden">
              <li>
                <span
                  aria-hidden="true"
                  className={cn('absolute inset-x-0 top-0 h-1.5', TONE_SOLID[tone])}
                />
                <div className="flex items-center justify-between gap-3">
                  <IconChip tone={tone}>
                    <CmsIcon name={item.icon} />
                  </IconChip>
                  <span className="text-overline uppercase text-ink-tertiary">
                    {t('public.ourApproach.values.number', { n: index + 1 })}
                  </span>
                </div>
                <h3 className="mt-5 text-h4 text-ink">{item.title}</h3>
                {item.arabic && (
                  <p lang="ar" dir="rtl" className="mt-1 text-h3 text-primary-strong">
                    {item.arabic}
                  </p>
                )}
                <p className="mt-3 text-body-sm text-ink-secondary">{item.text}</p>
              </li>
            </Card>
          )
        })}
      </ol>
    </Section>
  )
}

function VisitCta() {
  return (
    <Section className="pt-0">
      <Card
        variant="feature"
        padding="feature"
        className="sm:flex sm:items-center sm:justify-between sm:gap-8"
      >
        <div>
          <h2 className="text-h3">{t('public.ourApproach.cta.title')}</h2>
          <p className="mt-2 text-body text-ink-inverse/80">{t('public.ourApproach.cta.body')}</p>
        </div>
        <Button asChild variant="secondary" size="lg" className="mt-5 shrink-0 sm:mt-0">
          <Link to={ROUTES.weekendClasses}>
            {t('public.ourApproach.cta.button')}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </Button>
      </Card>
    </Section>
  )
}

export function OurApproachScreen() {
  const page = useAsync(() => api.getCmsPage('our-approach'), [])
  const intro = cmsBody(page.data, 'our-approach', 'intro')
  const domains = cmsBody(page.data, 'our-approach', 'domains')
  const values = cmsBody(page.data, 'our-approach', 'values')
  const hasContent = Boolean(intro || domains || values)

  return (
    <>
      <PageHeader
        eyebrow={t('public.ourApproach.eyebrow')}
        title={t('public.ourApproach.title')}
        intro={t('public.ourApproach.intro')}
      />
      {page.status === 'error' ? (
        <Container className="pb-20">
          <LoadError title={t('public.cms.loadError')} error={page.error} onRetry={page.reload} />
        </Container>
      ) : !page.data ? (
        <Container className="pb-20" aria-busy="true">
          <CardGridSkeleton count={3} className="sm:grid-cols-3" />
        </Container>
      ) : !hasContent ? (
        <Container className="pb-20">
          <EmptyState title={t('public.cms.empty.title')} body={t('public.cms.empty.body')} />
        </Container>
      ) : (
        <>
          {intro && (
            <Section aria-labelledby="approach-intro-heading" className="pt-0">
              <ProseBlock id="approach-intro-heading" body={intro.body} />
            </Section>
          )}
          {domains && <DomainTabs body={domains.body} />}
          {values && <ValuesInfographic body={values.body} />}
        </>
      )}
      <VisitCta />
    </>
  )
}
