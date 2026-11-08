import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAdmin, makeChild, makeUser } from '@/test/factories'
import {
  AUTH_SIGNAL_KEY,
  authStore,
  bootstrapAuth,
  clearAuth,
  login,
  logout,
  refreshAuth,
  register,
} from './auth-store'
import { api } from './client'
import { ApiError } from './errors'
import { useAuth } from './use-auth'

beforeEach(() => authStore.setState({ user: null, status: 'loading', error: null }))
afterEach(() => vi.restoreAllMocks())

describe('auth store', () => {
  it('bootstraps the signed-in user from /api/auth/me', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ user: makeUser() })
    await bootstrapAuth()
    expect(authStore.getSnapshot()).toMatchObject({
      status: 'ready',
      user: { email: 'nadia@example.com' },
    })
  })

  it('bootstraps an anonymous visitor', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ user: null })
    await bootstrapAuth()
    expect(authStore.getSnapshot()).toEqual({ status: 'ready', user: null, error: null })
  })

  it('records a bootstrap failure', async () => {
    vi.spyOn(api, 'me').mockRejectedValue(new ApiError('network_error', 'offline', 0))
    await bootstrapAuth()
    expect(authStore.getSnapshot().status).toBe('error')
    expect(authStore.getSnapshot().error?.code).toBe('network_error')

    vi.spyOn(api, 'me').mockRejectedValue(new Error('boom'))
    await bootstrapAuth()
    expect(authStore.getSnapshot().error?.code).toBe('internal')
  })

  it('logs in, registers and logs out', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({ user: makeAdmin() })
    await expect(login({ email: 'admin@rumi.id', password: 'x' })).resolves.toMatchObject({
      role: 'ADMIN',
    })
    expect(authStore.getSnapshot().user?.role).toBe('ADMIN')

    vi.spyOn(api, 'register').mockResolvedValue({ user: makeUser(), child: makeChild() })
    const result = await register({
      parent: { full_name: 'Nadia', email: 'n@e.co', phone_wa: '0812', password: 'rahasia123' },
      child: { name: 'Amina', dob: '2020-04-15' },
    })
    expect(result.child.name).toBe('Amina')
    expect(authStore.getSnapshot().user?.role).toBe('PARENT')

    vi.spyOn(api, 'logout').mockResolvedValue(null)
    await logout()
    expect(authStore.getSnapshot().user).toBeNull()
  })

  it('clears the user even when logout fails', async () => {
    authStore.setState({ user: makeUser(), status: 'ready', error: null })
    vi.spyOn(api, 'logout').mockRejectedValue(new ApiError('network_error', 'offline', 0))
    await expect(logout()).rejects.toBeInstanceOf(ApiError)
    expect(authStore.getSnapshot().user).toBeNull()
  })

  it('never writes user data to localStorage, only a change signal', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({ user: makeUser() })
    await login({ email: 'nadia@example.com', password: 'x' })
    const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? '')
    expect(Object.keys(localStorage)).toEqual([AUTH_SIGNAL_KEY])
    expect(stored.join(' ')).not.toContain('nadia@example.com')
    expect(Number(localStorage.getItem(AUTH_SIGNAL_KEY))).toBeGreaterThan(0)
  })

  it('silently re-checks the session when another tab signals', async () => {
    authStore.setState({ user: makeUser(), status: 'ready', error: null })
    const me = vi.spyOn(api, 'me').mockResolvedValue({ user: null })
    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key', newValue: '1' }))
    expect(me).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_KEY, newValue: '2' }))
    expect(authStore.getSnapshot().status).toBe('ready')
    await vi.waitFor(() => expect(authStore.getSnapshot().user).toBeNull())
    expect(me).toHaveBeenCalledOnce()
  })

  it('keeps a ready session when a cross-tab re-check fails transiently', async () => {
    const user = makeUser()
    authStore.setState({ user, status: 'ready', error: null })
    const me = vi.spyOn(api, 'me').mockRejectedValue(new ApiError('network_error', 'offline', 0))
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_KEY, newValue: '3' }))
    await vi.waitFor(() => expect(me).toHaveBeenCalledOnce())
    await Promise.resolve()
    expect(authStore.getSnapshot()).toEqual({ user, status: 'ready', error: null })
  })

  it('still reports a failed re-check while not yet ready', async () => {
    authStore.setState({ user: null, status: 'error', error: null })
    vi.spyOn(api, 'me').mockRejectedValue(new ApiError('internal', 'boom', 500))
    await refreshAuth()
    expect(authStore.getSnapshot().status).toBe('error')
    expect(authStore.getSnapshot().error?.code).toBe('internal')
  })

  it('survives a throwing localStorage when signalling', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(api, 'logout').mockResolvedValue(null)
    await expect(logout()).resolves.toBeUndefined()
  })

  it('exposes role and isAuthenticated through useAuth', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current).toMatchObject({ isAuthenticated: false, role: null })
    act(() => authStore.setState({ user: makeAdmin(), status: 'ready', error: null }))
    expect(result.current).toMatchObject({ isAuthenticated: true, role: 'ADMIN' })
    act(() => clearAuth())
    expect(result.current.user).toBeNull()
  })
})
