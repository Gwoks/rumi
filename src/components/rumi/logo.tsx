/**
 * RUMI logo: the vendored, svgo-optimized mark (public/brand/rumi-logo.svg)
 * plus an optional text wordmark. The <img> alt carries the accessible name,
 * so the wordmark is aria-hidden (no double announcement).
 */
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'

export const LOGO_SRC = '/brand/rumi-logo.svg'

export interface LogoProps {
  className?: string
  /** Show "RUMI / RUMAH MAIN ISLAMI" next to the mark. */
  withWordmark?: boolean
}

export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img
        src={LOGO_SRC}
        alt={t('common.brand.logoAlt')}
        width={31}
        height={40}
        className="h-10 w-auto"
      />
      {withWordmark && (
        <span aria-hidden="true" className="leading-none">
          <span className="block text-body-sm font-semibold tracking-[0.18em] text-ink">
            {t('common.brand.name')}
          </span>
          <span className="mt-1 block text-micro uppercase text-ink-tertiary">
            {t('common.brand.full')}
          </span>
        </span>
      )}
    </span>
  )
}

/** The logo as a link home (header, footer, dashboard sidebar). */
export function LogoLink({ className, withWordmark }: LogoProps) {
  return (
    <Link to={ROUTES.home} className={cn('inline-flex rounded-xl', FOCUS, className)}>
      <Logo withWordmark={withWordmark} />
    </Link>
  )
}
