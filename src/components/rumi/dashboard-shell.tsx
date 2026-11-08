/**
 * Dashboard shell (DESIGN.md "Dashboard shell") shared by the parent and
 * admin dashboards: a sidebar on `lg` (a scrollable pill strip below the
 * header on smaller screens), a sticky header with the date + greeting (the
 * page h1) and a user chip with "Keluar", and `main#main`.
 *
 * The screen owns the active section (e.g. synced to `?tab=`); the shell only
 * renders the nav and reports `onNavigate(id)`.
 */
import { Globe2, LogOut, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Role } from '@/api/schemas'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDateLong, initials, todayWib } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'
import { LogoLink } from './logo'
import { MAIN_ID, SkipLink } from './skip-link'

export interface DashboardNavItem {
  id: string
  label: string
  icon: LucideIcon
}

export interface DashboardUser {
  full_name: string
  role: Role
}

export interface DashboardShellProps {
  /** The page h1, e.g. "Selamat datang, Nadia". */
  title: string
  /** Defaults to today's date in WIB ("Sabtu, 14 November 2026"). */
  subtitle?: string
  navItems: readonly DashboardNavItem[]
  activeId: string
  onNavigate: (id: string) => void
  user: DashboardUser | null
  onLogout: () => void
  isLoggingOut?: boolean
  /** Extra header actions (e.g. the cart button on the parent dashboard). */
  actions?: React.ReactNode
  children: React.ReactNode
}

function NavButton({
  item,
  isActive,
  onNavigate,
  variant,
}: {
  item: DashboardNavItem
  isActive: boolean
  onNavigate: (id: string) => void
  variant: 'sidebar' | 'pill'
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onNavigate(item.id)}
      className={cn(
        'flex items-center gap-3 rounded-xl text-body-sm font-medium transition',
        FOCUS,
        variant === 'sidebar'
          ? 'w-full px-3 py-3'
          : 'min-h-10 shrink-0 whitespace-nowrap px-3 py-2',
        isActive
          ? 'bg-primary-soft text-primary-strong'
          : 'text-ink-tertiary hover:bg-surface-subtle',
      )}
    >
      <Icon aria-hidden="true" size={18} />
      {item.label}
    </button>
  )
}

function UserChip({ user }: { user: DashboardUser }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5 shadow-sm ring-1 ring-border"
      aria-label={t('common.dashboard.account', { name: user.full_name })}
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-lg bg-highlight-soft text-xs font-bold text-ink"
      >
        {initials(user.full_name)}
      </span>
      <span className="hidden text-left sm:block">
        <span className="block text-caption font-semibold text-ink">{user.full_name}</span>
        <span className="block text-caption text-ink-tertiary">
          {t(`common.role.${user.role}`)}
        </span>
      </span>
    </div>
  )
}

export function DashboardShell({
  title,
  subtitle = formatDateLong(todayWib()),
  navItems,
  activeId,
  onNavigate,
  user,
  onLogout,
  isLoggingOut = false,
  actions,
  children,
}: DashboardShellProps) {
  const navLabel = t('common.dashboard.navLabel')
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SkipLink />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface p-4 lg:flex">
          <div className="px-2">
            <LogoLink />
          </div>
          <nav aria-label={navLabel} className="mt-10 flex-1 space-y-1">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onNavigate={onNavigate}
                variant="sidebar"
              />
            ))}
          </nav>
          <Link
            to={ROUTES.home}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-body-sm font-semibold text-ink-tertiary hover:bg-surface-subtle',
              FOCUS,
            )}
          >
            <Globe2 aria-hidden="true" size={18} />
            {t('common.viewSite')}
          </Link>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-header border-b border-border bg-canvas/90 backdrop-blur">
            <div className="flex h-dashboard-header items-center justify-between gap-3 px-5 lg:px-8">
              <div className="min-w-0">
                <p className="text-caption text-ink-tertiary">{subtitle}</p>
                <h1 className="truncate text-h3 text-ink">{title}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {actions}
                {user && <UserChip user={user} />}
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={t('common.logout')}
                  onClick={onLogout}
                  loading={isLoggingOut}
                >
                  {!isLoggingOut && <LogOut aria-hidden="true" size={19} />}
                </Button>
              </div>
            </div>
            <nav
              aria-label={navLabel}
              className="flex gap-1 overflow-x-auto border-t border-border-subtle px-5 py-2 lg:hidden"
            >
              {navItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={item.id === activeId}
                  onNavigate={onNavigate}
                  variant="pill"
                />
              ))}
            </nav>
          </header>
          <main
            id={MAIN_ID}
            tabIndex={-1}
            className="mx-auto max-w-dashboard p-5 outline-none lg:p-8"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
