/**
 * Auth store (PRD §5.3, §6.1): the signed-in user plus a bootstrap status,
 * held IN MEMORY only. The HttpOnly cookie is the truth and the frontend never
 * reads it; no user data is written to localStorage.
 *
 * `status` starts at 'loading' until `bootstrapAuth()` confirms the session
 * with GET /api/auth/me. Cross-tab: login / register / logout write a
 * PII-free timestamp under AUTH_SIGNAL_KEY; other tabs see the `storage`
 * event and silently re-check /api/auth/me.
 */
import { createStore } from '@/lib/create-store'
import { api } from './client'
import { ApiError } from './errors'
import type { LoginBody, RegisterBody, RegisterResult, User } from './schemas'

export type AuthStatus = 'loading' | 'ready' | 'error'

export interface AuthState {
  user: User | null
  status: AuthStatus
  error: ApiError | null
}

/** localStorage key carrying only a change timestamp (never user data). */
export const AUTH_SIGNAL_KEY = 'rumi-auth-signal'

const INITIAL: AuthState = { user: null, status: 'loading', error: null }

export const authStore = createStore<AuthState>(INITIAL)

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  return new ApiError('internal', err instanceof Error ? err.message : String(err), 0)
}

function signalOtherTabs(): void {
  try {
    localStorage.setItem(AUTH_SIGNAL_KEY, String(Date.now()))
  } catch {
    /* storage unavailable — other tabs catch up on their next request */
  }
}

/** Set the signed-in user (after login/register) and mark the store ready. */
export function setAuthUser(user: User | null): void {
  authStore.setState((prev) => ({ ...prev, user, status: 'ready', error: null }))
}

/** Forget the user locally (logout, or a 401 `unauthorized` from any call). */
export function clearAuth(): void {
  setAuthUser(null)
}

/** Confirm the session with GET /api/auth/me (never 401s, PRD §5.8 #10). */
export async function bootstrapAuth(): Promise<void> {
  authStore.setState((prev) => ({ ...prev, status: 'loading', error: null }))
  await refreshAuth()
}

/** Re-check the session without a loading state (cross-tab sync). */
export async function refreshAuth(): Promise<void> {
  try {
    const { user } = await api.me()
    setAuthUser(user)
  } catch (err) {
    authStore.setState((prev) => ({ ...prev, status: 'error', error: toApiError(err) }))
  }
}

/** POST /api/auth/login; throws ApiError (e.g. `invalid_credentials`, `rate_limited`). */
export async function login(body: LoginBody): Promise<User> {
  const { user } = await api.login(body)
  setAuthUser(user)
  signalOtherTabs()
  return user
}

/** POST /api/auth/register (parent + first child, atomic); signs the parent in. */
export async function register(body: RegisterBody): Promise<RegisterResult> {
  const result = await api.register(body)
  setAuthUser(result.user)
  signalOtherTabs()
  return result
}

/** POST /api/auth/logout; the local user is cleared even if the call fails. */
export async function logout(): Promise<void> {
  try {
    await api.logout()
  } finally {
    clearAuth()
    signalOtherTabs()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_SIGNAL_KEY) void refreshAuth()
  })
}
