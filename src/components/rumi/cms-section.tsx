/**
 * CMS rendering helpers for the public pages (PRD §5.7 rendering rules):
 *  - `cmsBody` finds a known section on a page and validates its body against
 *    the fixed registry; a missing, inactive or malformed section yields null
 *    so the page simply skips it instead of crashing;
 *  - `CmsIcon` maps the registry `IconName` to lucide;
 *  - `InfoCard` is the template InfoCard (canvas card + tinted icon chip);
 *  - `ProseBlock` renders a `ProseBody` (eyebrow, h2, paragraphs).
 */
import type {
  CmsBody,
  CmsPage,
  CmsSection,
  IconName,
  PageSlug,
  ProseBody,
  SectionKey,
  Tone,
} from '@/api/schemas'
import { parseCmsBody } from '@/api/schemas'
import { Card, IconChip } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { CMS_ICONS } from '@/lib/domains'
import { SectionHeading, type EyebrowProps } from './section'

export interface CmsEntry<P extends PageSlug, K extends SectionKey<P>> {
  section: CmsSection
  body: CmsBody<P, K>
}

/** The validated body of `key` on `page`, or null when it is absent or invalid. */
export function cmsBody<P extends PageSlug, K extends SectionKey<P>>(
  page: CmsPage | undefined,
  pageSlug: P,
  key: K,
): CmsEntry<P, K> | null {
  if (!page || page.page_slug !== pageSlug) return null
  const section = page.sections.find((s) => s.section_key === key && s.is_active)
  if (!section) return null
  const body = parseCmsBody(pageSlug, key, section.body)
  return body ? { section, body } : null
}

export function CmsIcon({
  name,
  size = 20,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  const Icon = CMS_ICONS[name]
  return <Icon aria-hidden="true" size={size} className={className} />
}

export interface InfoCardProps {
  icon: IconName
  tone: Tone
  title: string
  text: string
  headingLevel?: 'h3' | 'h4'
  className?: string
}

export function InfoCard({
  icon,
  tone,
  title,
  text,
  headingLevel: Heading = 'h3',
  className,
}: InfoCardProps) {
  return (
    <Card variant="canvas" padding="standard" asChild className={className}>
      <article>
        <IconChip tone={tone} className="mb-7">
          <CmsIcon name={icon} />
        </IconChip>
        <Heading className="text-h4 text-ink">{title}</Heading>
        <p className="mt-2 text-body-sm text-ink-secondary">{text}</p>
      </article>
    </Card>
  )
}

export interface ProseBlockProps {
  body: ProseBody
  /** Heading id, for `aria-labelledby` on the surrounding section. */
  id?: string
  eyebrowTone?: EyebrowProps['tone']
  className?: string
}

export function ProseBlock({ body, id, eyebrowTone, className }: ProseBlockProps) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <SectionHeading
        id={id}
        eyebrow={body.eyebrow}
        eyebrowTone={eyebrowTone}
        title={body.heading}
      />
      <div className="mt-5 space-y-4">
        {body.paragraphs.map((paragraph, index) => (
          <p key={index} className="text-body text-ink-secondary">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  )
}
