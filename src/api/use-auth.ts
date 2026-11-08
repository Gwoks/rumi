/** React binding over the auth store (useSyncExternalStore via `useStore`). */
import { useStore } from '@/lib/create-store'
import { authStore, type AuthStatus } from './auth-store'
import type { ApiError } from './errors'
import type { Role, User } from './schemas'

export interface AuthSnapshot {
  user: User | null
  status: AuthStatus
  error: ApiError | null
  role: Role | null
  isAuthenticated: boolean
}

export function useAuth(): AuthSnapshot {
  const state = useStore(authStore)
  return {
    ...state,
    role: state.user?.role ?? null,
    isAuthenticated: state.user !== null,
  }
}
