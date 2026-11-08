/** Public footer (DESIGN.md "Public footer", the template's RumiFooter). */
import { Clock3, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'
import { LogoLink } from './logo'

const LINK = cn(
  'rounded-lg text-body-sm text-ink-secondary hover:text-primary-strong hover:underline',
  FOCUS,
)

export function PublicFooter() {
  const email = t('common.footer.contact.email')
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-3 lg:px-8">
        <div>
          <LogoLink />
          <p className="mt-5 max-w-xs text-body-sm text-ink-secondary">
            {t('common.brand.tagline')}
          </p>
        </div>
        <div>
          <h2 className="text-h4 text-ink">{t('common.footer.visit.title')}</h2>
          <p className="mt-4 flex items-start gap-2 text-body-sm text-ink-secondary">
            <MapPin aria-hidden="true" size={16} className="mt-1 shrink-0 text-primary" />
            <span>
              {t('common.footer.visit.venue')}
              <br />
              {t('common.footer.visit.address')}
            </span>
          </p>
          <p className="mt-3 flex items-center gap-2 text-body-sm text-ink-secondary">
            <Clock3 aria-hidden="true" size={16} className="shrink-0 text-primary" />
            {t('common.footer.visit.schedule')}
          </p>
        </div>
        <div>
          <h2 className="text-h4 text-ink">{t('common.footer.contact.title')}</h2>
          <p className="mt-4 text-body-sm text-ink-secondary">{t('common.footer.contact.body')}</p>
          <a
            href={`mailto:${email}`}
            className={cn(LINK, 'mt-3 inline-block font-semibold text-primary-strong')}
          >
            {email}
          </a>
          <p className="mt-2 text-body-sm text-ink-secondary">
            {t('common.footer.contact.whatsapp')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border-subtle px-5 py-5 text-center text-caption text-ink-tertiary">
        <span>{t('common.footer.copyright', { year: new Date().getFullYear() })}</span>
        <Link to={ROUTES.designKit} className={cn(LINK, 'text-caption text-ink-tertiary')}>
          {t('common.footer.designKit')}
        </Link>
      </div>
    </footer>
  )
}
