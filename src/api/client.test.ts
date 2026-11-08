import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fail,
  makeAssessment,
  makeCheckoutResult,
  makeChild,
  makeChildReport,
  makeClass,
  makeClassList,
  makeCmsPage,
  makeCmsSection,
  makeEnrollment,
  makeHealth,
  makeKit,
  makeMetrics,
  makeOrder,
  makePaginated,
  makeStudentDetail,
  makeStudentSummary,
  makeUser,
  ok,
} from '@/test/factories'
import { api, setUnauthorizedHandler } from './client'

type Call = {
  url: string
  method: string
  body: unknown
  headers: Record<string, string> | undefined
}

let calls: Call[] = []
let next: { status: number; body: unknown } = { status: 200, body: ok(null) }

beforeEach(() => {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(init.body as string) : undefined,
        headers: init.headers as Record<string, string> | undefined,
      })
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
})

function respond(data: unknown, status = 200) {
  next = { status, body: ok(data) }
}

const child = makeChild()
const order = makeOrder()
const section = makeCmsSection()

/** [name, invoke, expected method, expected url, response data, expected body] */
const CASES: [string, () => Promise<unknown>, string, string, unknown, unknown?][] = [
  ['health', () => api.health(), 'GET', '/api/health', makeHealth()],
  [
    'getCmsPage',
    () => api.getCmsPage('who-we-are'),
    'GET',
    '/api/cms/who-we-are',
    makeCmsPage('who-we-are'),
  ],
  ['listClasses', () => api.listClasses({ age: 4 }), 'GET', '/api/classes?age=4', makeClassList()],
  ['getClass', () => api.getClass(1), 'GET', '/api/classes/1', makeClass()],
  [
    'listKits',
    () => api.listKits({ category: 'MATH' }),
    'GET',
    '/api/kits?category=MATH',
    [makeKit()],
  ],
  ['getKit', () => api.getKit(1), 'GET', '/api/kits/1', makeKit()],
  [
    'register',
    () =>
      api.register({
        parent: { full_name: 'N', email: 'e', phone_wa: 'p', password: 'x' },
        child: { name: 'A', dob: '2020-04-15' },
      }),
    'POST',
    '/api/auth/register',
    { user: makeUser(), child },
    {
      parent: { full_name: 'N', email: 'e', phone_wa: 'p', password: 'x' },
      child: { name: 'A', dob: '2020-04-15' },
    },
  ],
  [
    'login',
    () => api.login({ email: 'e', password: 'p' }),
    'POST',
    '/api/auth/login',
    { user: makeUser() },
    { email: 'e', password: 'p' },
  ],
  ['logout', () => api.logout(), 'POST', '/api/auth/logout', null],
  ['me', () => api.me(), 'GET', '/api/auth/me', { user: null }],
  [
    'forgotPassword',
    () => api.forgotPassword({ email: 'e' }),
    'POST',
    '/api/auth/forgot-password',
    null,
    { email: 'e' },
  ],
  [
    'resetPassword',
    () => api.resetPassword({ token: 't', password: 'p' }),
    'POST',
    '/api/auth/reset-password',
    null,
    { token: 't', password: 'p' },
  ],
  ['listChildren', () => api.listChildren(), 'GET', '/api/me/children', [child]],
  [
    'createChild',
    () => api.createChild({ name: 'A', dob: '2020-04-15' }),
    'POST',
    '/api/me/children',
    child,
    { name: 'A', dob: '2020-04-15' },
  ],
  [
    'updateChild',
    () => api.updateChild(1, { notes: null }),
    'PATCH',
    '/api/me/children/1',
    child,
    { notes: null },
  ],
  ['deleteChild', () => api.deleteChild(1), 'DELETE', '/api/me/children/1', null],
  [
    'listChildAssessments',
    () => api.listChildAssessments(1),
    'GET',
    '/api/me/children/1/assessments',
    [makeAssessment()],
  ],
  [
    'listChildEnrollments',
    () => api.listChildEnrollments(1),
    'GET',
    '/api/me/children/1/enrollments',
    [makeEnrollment()],
  ],
  [
    'getChildReport',
    () => api.getChildReport(1),
    'GET',
    '/api/me/children/1/report',
    makeChildReport(),
  ],
  ['listMyOrders', () => api.listMyOrders(), 'GET', '/api/me/orders', [order]],
  [
    'checkout',
    () =>
      api.checkout({
        idempotency_key: 'k',
        items: [{ type: 'KIT', kit_id: 1, quantity: 2 }],
        delivery: { name: 'N', phone_wa: 'p', address: 'a' },
      }),
    'POST',
    '/api/orders',
    makeCheckoutResult(order),
    {
      idempotency_key: 'k',
      items: [{ type: 'KIT', kit_id: 1, quantity: 2 }],
      delivery: { name: 'N', phone_wa: 'p', address: 'a' },
    },
  ],
  ['adminMetrics', () => api.adminMetrics(), 'GET', '/api/admin/metrics', makeMetrics()],
  [
    'adminListCms',
    () => api.adminListCms({ page_slug: 'home' }),
    'GET',
    '/api/admin/cms?page_slug=home',
    [section],
  ],
  [
    'adminCreateCms',
    () => api.adminCreateCms({ page_slug: 'home', section_key: 'hero', body: {} }),
    'POST',
    '/api/admin/cms',
    section,
    { page_slug: 'home', section_key: 'hero', body: {} },
  ],
  [
    'adminUpdateCms',
    () => api.adminUpdateCms(1, { is_active: false }),
    'PATCH',
    '/api/admin/cms/1',
    section,
    { is_active: false },
  ],
  ['adminDeleteCms', () => api.adminDeleteCms(1), 'DELETE', '/api/admin/cms/1', null],
  [
    'adminListClasses',
    () => api.adminListClasses({ status: 'DRAFT' }),
    'GET',
    '/api/admin/classes?status=DRAFT',
    [makeClass()],
  ],
  [
    'adminCreateClass',
    () =>
      api.adminCreateClass({
        title: 't',
        description: 'd',
        location: 'l',
        age_min: 3,
        age_max: 6,
        date: '2026-12-12',
        start_time: '09:30',
        end_time: '11:30',
        fee_idr: 1,
        capacity: 12,
      }),
    'POST',
    '/api/admin/classes',
    makeClass(),
    {
      title: 't',
      description: 'd',
      location: 'l',
      age_min: 3,
      age_max: 6,
      date: '2026-12-12',
      start_time: '09:30',
      end_time: '11:30',
      fee_idr: 1,
      capacity: 12,
    },
  ],
  [
    'adminUpdateClass',
    () => api.adminUpdateClass(1, { status: 'OPEN' }),
    'PATCH',
    '/api/admin/classes/1',
    makeClass(),
    { status: 'OPEN' },
  ],
  ['adminDeleteClass', () => api.adminDeleteClass(1), 'DELETE', '/api/admin/classes/1', null],
  ['adminListKits', () => api.adminListKits(), 'GET', '/api/admin/kits', [makeKit()]],
  [
    'adminCreateKit',
    () =>
      api.adminCreateKit({ name: 'n', category: 'MATH', description: 'd', price_idr: 1, stock: 1 }),
    'POST',
    '/api/admin/kits',
    makeKit(),
    { name: 'n', category: 'MATH', description: 'd', price_idr: 1, stock: 1 },
  ],
  [
    'adminUpdateKit',
    () => api.adminUpdateKit(1, { stock: 3 }),
    'PATCH',
    '/api/admin/kits/1',
    makeKit(),
    { stock: 3 },
  ],
  ['adminDeleteKit', () => api.adminDeleteKit(1), 'DELETE', '/api/admin/kits/1', null],
  [
    'adminListStudents',
    () => api.adminListStudents({ q: 'ami', page: 2 }),
    'GET',
    '/api/admin/students?q=ami&page=2',
    makePaginated([makeStudentSummary()]),
  ],
  [
    'adminGetStudent',
    () => api.adminGetStudent(1),
    'GET',
    '/api/admin/students/1',
    makeStudentDetail(),
  ],
  [
    'adminCreateAssessment',
    () =>
      api.adminCreateAssessment({
        child_id: 1,
        domain: 'MATH',
        level: 2,
        milestone: 'm',
        observed_on: '2026-10-24',
      }),
    'POST',
    '/api/admin/assessments',
    makeAssessment(),
    { child_id: 1, domain: 'MATH', level: 2, milestone: 'm', observed_on: '2026-10-24' },
  ],
  [
    'adminUpdateEnrollment',
    () => api.adminUpdateEnrollment(1, { status: 'ATTENDED' }),
    'PATCH',
    '/api/admin/enrollments/1',
    makeEnrollment({ status: 'ATTENDED' }),
    { status: 'ATTENDED' },
  ],
  [
    'adminListOrders',
    () => api.adminListOrders({ status: 'PENDING_WA' }),
    'GET',
    '/api/admin/orders?status=PENDING_WA',
    makePaginated([order]),
  ],
  [
    'adminUpdateOrderStatus',
    () => api.adminUpdateOrderStatus(1, { status: 'PAID' }),
    'PATCH',
    '/api/admin/orders/1/status',
    makeOrder({ status: 'PAID' }),
    { status: 'PAID' },
  ],
]

