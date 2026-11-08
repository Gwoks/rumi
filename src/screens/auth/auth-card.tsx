/**
 * Shared shell for the auth screens: a centered column with the page's single
 * h1 (eyebrow + title + intro), the form card, and an optional footer line
 * (e.g. "Belum punya akun? Daftar sekarang").
 */
import { Link } from 'react-router-dom'
import { Container, SectionHeading } from '@/components/rumi/section'
import { Card } from '@/components/ui/card'
import { InlineAlert } from '@/components/ui/inline-alert'
import { cn } from '@/lib/cn'
import { FOCUS } from '@/lib/styles'

export interface AuthCardProps {
  eyebrow?: string
  title: string
  intro?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'default' | 'wide'
}

export function AuthCard({
  eyebrow,
  title,
  intro,
  children,
  footer,
  size = 'default',
}: AuthCardProps) {
  return (
    <Container className="py-14 lg:py-20">
      <div className={cn('mx-auto', size === 'wide' ? 'max-w-2xl' : 'max-w-md')}>
        <SectionHeading as="h1" align="center" eyebrow={eyebrow} title={title} intro={intro} />
        <Card padding="feature" className="mt-8">
          {children}
        </Card>
        {footer && <p className="mt-6 text-center text-body-sm text-ink-secondary">{footer}</p>}
      </div>
    </Container>
  )
}

/** Form-level error (role="alert"), shown above the fields. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <InlineAlert variant="danger" className="mb-5">
      {message}
    </InlineAlert>
  )
}

/** Inline text link used in auth footers and hints. */
export function AuthLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-lg font-semibold text-primary-strong underline-offset-4 hover:underline',
        FOCUS,
      )}
    >
      {children}
    </Link>
  )
}
