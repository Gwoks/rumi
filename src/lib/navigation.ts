/**
 * Route helpers shared by the auth gate, the header and the login screen.
 * `ROUTES` is the single source of the app's paths (router.tsx wires them).
 */
import type { Role } from '@/api/schemas'

export const ROUTES = {
  home: '/',
  whoWeAre: '/who-we-are',
  ourApproach: '/our-approach',
  weekendClasses: '/weekend-classes',
  playKits: '/play-kits',
  designKit: '/design-kit',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  parentDashboard: '/parent/dashboard',
  parentReport: '/parent/report/:childId',
  adminDashboard: '/admin/dashboard',
} as const

/** The parent dashboard's Pesanan tab (`?tab=orders`). */
export const PARENT_ORDERS_PATH = `${ROUTES.parentDashboard}?tab=orders`

/** `/parent/report/42` */
export function parentReportPath(childId: number): string {
  return ROUTES.parentReport.replace(':childId', String(childId))
}

/** Where a signed-in user lands: PARENT → parent dashboard, ADMIN → admin dashboard. */
export function homeForRole(role: Role): string {
  return role === 'ADMIN' ? ROUTES.adminDashboard : ROUTES.parentDashboard
}

/**
 * Accept only same-origin absolute paths for `?next=` (no `//host`, no
 * `/\host`, no scheme), otherwise fall back. Prevents open redirects.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f]/.test(raw)) return fallback
  return raw
}

/** `/login?next=<path+search>` for the 401 / RequireRole bounce (PRD §5.2). */
export function loginPathWithNext(pathWithSearch: string): string {
  const next = safeNextPath(pathWithSearch, ROUTES.home)
  if (next === ROUTES.home || next.startsWith(ROUTES.login)) return ROUTES.login
  return `${ROUTES.login}?next=${encodeURIComponent(next)}`
}
