import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarCheck, LayoutDashboard } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render'
import { DashboardShell } from './dashboard-shell'

const NAV = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'attendance', label: 'Kehadiran', icon: CalendarCheck },
]

describe('DashboardShell', () => {
  it('renders the h1, user chip, nav (sidebar + mobile) and main', async () => {
    const onNavigate = vi.fn()
    const onLogout = vi.fn()
    renderWithRouter(
      <DashboardShell
        title="Selamat datang, Nadia Rahman"
        subtitle="Sabtu, 14 November 2026"
        navItems={NAV}
        activeId="overview"
        onNavigate={onNavigate}
        user={{ full_name: 'Nadia Rahman', role: 'PARENT' }}
        onLogout={onLogout}
        actions={<span>aksi</span>}
      >
        isi
      </DashboardShell>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Selamat datang, Nadia Rahman' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sabtu, 14 November 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Akun Nadia Rahman')).toHaveTextContent('NR')
    expect(screen.getByText('Orang Tua')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('isi')
    const navs = screen.getAllByRole('navigation', { name: 'Menu dasbor' })
    expect(navs).toHaveLength(2)
    expect(within(navs[0]).getByRole('button', { name: 'Ringkasan' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await userEvent.click(within(navs[1]).getByRole('button', { name: 'Kehadiran' }))
    expect(onNavigate).toHaveBeenCalledWith('attendance')
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }))
    expect(onLogout).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Lihat situs' })).toHaveAttribute('href', '/')
  })

  it('defaults the subtitle to today and handles a missing user while logging out', () => {
    renderWithRouter(
      <DashboardShell
        title="Dasbor Admin"
        navItems={NAV}
        activeId="x"
        onNavigate={() => {}}
        user={null}
        onLogout={() => {}}
        isLoggingOut
      >
        isi
      </DashboardShell>,
    )
    expect(screen.queryByLabelText(/Akun/)).toBeNull()
    expect(screen.getByRole('button', { name: /Keluar/ })).toHaveAttribute('aria-busy', 'true')
  })
})
