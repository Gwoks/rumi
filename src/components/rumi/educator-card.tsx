/**
 * EducatorCard (DESIGN.md "EducatorCard"): an initials tile in the person's
 * tone (no photos), name, role label and bio. Data comes from the CMS
 * `who-we-are / educators` body (PRD §5.7).
 */
import type { EducatorsBody } from '@/api/schemas'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { TONE_SOFT } from '@/lib/domains'

export type Educator = EducatorsBody['people'][number]

export interface EducatorCardProps {
  person: Educator
  headingLevel?: 'h3' | 'h4'
  className?: string
}

export function EducatorCard({
  person,
  headingLevel: Heading = 'h3',
  className,
}: EducatorCardProps) {
  return (
    <Card asChild className={className}>
      <article>
        <div
          aria-hidden="true"
          className={cn(
            'mb-6 grid h-16 w-16 place-items-center rounded-2xl text-xl font-semibold text-ink',
            TONE_SOFT[person.tone],
          )}
        >
          {person.initials}
        </div>
        <Heading className="text-h4 text-ink">{person.name}</Heading>
        <p className="mt-2 text-overline uppercase text-accent-strong">{person.role}</p>
        <p className="mt-4 text-body-sm text-ink-secondary">{person.bio}</p>
      </article>
    </Card>
  )
}
