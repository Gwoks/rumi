/**
 * Button (DESIGN.md "Button"). Variants primary / accent / secondary / soft /
 * ghost / link / danger / icon; sizes sm / md / lg / icon. `accent` is the one
 * commitment action per decision point (dark `accent-on` text, never white).
 * `loading` keeps the label, shows a spinner and sets aria-busy. `asChild`
 * renders the styles onto a child (e.g. a router <Link>).
 */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { FOCUS } from '@/lib/styles'
import { Spinner } from './spinner'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition duration-base ease-standard',
    FOCUS,
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary-strong text-primary-on shadow-sm hover:bg-primary-strong-hover motion-safe:hover:-translate-y-0.5',
        accent:
          'bg-accent text-accent-on shadow-sm hover:bg-accent-hover motion-safe:hover:-translate-y-0.5',
        secondary:
          'border border-border bg-surface text-ink hover:border-primary motion-safe:hover:-translate-y-0.5',
        soft: 'bg-primary-soft text-primary-strong hover:ring-1 hover:ring-inset hover:ring-primary/30',
        ghost: 'text-primary-strong hover:bg-primary-soft',
        link: 'text-primary-strong underline-offset-4 hover:underline',
        danger: 'bg-danger text-ink-inverse hover:bg-danger/90',
        icon: 'text-ink hover:bg-primary-soft',
      },
      size: {
        sm: 'h-9 px-3 text-body-sm',
        md: 'h-11 px-4 text-body-sm',
        lg: 'h-12 px-5 text-body',
        icon: 'h-10 w-10 p-0',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    loading = false,
    asChild = false,
    children,
    disabled,
    type,
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className)
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
})

export { buttonVariants }
