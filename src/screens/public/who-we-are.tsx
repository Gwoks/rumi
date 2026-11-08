/**
 * `/who-we-are` Tentang Kami (CMS `who-we-are`, PRD §5.7): founder message,
 * philosophy, mission and educators. Each known section renders only when
 * present and valid; the page h1 is fixed copy so it never disappears.
 */
import { CheckCircle2 } from 'lucide-react'
import { api } from '@/api/client'
import type { EducatorsBody, FounderMessageBody, MissionBody } from '@/api/schemas'
import { CardGridSkeleton, LoadError } from '@/components/rumi/async-states'
import { cmsBody, ProseBlock } from '@/components/rumi/cms-section'
import { EducatorCard } from '@/components/rumi/educator-card'
import { Container, PageHeader, Section, SectionHeading } from '@/components/rumi/section'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { t } from '@/lib/copy'
import { useAsync } from '@/lib/use-async'

function FounderMessage({ body, imageUrl }: { body: FounderMessageBody; imageUrl: string | null }) {
  return (
    <Section aria-labelledby="founder-heading" className="pt-0">
      <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
        <div>
          <SectionHeading id="founder-heading" eyebrow={body.eyebrow} title={body.heading} />
          {imageUrl && (
            <img
              src={imageUrl}
              alt={t('public.whoWeAre.portraitAlt', { name: body.signature_name })}
              className="mt-8 w-full max-w-sm rounded-2xl object-cover"
              loading="lazy"
            />
          )}
        </div>
        <Card variant="tint" tone="yellow" padding="feature" asChild>
          <figure>
            <blockquote className="space-y-4 text-body text-ink-secondary">
              {body.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </blockquote>
            <figcaption className="mt-6">
              <span className="block font-semibold text-ink">{body.signature_name}</span>
              <span className="mt-1 block text-overline uppercase text-accent-strong">
                {body.signature_role}
              </span>
            </figcaption>
          </figure>
        </Card>
      </div>
    </Section>
  )
}

function Mission({ body }: { body: MissionBody }) {
  return (
    <Section aria-labelledby="mission-heading">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionHeading
            id="mission-heading"
            eyebrow={body.eyebrow}
            eyebrowTone="primary"
            title={body.heading}
          />
          <p className="mt-5 max-w-xl text-body-lg text-ink-secondary">{body.statement}</p>
        </div>
        <ul className="space-y-3">
          {body.points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-body-sm text-ink-secondary"
            >
              <CheckCircle2 aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

function Educators({ body }: { body: EducatorsBody }) {
  return (
    <Section tone="surface" aria-labelledby="educators-heading">
      <SectionHeading
        id="educators-heading"
        eyebrow={body.eyebrow}
        title={body.heading}
        intro={body.intro}
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {body.people.map((person) => (
          <EducatorCard key={person.name} person={person} />
        ))}
      </div>
    </Section>
  )
}

export function WhoWeAreScreen() {
  const page = useAsync(() => api.getCmsPage('who-we-are'), [])
  const founder = cmsBody(page.data, 'who-we-are', 'founder_message')
  const philosophy = cmsBody(page.data, 'who-we-are', 'philosophy')
  const mission = cmsBody(page.data, 'who-we-are', 'mission')
  const educators = cmsBody(page.data, 'who-we-are', 'educators')
  const hasContent = Boolean(founder || philosophy || mission || educators)

  return (
    <>
      <PageHeader
        eyebrow={t('public.whoWeAre.eyebrow')}
        title={t('public.whoWeAre.title')}
        intro={t('public.whoWeAre.intro')}
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
          {founder && <FounderMessage body={founder.body} imageUrl={founder.section.image_url} />}
          {philosophy && (
            <Section tone="surface" aria-labelledby="philosophy-heading">
              <ProseBlock id="philosophy-heading" body={philosophy.body} eyebrowTone="primary" />
            </Section>
          )}
          {mission && <Mission body={mission.body} />}
          {educators && <Educators body={educators.body} />}
        </>
      )}
    </>
  )
}
