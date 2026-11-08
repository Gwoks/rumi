/** Public API surface for the SPA: the typed client, auth store, schemas. */
export { api, setUnauthorizedHandler, type Api } from './client'
export { ApiError, CLIENT_CODES, isApiError, type FieldErrors } from './errors'
export {
  authStore,
  bootstrapAuth,
  clearAuth,
  login,
  logout,
  register,
  setAuthUser,
  type AuthState,
  type AuthStatus,
} from './auth-store'
export { useAuth, type AuthSnapshot } from './use-auth'
export * from './schemas'
