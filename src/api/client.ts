/**
 * Typed API client over the 40 PRD §5.8 endpoints — the single typed boundary
 * the SPA uses against the frozen contract. Screens never call `fetch`.
 *
 * - Every request sends the session cookie (`credentials: 'same-origin'`).
 * - Every response is validated with zod; `data` is unwrapped from the envelope.
 * - When any call returns `code: 'unauthorized'`, the registered handler runs
 *   (main.tsx clears the auth store and redirects to /login?next=…).
 *   `invalid_credentials` (also 401) never triggers it (PRD §5.2).
 */
import { z } from 'zod'
import { ApiError } from './errors'
import { buildUrl, doFetch, parseJsonResponse, type Query } from './http'
import {
  assessmentSchema,
  authUserSchema,
  checkoutResultSchema,
  childReportSchema,
  childSchema,
  classListSchema,
  cmsPageSchema,
  cmsSectionSchema,
  enrollmentSchema,
  healthSchema,
  meSchema,
  metricsSchema,
  orderSchema,
  paginated,
  playKitSchema,
  registerResultSchema,
  studentDetailSchema,
  studentSummarySchema,
  weekendClassSchema,
  type AdminClassQuery,
  type AdminCmsQuery,
  type AdminOrderQuery,
  type AssessmentCreate,
  type CheckoutBody,
  type ChildInput,
  type ChildPatch,
  type ClassCreate,
  type ClassPatch,
  type ClassQuery,
  type CmsCreate,
  type CmsPatch,
  type EnrollmentStatusPatch,
  type ForgotPasswordBody,
  type KitCreate,
  type KitPatch,
  type KitQuery,
  type LoginBody,
  type OrderStatusPatch,
  type PageSlug,
  type RegisterBody,
  type ResetPasswordBody,
  type StudentQuery,
} from './schemas'

export { ApiError }

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOpts<T extends z.ZodTypeAny> {
  method?: Method
  body?: unknown
  query?: Query
  schema: T
}

let onUnauthorized: (() => void) | null = null

