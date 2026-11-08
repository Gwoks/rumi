import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '@/api/auth-store'
import { api } from '@/api/client'
import { ApiError } from '@/api/errors'
import { makeAdmin, makeUser } from '@/test/factories'
import { renderWithRouter } from '@/test/render'
import { useLocation } from 'react-router-dom'
import { RequireRole } from './require-role'

function Where() {
  const location = useLocation()
  return <p>di {location.pathname + location.search}</p>
}

const routes = [
  { path: '/login', element: <Where /> },
  { path: '/parent/dashboard', element: <Where /> },
  { path: '/admin/dashboard', element: <Where /> },
]

afterEach(() => vi.restoreAllMocks())

describe('RequireRole', () => {
  it('waits while the session is checked', () => {
    act(() => authStore.setState({ user: null, status: 'loading', error: null }))
    renderWithRouter(<RequireRole role="PARENT">rahasia</RequireRole>, {
      route: '/parent/report/1',
      path: '/parent/report/:id',
      routes,
    })
    expect(screen.getAllByText('Memeriksa sesi…').length).toBeGreaterThan(0)
    expect(screen.queryByText('rahasia')).toBeNull()
  })

  it('bounces anonymous visitors to /login?next=', () => {
    act(() => authStore.setState({ user: null, status: 'ready', error: null }))
    renderWithRouter(<RequireRole role="PARENT">rahasia</RequireRole>, {
      route: '/parent/report/1?print=1',
      path: '/parent/report/:id',
      routes,
    })
    expect(
      screen.getByText('di /login?next=%2Fparent%2Freport%2F1%3Fprint%3D1'),
    ).toBeInTheDocument()
  })

  it('sends the wrong role to its own home', () => {
    act(() => authStore.setState({ user: makeUser(), status: 'ready', error: null }))
    renderWithRouter(<RequireRole role="ADMIN">rahasia</RequireRole>, {
      route: '/admin/x',
      path: '/admin/x',
      routes,
    })
    expect(screen.getByText('di /parent/dashboard')).toBeInTheDocument()
  })

  it('renders children for the right role', () => {
    act(() => authStore.setState({ user: makeAdmin(), status: 'ready', error: null }))
    renderWithRouter(<RequireRole role="ADMIN">rahasia</RequireRole>, {
      route: '/admin/x',
      path: '/admin/x',
      routes,
    })
    expect(screen.getByText('rahasia')).toBeInTheDocument()
  })

  it('offers a retry when the bootstrap failed', async () => {
    act(() =>
      authStore.setState({
        user: null,
        status: 'error',
        error: new ApiError('network_error', 'offline', 0),
      }),
    )
    const me = vi.spyOn(api, 'me').mockResolvedValue({ user: makeUser() })
    renderWithRouter(<RequireRole role="PARENT">rahasia</RequireRole>, {
      route: '/p',
      path: '/p',
      routes,
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Kami belum bisa memeriksa sesi Anda.')
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(me).toHaveBeenCalledOnce()
    expect(await screen.findByText('rahasia')).toBeInTheDocument()
  })
})
