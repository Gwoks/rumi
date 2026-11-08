/**
 * `/parent/dashboard` (PRD §4.1): child switcher + sections Ringkasan,
 * Kehadiran, Perkembangan, Pesanan. Wrapped in <RequireRole role="PARENT">
 * by router.tsx. The active section lives in `?tab=` and the selected child
 * in `?child=` (deep-linkable; the shell nav is the section switcher).
 */
import { BarChart3, CalendarCheck, LayoutDashboard, Package } from 'lucide-react'
import { useAuth } from '@/api/use-auth'
import { CartButton } from '@/components/rumi/cart-button'
import { useLogoutToHome, useTabParam } from '@/components/rumi/dashboard-hooks'
import { DashboardShell, type DashboardNavItem } from '@/components/rumi/dashboard-shell'
import { t } from '@/lib/copy'
import { ChildArea } from './dashboard/child-area'
import { ParentOrders } from './dashboard/orders'
import { PARENT_TABS, type ParentTab } from './dashboard/tabs'

const NAV: readonly DashboardNavItem[] = [
  { id: 'overview', label: t('parent.tab.overview'), icon: LayoutDashboard },
  { id: 'attendance', label: t('parent.tab.attendance'), icon: CalendarCheck },
  { id: 'progress', label: t('parent.tab.progress'), icon: BarChart3 },
  { id: 'orders', label: t('parent.tab.orders'), icon: Package },
]

export function ParentDashboardScreen() {
  const { user } = useAuth()
  const [activeId, setActiveId] = useTabParam<ParentTab>(PARENT_TABS, 'overview')
  const { onLogout, isLoggingOut } = useLogoutToHome()

  return (
    <DashboardShell
      title={
        user
          ? t('common.dashboard.greeting', { name: user.full_name })
          : t('parent.dashboard.title')
      }
      navItems={NAV}
      activeId={activeId}
      onNavigate={setActiveId}
      user={user}
      onLogout={onLogout}
      isLoggingOut={isLoggingOut}
      actions={<CartButton />}
    >
      {activeId === 'orders' ? (
        <ParentOrders />
      ) : (
        <ChildArea tab={activeId} onNavigate={setActiveId} />
      )}
    </DashboardShell>
  )
}
