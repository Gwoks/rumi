/**
 * Page/section layout helpers (DESIGN.md "Spacing and layout", "Section
 * header block"): Container, Section, Eyebrow, SectionHeading, PageHeader.
 * One h1 per page — use PageHeader (h1) once, SectionHeading (h2) below it.
 */
import { cn } from '@/lib/cn'
import { CONTAINER } from '@/lib/styles'

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(CONTAINER, className)} {...props} />
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** `surface` paints a white band with hairlines (alternating sections). */
  tone?: 'canvas' | 'surface'
  containerClassName?: string
}

export function Section({
  tone = 'canvas',
  className,
  containerClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn('py-20', tone === 'surface' && 'border-y border-border bg-surface', className)}
      {...props}
    >
      <Container className={containerClassName}>{children}</Container>
    </section>
  )
}

export interface EyebrowProps {
  children: React.ReactNode
  /** Alternate accent / primary section by section, as the template does. */
  tone?: 'accent' | 'primary'
  className?: string
}

export function Eyebrow({ children, tone = 'accent', className }: EyebrowProps) {
  return (
    <p
      className={cn(
        'text-eyebrow uppercase',
        tone === 'accent' ? 'text-accent-strong' : 'text-primary-strong',
        className,
      )}
    >
      {children}
    </p>
  )
}

export interface SectionHeadingProps {
  title: React.ReactNode
  eyebrow?: React.ReactNode
  eyebrowTone?: EyebrowProps['tone']
  intro?: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
  /** Pair with `aria-labelledby` on the surrounding section. */
  id?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  title,
  eyebrow,
  eyebrowTone,
  intro,
  as: Heading = 'h2',
  id,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>}
      <Heading id={id} className={cn('text-h2 text-ink sm:text-h1', eyebrow && 'mt-3')}>
        {title}
      </Heading>
      {intro && (
        <p
          className={cn(
            'mt-4 max-w-xl text-body text-ink-secondary',
            align === 'center' && 'mx-auto',
          )}
        >
          {intro}
        </p>
      )}
    </div>
  )
}

/** Top-of-page header block with the page's single h1. */
export function PageHeader({ className, ...props }: Omit<SectionHeadingProps, 'as'>) {
  return (
    <Container className={cn('pb-10 pt-14 lg:pt-20', className)}>
      <SectionHeading as="h1" {...props} />
    </Container>
  )
}
