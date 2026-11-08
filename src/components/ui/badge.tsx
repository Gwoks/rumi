/**
 * Badge / pill (DESIGN.md "Badge and pills"). Status is never color-only: a
 * badge always carries its text label.
 */
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-overline uppercase',
  {
    variants: {
      variant: {
        success: 'bg-primary-soft text-primary-strong',
        pending: 'bg-highlight-soft text-highlight-strong',
        attention: 'bg-accent-soft text-accent-strong',
        neutral: 'bg-surface-subtle text-ink-secondary ring-1 ring-inset ring-border',
        danger: 'bg-danger-soft text-danger',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, ...props },
  ref,
) {
  return <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
})

/** Hero eyebrow pill: orange-soft pill with a decorative dot. */
export function EyebrowPill({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-overline uppercase text-accent-strong',
        className,
      )}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
      {children}
    </span>
  )
}

export { badgeVariants }