describe('api client (PRD §5.8 — 40 endpoints)', () => {
  it('covers every endpoint in the index', () => {
    expect(CASES).toHaveLength(40)
    expect(new Set(CASES.map(([name]) => name)).size).toBe(Object.keys(api).length)
  })

  it.each(CASES)('%s → %s %s', async (_name, invoke, method, url, data, body) => {
    respond(data)
    await expect(invoke()).resolves.toEqual(data)
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe(method)
    expect(calls[0].url).toBe(url)
    expect(calls[0].body).toEqual(body)
    expect(calls[0].headers?.['Content-Type']).toBe(
      body === undefined ? undefined : 'application/json',
    )
  })

  it('runs the unauthorized handler on `unauthorized` only', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    next = { status: 401, body: fail('unauthorized', 'Silakan masuk terlebih dahulu.') }
    await expect(api.listChildren()).rejects.toMatchObject({ code: 'unauthorized' })
    expect(handler).toHaveBeenCalledTimes(1)

    next = { status: 401, body: fail('invalid_credentials', 'Email atau kata sandi salah.') }
    await expect(api.login({ email: 'e', password: 'p' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fail when no handler is registered', async () => {
    next = { status: 401, body: fail('unauthorized', 'x') }
    await expect(api.adminMetrics()).rejects.toMatchObject({ status: 401 })
  })
})
