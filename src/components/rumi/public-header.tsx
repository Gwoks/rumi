/**
 * Public header (DESIGN.md "Public header"): logo, Indonesian nav with
 * `aria-current="page"` + underline on the active link, the cart button, and
 * "Masuk" (anonymous) or "Dasbor" (by role). On mobile a Menu button toggles a
 * collapsible nav panel.
 */
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/api/use-auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { t, type CopyKey } from '@/lib/copy'
import { homeForRole, ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'
import { CartButton } from './cart-button'
import { LogoLink } from './logo'

interface NavItem {
  to: string
  labelKey: CopyKey
  end?: boolean
}

export const PUBLIC_NAV: readonly NavItem[] = [
  { to: ROUTES.home, labelKey: 'common.nav.home', end: true },
  { to: ROUTES.whoWeAre, labelKey: 'common.nav.whoWeAre' },
  { to: ROUTES.ourApproach, labelKey: 'common.nav.ourApproach' },
  { to: ROUTES.weekendClasses, labelKey: 'common.nav.weekendClasses' },
  { to: ROUTES.playKits, labelKey: 'common.nav.playKits' },
]

const MOBILE_NAV_ID = 'mobile-nav'

function AccountLink({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { user } = useAuth()
  const to = user ? homeForRole(user.role) : ROUTES.login
  const label = !user
    ? t('common.nav.login')
    : user.role === 'ADMIN'
      ? t('common.nav.adminDashboard')
      : t('common.nav.dashboard')
  return (
    <Button asChild variant="ghost" className={className}>
      <Link to={to} onClick={onNavigate}>
        {label}
      </Link>
    </Button>
  )
}

export function PublicHeader() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="sticky top-0 z-header border-b border-border-subtle bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
        <LogoLink />
        <nav aria-label={t('common.nav.label')} className="hidden md:block">
          <ul className="flex items-center gap-8 text-body-sm font-medium text-ink-secondary">
            {PUBLIC_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg py-1 transition hover:text-ink',
                      FOCUS,
                      isActive &&
                        'font-semibold text-primary-strong underline decoration-primary decoration-2 underline-offset-8',
                    )
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <CartButton />
          <AccountLink className="hidden md:inline-flex" />
          <Button
            variant="icon"
            size="icon"
            className="md:hidden"
            aria-expanded={isMenuOpen}
            aria-controls={MOBILE_NAV_ID}
            aria-label={isMenuOpen ? t('common.nav.closeMenu') : t('common.nav.openMenu')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {isMenuOpen ? (
              <X aria-hidden="true" size={21} />
            ) : (
              <Menu aria-hidden="true" size={21} />
            )}
          </Button>
        </div>
      </div>
      <nav
        id={MOBILE_NAV_ID}
        aria-label={t('common.nav.mobileLabel')}
        hidden={!isMenuOpen}
        className="border-t border-border-subtle px-5 md:hidden"
      >
        <ul className="flex flex-col gap-1 py-4 text-body-sm font-medium">
          {PUBLIC_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={closeMenu}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg p-3 text-ink-secondary hover:bg-surface-subtle',
                    FOCUS,
                    isActive && 'bg-primary-soft font-semibold text-primary-strong',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
          <li className="mt-2">
            <AccountLink className="w-full justify-start bg-primary-soft" onNavigate={closeMenu} />
          </li>
        </ul>
      </nav>
    </header>
  )
}
