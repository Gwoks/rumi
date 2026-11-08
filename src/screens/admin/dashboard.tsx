/**
 * `/admin/dashboard` (PRD §4.1): sections Ringkasan (metrics), Konten (CMS),
 * Kelas, Kit (three ResourceManager configs), Siswa (directory, profile,
 * attendance, assessment logger) and Pesanan (mark PAID / CANCELLED).
 * Wrapped in <RequireRole role="ADMIN"> by router.tsx. The active section
 * lives in `?tab=`; each section mounts fresh, so Ringkasan always shows the
 * latest metrics after an order changes.
 */
import { CalendarDays, FileText, LayoutDashboard, Package, ShoppingBag, Users } from 'lucide-react'
import { useAuth } from '@/api/use-auth'
import { useLogoutToHome, useTabParam } from '@/components/rumi/dashboard-hooks'
import { DashboardShell, type DashboardNavItem } from '@/components/rumi/dashboard-shell'
import { t } from '@/lib/copy'
import { ClassesManager } from './dashboard/classes'
import { ContentManager } from './dashboard/content'
import { KitsManager } from './dashboard/kits'
import { AdminOrders } from './dashboard/orders'
import { AdminOverview } from './dashboard/overview'
import { StudentDirectory } from './dashboard/students'

const ADMIN_TABS = ['overview', 'content', 'classes', 'kits', 'students', 'orders'] as const
type AdminTab = (typeof ADMIN_TABS)[number]

const NAV: readonly DashboardNavItem[] = [
  { id: 'overview', label: t('admin.tab.overview'), icon: LayoutDashboard },
  { id: 'content', label: t('admin.tab.content'), icon: FileText },
  { id: 'classes', label: t('admin.tab.classes'), icon: CalendarDays },
  { id: 'kits', label: t('admin.tab.kits'), icon: Package },
  { id: 'students', label: t('admin.tab.students'), icon: Users },
  { id: 'orders', label: t('admin.tab.orders'), icon: ShoppingBag },
]

function Section({ tab, onNavigate }: { tab: AdminTab; onNavigate: (tab: string) => void }) {
  switch (tab) {
    case 'content':
      return <ContentManager />
    case 'classes':
      return <ClassesManager />
    case 'kits':
      return <KitsManager />
    case 'students':
      return <StudentDirectory />
    case 'orders':
      return <AdminOrders />
    default:
      return <AdminOverview onNavigate={onNavigate} />
  }
}

export function AdminDashboardScreen() {
  const { user } = useAuth()
  const [activeId, setActiveId] = useTabParam<AdminTab>(ADMIN_TABS, 'overview')
  const { onLogout, isLoggingOut } = useLogoutToHome()

  return (
    <DashboardShell
      title={t('admin.dashboard.title')}
      navItems={NAV}
      activeId={activeId}
      onNavigate={setActiveId}
      user={user}
      onLogout={onLogout}
      isLoggingOut={isLoggingOut}
    >
      <Section tab={activeId} onNavigate={setActiveId} />
    </DashboardShell>
  )
}
