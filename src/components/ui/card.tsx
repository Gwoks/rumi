/**
 * Card family (DESIGN.md "Card family"). Cards sit flat (1px border, no
 * shadow); only `interactive` lifts on hover. `feature` is the teal note panel
 * (white text on primary-strong), `tint` a soft-tone panel, `canvas` the
 * template InfoCard.
 */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { Tone } from '@/api/schemas'
import { cn } from '@/lib/cn'
import { TONE_SOFT } from '@/lib/domains'

const cardVariants = cva('rounded-2xl', {
  variants: {
    variant: {
      default: 'border border-border bg-surface',
      interactive:
        'group border border-border bg-surface transition duration-base hover:border-primary/40 hover:shadow-card motion-safe:hover:-translate-y-1',
      canvas: 'border border-border bg-canvas',
      feature: 'bg-primary-strong text-ink-inverse',
      tint: '',
    },
    padding: {
      none: '',
      compact: 'p-5',
      standard: 'p-6',
      feature: 'p-6 sm:p-8',
    },
  },
  defaultVariants: { variant: 'default', padding: 'compact' },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  /** Soft surface for `variant="tint"`. */
  tone?: Tone
  /** Render the card styles onto the child element (e.g. <article>, <li>). */
  asChild?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, padding, tone = 'teal', asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'div'
  return (
    <Comp
      ref={ref}
      className={cn(
        cardVariants({ variant, padding }),
        variant === 'tint' && TONE_SOFT[tone],
        className,
      )}
      {...props}
    />
  )
})

export function CardTitle({
  className,
  as: Tag = 'h3',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' | 'p' }) {
  return <Tag className={cn('text-h4 text-ink', className)} {...props} />
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-2 text-body-sm text-ink-secondary', className)} {...props} />
}

/** Inline note: a small teal-soft panel for hints inside a card or form. */
export function InlineNote({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl bg-primary-soft p-4 text-body-sm text-ink-secondary', className)}
      {...props}
    />
  )
}

export interface IconChipProps {
  tone?: Tone
  size?: 'sm' | 'md'
  className?: string
  children: React.ReactNode
}

/** Icon chip: a tinted rounded square holding an 18–20px icon (decorative). */
export function IconChip({ tone = 'teal', size = 'md', className, children }: IconChipProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-xl text-ink',
        size === 'md' ? 'h-11 w-11' : 'h-10 w-10',
        TONE_SOFT[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export { cardVariants }
