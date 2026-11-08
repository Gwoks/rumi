/** A numbered /design-kit section: eyebrow + h2 + intro, then the demos. */
import { SectionHeading } from '@/components/rumi/section'
import { cn } from '@/lib/cn'

export interface KitSectionProps {
  id: string
  eyebrow: string
  title: string
  intro?: string
  children: React.ReactNode
  className?: string
}

export function KitSection({ id, eyebrow, title, intro, children, className }: KitSectionProps) {
  const headingId = `${id}-title`
  return (
    <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-28 pt-20', className)}>
      <SectionHeading
        id={headingId}
        eyebrow={eyebrow}
        eyebrowTone="primary"
        title={title}
        intro={intro}
      />
      <div className="mt-8">{children}</div>
    </section>
  )
}

/** Small uppercase label above a demo group. */
export function DemoLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-overline uppercase text-ink-tertiary">{children}</h3>
}