/** Registered once at boot (main.tsx); the client stays framework-agnostic. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

async function request<T extends z.ZodTypeAny>(
  path: string,
  opts: RequestOpts<T>,
): Promise<z.infer<T>> {
  const hasBody = opts.body !== undefined
  const res = await doFetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  })
  try {
    return await parseJsonResponse(res, opts.schema)
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') onUnauthorized?.()
    throw err
  }
}

const id = (value: number): string => encodeURIComponent(String(value))
const nothing = z.null()

export const api = {
  // ── Public ──
  /** #1 GET /api/health */
  health: () => request('/api/health', { schema: healthSchema }),
  /** #2 GET /api/cms/{page_slug} */
  getCmsPage: (pageSlug: PageSlug) =>
    request(`/api/cms/${encodeURIComponent(pageSlug)}`, { schema: cmsPageSchema }),
  /** #3 GET /api/classes?location=&from=&to=&age= */
  listClasses: (query: ClassQuery = {}) =>
    request('/api/classes', { query, schema: classListSchema }),
  /** #4 GET /api/classes/{id} */
  getClass: (classId: number) =>
    request(`/api/classes/${id(classId)}`, { schema: weekendClassSchema }),
  /** #5 GET /api/kits?category= */
  listKits: (query: KitQuery = {}) =>
    request('/api/kits', { query, schema: z.array(playKitSchema) }),
  /** #6 GET /api/kits/{id} */
  getKit: (kitId: number) => request(`/api/kits/${id(kitId)}`, { schema: playKitSchema }),

  // ── Auth ──
  /** #7 POST /api/auth/register → 201 { user, child } + cookie */
  register: (body: RegisterBody) =>
    request('/api/auth/register', { method: 'POST', body, schema: registerResultSchema }),
  /** #8 POST /api/auth/login → { user } + cookie */
  login: (body: LoginBody) =>
    request('/api/auth/login', { method: 'POST', body, schema: authUserSchema }),
  /** #9 POST /api/auth/logout → null */
  logout: () => request('/api/auth/logout', { method: 'POST', schema: nothing }),
  /** #10 GET /api/auth/me → { user: User | null } (never 401) */
  me: () => request('/api/auth/me', { schema: meSchema }),
  /** #11 POST /api/auth/forgot-password → null (always) */
  forgotPassword: (body: ForgotPasswordBody) =>
    request('/api/auth/forgot-password', { method: 'POST', body, schema: nothing }),
  /** #12 POST /api/auth/reset-password → null */
  resetPassword: (body: ResetPasswordBody) =>
    request('/api/auth/reset-password', { method: 'POST', body, schema: nothing }),

  // ── Parent ──
  /** #13 GET /api/me/children */
  listChildren: () => request('/api/me/children', { schema: z.array(childSchema) }),
  /** #14 POST /api/me/children */
  createChild: (body: ChildInput) =>
    request('/api/me/children', { method: 'POST', body, schema: childSchema }),
  /** #15 PATCH /api/me/children/{id} */
  updateChild: (childId: number, body: ChildPatch) =>
    request(`/api/me/children/${id(childId)}`, { method: 'PATCH', body, schema: childSchema }),
  /** #16 DELETE /api/me/children/{id} */
  deleteChild: (childId: number) =>
    request(`/api/me/children/${id(childId)}`, { method: 'DELETE', schema: nothing }),
  /** #17 GET /api/me/children/{id}/assessments */
  listChildAssessments: (childId: number) =>
    request(`/api/me/children/${id(childId)}/assessments`, { schema: z.array(assessmentSchema) }),
  /** #18 GET /api/me/children/{id}/enrollments */
  listChildEnrollments: (childId: number) =>
    request(`/api/me/children/${id(childId)}/enrollments`, { schema: z.array(enrollmentSchema) }),
  /** #19 GET /api/me/children/{id}/report */
  getChildReport: (childId: number) =>
    request(`/api/me/children/${id(childId)}/report`, { schema: childReportSchema }),
  /** #20 GET /api/me/orders */
  listMyOrders: () => request('/api/me/orders', { schema: z.array(orderSchema) }),
  /** #21 POST /api/orders → 201 (new) / 200 (idempotent replay) CheckoutResult */
  checkout: (body: CheckoutBody) =>
    request('/api/orders', { method: 'POST', body, schema: checkoutResultSchema }),

  // ── Admin ──
  /** #22 GET /api/admin/metrics */
  adminMetrics: () => request('/api/admin/metrics', { schema: metricsSchema }),
  /** #23 GET /api/admin/cms?page_slug= */
  adminListCms: (query: AdminCmsQuery = {}) =>
    request('/api/admin/cms', { query, schema: z.array(cmsSectionSchema) }),
  /** #24 POST /api/admin/cms */
  adminCreateCms: (body: CmsCreate) =>
    request('/api/admin/cms', { method: 'POST', body, schema: cmsSectionSchema }),
  /** #25 PATCH /api/admin/cms/{id} */
  adminUpdateCms: (sectionId: number, body: CmsPatch) =>
    request(`/api/admin/cms/${id(sectionId)}`, { method: 'PATCH', body, schema: cmsSectionSchema }),
  /** #26 DELETE /api/admin/cms/{id} */
  adminDeleteCms: (sectionId: number) =>
    request(`/api/admin/cms/${id(sectionId)}`, { method: 'DELETE', schema: nothing }),
  /** #27 GET /api/admin/classes?status= */
  adminListClasses: (query: AdminClassQuery = {}) =>
    request('/api/admin/classes', { query, schema: z.array(weekendClassSchema) }),
  /** #28 POST /api/admin/classes */
  adminCreateClass: (body: ClassCreate) =>
    request('/api/admin/classes', { method: 'POST', body, schema: weekendClassSchema }),
  /** #29 PATCH /api/admin/classes/{id} */
  adminUpdateClass: (classId: number, body: ClassPatch) =>
    request(`/api/admin/classes/${id(classId)}`, {
      method: 'PATCH',
      body,
      schema: weekendClassSchema,
    }),
  /** #30 DELETE /api/admin/classes/{id} */
  adminDeleteClass: (classId: number) =>
    request(`/api/admin/classes/${id(classId)}`, { method: 'DELETE', schema: nothing }),
  /** #31 GET /api/admin/kits?category= */
  adminListKits: (query: KitQuery = {}) =>
    request('/api/admin/kits', { query, schema: z.array(playKitSchema) }),
  /** #32 POST /api/admin/kits */
  adminCreateKit: (body: KitCreate) =>
    request('/api/admin/kits', { method: 'POST', body, schema: playKitSchema }),
  /** #33 PATCH /api/admin/kits/{id} */
  adminUpdateKit: (kitId: number, body: KitPatch) =>
    request(`/api/admin/kits/${id(kitId)}`, { method: 'PATCH', body, schema: playKitSchema }),
  /** #34 DELETE /api/admin/kits/{id} */
  adminDeleteKit: (kitId: number) =>
    request(`/api/admin/kits/${id(kitId)}`, { method: 'DELETE', schema: nothing }),
  /** #35 GET /api/admin/students?q=&page=&per_page= → Paginated<StudentSummary> */
  adminListStudents: (query: StudentQuery = {}) =>
    request('/api/admin/students', { query, schema: paginated(studentSummarySchema) }),
  /** #36 GET /api/admin/students/{id} → StudentDetail */
  adminGetStudent: (childId: number) =>
    request(`/api/admin/students/${id(childId)}`, { schema: studentDetailSchema }),
  /** #37 POST /api/admin/assessments */
  adminCreateAssessment: (body: AssessmentCreate) =>
    request('/api/admin/assessments', { method: 'POST', body, schema: assessmentSchema }),
  /** #38 PATCH /api/admin/enrollments/{id} { status: ATTENDED | ABSENT } */
  adminUpdateEnrollment: (enrollmentId: number, body: EnrollmentStatusPatch) =>
    request(`/api/admin/enrollments/${id(enrollmentId)}`, {
      method: 'PATCH',
      body,
      schema: enrollmentSchema,
    }),
  /** #39 GET /api/admin/orders?status=&q=&page=&per_page= → Paginated<Order> */
  adminListOrders: (query: AdminOrderQuery = {}) =>
    request('/api/admin/orders', { query, schema: paginated(orderSchema) }),
  /** #40 PATCH /api/admin/orders/{id}/status { status: PAID | CANCELLED } */
  adminUpdateOrderStatus: (orderId: number, body: OrderStatusPatch) =>
    request(`/api/admin/orders/${id(orderId)}/status`, {
      method: 'PATCH',
      body,
      schema: orderSchema,
    }),
} as const

export type Api = typeof api
