import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render'
import { useLogoutToHome, useTabParam, useUpdateSearchParams } from './dashboard-hooks'

const logoutMock = vi.hoisted(() => vi.fn<() => Promise<void>>())
vi.mock('@/api/auth-store', () => ({ logout: logoutMock }))

const TABS = ['overview', 'orders', 'progress'] as const

function TabProbe() {
  const [active, setActive] = useTabParam(TABS, 'overview')
  const update = useUpdateSearchParams()
  const location = useLocation()
  return (
    <div>
      <p>aktif:{active}</p>
      <p>url:{location.search}</p>
      <button onClick={() => setActive('orders')}>pesanan</button>
      <button onClick={() => setActive('overview')}>ringkasan</button>
      <button onClick={() => update({ child: '7' }, { replace: true })}>anak</button>
      <button onClick={() => update({ child: null })}>hapus anak</button>
    </div>
  )
}

function LogoutProbe() {
  const { onLogout, isLoggingOut } = useLogoutToHome()
  const location = useLocation()
  return (
    <div>
      <p>path:{location.pathname}</p>
      <p>busy:{String(isLoggingOut)}</p>
      <button onClick={onLogout}>keluar</button>
    </div>
  )
}

describe('useTabParam / useUpdateSearchParams', () => {
  it('reads ?tab=, falls back on unknown values and writes immutably', async () => {
    renderWithRouter(<TabProbe />, { route: '/dasbor?tab=nope&child=1' })
    expect(screen.getByText('aktif:overview')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'pesanan' }))
    expect(screen.getByText('aktif:orders')).toBeInTheDocument()
    expect(screen.getByText('url:?tab=orders&child=1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'anak' }))
    expect(screen.getByText('url:?tab=orders&child=7')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ringkasan' }))
    expect(screen.getByText('url:?child=7')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'hapus anak' }))
    expect(screen.getByText('url:')).toBeInTheDocument()
  })
})

describe('useLogoutToHome', () => {
  beforeEach(() => {
    logoutMock.mockReset()
  })

  it('logs out and lands on Beranda', async () => {
    logoutMock.mockResolvedValue(undefined)
    renderWithRouter(<LogoutProbe />, { route: '/admin/dashboard' })
    await userEvent.click(screen.getByRole('button', { name: 'keluar' }))
    await waitFor(() => expect(screen.getByText('path:/')).toBeInTheDocument())
    expect(screen.getByText('busy:false')).toBeInTheDocument()
    expect(logoutMock).toHaveBeenCalledOnce()
  })

  it('still lands on Beranda when the logout call fails', async () => {
    logoutMock.mockImplementation(() => Promise.reject(new Error('offline')))
    renderWithRouter(<LogoutProbe />, { route: '/parent/dashboard' })
    await userEvent.click(screen.getByRole('button', { name: 'keluar' }))
    await waitFor(() => expect(screen.getByText('path:/')).toBeInTheDocument())
  })
})
