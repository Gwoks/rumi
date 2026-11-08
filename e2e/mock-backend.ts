/**
 * In-spec PRD §5 mock backend for Playwright. `page.route('**\/api/**')`
 * fulfils all 40 §5.8 endpoints with the `{ success, data, error }` envelope,
 * the §5.3.1 access rules (401 `unauthorized` / 403 `forbidden`) and the §5.2
 * error codes, backed by a mutable in-memory store (e2e/support/mock-store.ts)
 * so journeys can mutate (login, checkout, mark PAID) and read back.
 *
 *   const mock = await installMockBackend(page, { as: 'PARENT' })
 *   ...
 *   expect(mock.calls.find((c) => c.path === '/api/orders')?.body).toEqual(...)
 *
 * `failures` forces an error for one route key ('POST /api/orders'), and
 * `mock.state` is the live store for assertions.
 */
import type { Page, Route } from '@playwright/test'
import type { CheckoutBody, OrderStatus, PageSlug, RegisterBody } from '../src/api/schemas'
import {
  fail,
  makeChild,
  makeChildReport,
  makeHealth,
  makePaginated,
  makeStudentDetail,
  makeStudentSummary,
  makeUser,
  NOW,
  ok,
} from '../src/test/factories'
import {
  checkout,
  computeMetrics,
  createMockState,
  MockError,
  nextId,
  RESET_TOKEN,
  transitionOrder,
  type MockSeed,
  type MockState,
} from './support/mock-store'

export {
  ADMIN_PASSWORD,
  MAX_PENDING_ORDERS,
  PARENT_PASSWORD,
  RESET_TOKEN,
} from './support/mock-store'

export interface MockFailure {
  status: number
  code: string
  error?: string
  fields?: Record<string, string>
  retryAfter?: number
}

export interface MockOptions extends MockSeed {
  /** Force an error for `'METHOD /api/path'` (exact path, no query). */
  failures?: Record<string, MockFailure>
}

export interface MockCall {
  method: string
  path: string
  query: Record<string, string>
  body: unknown
}

export interface MockBackend {
  state: MockState
  calls: MockCall[]
}

interface Ctx {
  state: MockState
  params: string[]
  query: URLSearchParams
  body: unknown
}

type Access = 'public' | 'PARENT' | 'ADMIN'
/** A handler result with a non-200 success status (201 created, 200 replay). */
class WithStatus {
  constructor(
    readonly status: number,
    readonly data: unknown,
  ) {}
}
type Handler = (ctx: Ctx) => unknown

const PAGES: PageSlug[] = ['home', 'who-we-are', 'our-approach']

const notFound = () => new MockError(404, 'not_found', 'Data tidak ditemukan.')
const withStatus = (status: number, data: unknown) => new WithStatus(status, data)
const num = (value: string) => Number.parseInt(value, 10)
const byId = <T extends { id: number }>(list: T[], id: string): T => {
  const found = list.find((item) => item.id === num(id))
  if (!found) throw notFound()
  return found
}
const patchList = <T extends { id: number }>(list: T[], id: string, patch: object): [T[], T] => {
  const updated = { ...byId(list, id), ...patch, updated_at: NOW } as T
  return [list.map((item) => (item.id === updated.id ? updated : item)), updated]
}

function publicClasses(ctx: Ctx) {
  const { query, state } = ctx
  const location = query.get('location')?.toLowerCase()
  const from = query.get('from')
  const to = query.get('to')
  const age = query.get('age')
  const listable = state.classes.filter((c) => c.status === 'OPEN' && c.is_upcoming)
  const items = listable.filter(
    (c) =>
      (!location || c.location.toLowerCase() === location) &&
      (!from || c.date >= from) &&
      (!to || c.date <= to) &&
      (!age || (c.age_min <= num(age) && num(age) <= c.age_max)),
  )
  const locations = [...new Set(listable.map((c) => c.location))].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )
  return { items, locations }
}

const ROUTES: [string, RegExp, Access, Handler][] = [
  // ── Public ──
  ['GET', /^\/api\/health$/, 'public', () => makeHealth()],
  [
    'GET',
    /^\/api\/cms\/([^/]+)$/,
    'public',
    ({ state, params }) => {
      if (!PAGES.includes(params[0] as PageSlug)) throw notFound()
      const sections = state.cms.filter((s) => s.page_slug === params[0] && s.is_active)
      return {
        page_slug: params[0],
        sections: [...sections].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      }
    },
  ],
  ['GET', /^\/api\/classes$/, 'public', publicClasses],
  [
    'GET',
    /^\/api\/classes\/(\d+)$/,
    'public',
    ({ state, params }) =>
      byId(
        state.classes.filter((c) => c.status !== 'DRAFT'),
        params[0],
      ),
  ],
  [
    'GET',
    /^\/api\/kits$/,
    'public',
    ({ state, query }) =>
      state.kits.filter(
        (k) => k.is_active && (!query.get('category') || k.category === query.get('category')),
      ),
  ],
  [
    'GET',
    /^\/api\/kits\/(\d+)$/,
    'public',
    ({ state, params }) =>
      byId(
        state.kits.filter((k) => k.is_active),
        params[0],
      ),
  ],

  // ── Auth ──
  [
    'POST',
    /^\/api\/auth\/register$/,
    'public',
    ({ state, body }) => {
      const { parent, child } = body as RegisterBody
      const email = parent.email.trim().toLowerCase()
      if (state.accounts.some((a) => a.user.email === email)) {
        throw new MockError(409, 'email_taken', 'Email sudah terdaftar. Silakan masuk.')
      }
      const user = makeUser({
        id: nextId(state),
        email,
        full_name: parent.full_name,
        phone_wa: parent.phone_wa,
      })
      const created = makeChild({
        id: nextId(state),
        parent_id: user.id,
        name: child.name,
        dob: child.dob,
        notes: child.notes ?? null,
      })
      state.accounts = [...state.accounts, { user, password: parent.password }]
      state.children = [...state.children, created]
      state.session = user
      return withStatus(201, { user, child: created })
    },
  ],
  [
    'POST',
    /^\/api\/auth\/login$/,
    'public',
    ({ state, body }) => {
      const { email, password } = body as { email: string; password: string }
      const account = state.accounts.find(
        (a) => a.user.email === email.trim().toLowerCase() && a.password === password,
      )
      if (!account) throw new MockError(401, 'invalid_credentials', 'Email atau kata sandi salah.')
      state.session = account.user
      return { user: account.user }
    },
  ],
  [
    'POST',
    /^\/api\/auth\/logout$/,
    'public',
    ({ state }) => {
      state.session = null
      return null
    },
  ],
  ['GET', /^\/api\/auth\/me$/, 'public', ({ state }) => ({ user: state.session })],
  ['POST', /^\/api\/auth\/forgot-password$/, 'public', () => null],
  [
    'POST',
    /^\/api\/auth\/reset-password$/,
    'public',
    ({ state, body }) => {
      if ((body as { token: string }).token !== RESET_TOKEN) {
        throw new MockError(
          422,
          'invalid_token',
          'Tautan reset tidak valid atau sudah kedaluwarsa.',
        )
      }
      state.session = null
      return null
    },
  ],

  // ── Parent ──
  [
    'GET',
    /^\/api\/me\/children$/,
    'PARENT',
    ({ state }) => state.children.filter((c) => c.parent_id === state.session?.id),
  ],
  [
    'POST',
    /^\/api\/me\/children$/,
    'PARENT',
    ({ state, body }) => {
      const input = body as { name: string; dob: string; notes?: string | null }
      const child = makeChild({
        id: nextId(state),
        parent_id: state.session?.id,
        name: input.name,
        dob: input.dob,
        notes: input.notes ?? null,
      })
      state.children = [...state.children, child]
      return withStatus(201, child)
    },
  ],
  [
    'PATCH',
    /^\/api\/me\/children\/(\d+)$/,
    'PARENT',
    ({ state, params, body }) => {
      const [children, child] = patchList(state.children, params[0], body as object)
      state.children = children
      return child
    },
  ],
  [
    'DELETE',
    /^\/api\/me\/children\/(\d+)$/,
    'PARENT',
    ({ state, params }) => {
      byId(state.children, params[0])
      state.children = state.children.filter((c) => c.id !== num(params[0]))
      return null
    },
  ],
  [
    'GET',
    /^\/api\/me\/children\/(\d+)\/assessments$/,
    'PARENT',
    ({ state, params }) =>
      state.assessments.filter((a) => a.child_id === byId(state.children, params[0]).id),
  ],
  [
    'GET',
    /^\/api\/me\/children\/(\d+)\/enrollments$/,
    'PARENT',
    ({ state, params }) =>
      state.enrollments.filter((e) => e.child_id === byId(state.children, params[0]).id),
  ],
  [
    'GET',
    /^\/api\/me\/children\/(\d+)\/report$/,
    'PARENT',
    ({ state, params }) => {
      const child = byId(state.children, params[0])
      return makeChildReport({
        child,
        assessments: state.assessments.filter((a) => a.child_id === child.id),
        enrollments: state.enrollments.filter((e) => e.child_id === child.id),
      })
    },
  ],
  [
    'GET',
    /^\/api\/me\/orders$/,
    'PARENT',
    ({ state }) => state.orders.filter((o) => o.parent_id === state.session?.id),
  ],
  [
    'POST',
    /^\/api\/orders$/,
    'PARENT',
    ({ state, body }) => {
      const [status, order] = checkout(state, state.session ?? makeUser(), body as CheckoutBody)
      return withStatus(status, { order, wa_url: order.wa_url })
    },
  ],

  // ── Admin ──
  ['GET', /^\/api\/admin\/metrics$/, 'ADMIN', ({ state }) => computeMetrics(state)],
  [
    'GET',
    /^\/api\/admin\/cms$/,
    'ADMIN',
    ({ state, query }) =>
      state.cms.filter((s) => !query.get('page_slug') || s.page_slug === query.get('page_slug')),
  ],
  [
    'POST',
    /^\/api\/admin\/cms$/,
    'ADMIN',
    ({ state, body }) => {
      const section = {
        id: nextId(state),
        title: null,
        image_url: null,
        sort_order: 0,
        is_active: true,
        created_at: NOW,
        updated_at: NOW,
        ...(body as object),
      }
      state.cms = [...state.cms, section as MockState['cms'][number]]
      return withStatus(201, section)
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/cms\/(\d+)$/,
    'ADMIN',
    ({ state, params, body }) => {
      const [cms, section] = patchList(state.cms, params[0], body as object)
      state.cms = cms
      return section
    },
  ],
  [
    'DELETE',
    /^\/api\/admin\/cms\/(\d+)$/,
    'ADMIN',
    ({ state, params }) => {
      byId(state.cms, params[0])
      state.cms = state.cms.filter((s) => s.id !== num(params[0]))
      return null
    },
  ],
  [
    'GET',
    /^\/api\/admin\/classes$/,
    'ADMIN',
    ({ state, query }) =>
      state.classes.filter((c) => !query.get('status') || c.status === query.get('status')),
  ],
  [
    'POST',
    /^\/api\/admin\/classes$/,
    'ADMIN',
    ({ state, body }) => {
      const input = body as Record<string, unknown>
      const cls = {
        ...state.classes[0],
        id: nextId(state),
        seats_booked: 0,
        status: 'DRAFT',
        ...input,
      }
      const seatsLeft = Number(cls.capacity) - cls.seats_booked
      const created = {
        ...cls,
        seats_left: seatsLeft,
        is_full: seatsLeft === 0,
        age_range: `${cls.age_min}–${cls.age_max}`,
        time_slot: `${cls.start_time}–${cls.end_time}`,
      }
      state.classes = [...state.classes, created as MockState['classes'][number]]
      return withStatus(201, created)
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/classes\/(\d+)$/,
    'ADMIN',
    ({ state, params, body }) => {
      const [classes, cls] = patchList(state.classes, params[0], body as object)
      state.classes = classes
      return cls
    },
  ],
  [
    'DELETE',
    /^\/api\/admin\/classes\/(\d+)$/,
    'ADMIN',
    ({ state, params }) => {
      byId(state.classes, params[0])
      state.classes = state.classes.filter((c) => c.id !== num(params[0]))
      return null
    },
  ],
  [
    'GET',
    /^\/api\/admin\/kits$/,
    'ADMIN',
    ({ state, query }) =>
      state.kits.filter((k) => !query.get('category') || k.category === query.get('category')),
  ],
  [
    'POST',
    /^\/api\/admin\/kits$/,
    'ADMIN',
    ({ state, body }) => {
      const kit = {
        ...state.kits[0],
        id: nextId(state),
        badge_tag: null,
        image_url: null,
        is_active: true,
        created_at: NOW,
        updated_at: NOW,
        ...(body as object),
      }
      state.kits = [kit as MockState['kits'][number], ...state.kits]
      return withStatus(201, kit)
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/kits\/(\d+)$/,
    'ADMIN',
    ({ state, params, body }) => {
      const [kits, kit] = patchList(state.kits, params[0], body as object)
      state.kits = kits
      return kit
    },
  ],
  [
    'DELETE',
    /^\/api\/admin\/kits\/(\d+)$/,
    'ADMIN',
    ({ state, params }) => {
      byId(state.kits, params[0])
      state.kits = state.kits.filter((k) => k.id !== num(params[0]))
      return null
    },
  ],
  [
    'GET',
    /^\/api\/admin\/students$/,
    'ADMIN',
    ({ state, query }) => {
      const q = (query.get('q') ?? '').trim().toLowerCase()
      const students = state.children
        .map((c) => {
          const parent = state.accounts.find((a) => a.user.id === c.parent_id)?.user ?? makeUser()
          return makeStudentSummary({
            id: c.id,
            name: c.name,
            dob: c.dob,
            age_years: c.age_years,
            parent_id: parent.id,
            parent_name: parent.full_name,
            parent_email: parent.email,
            parent_phone_wa: parent.phone_wa,
          })
        })
        .filter(
          (s) =>
            !q || [s.name, s.parent_name, s.parent_email].some((v) => v.toLowerCase().includes(q)),
        )
      return makePaginated(
        students,
        num(query.get('page') ?? '1'),
        num(query.get('per_page') ?? '20'),
      )
    },
  ],
  [
    'GET',
    /^\/api\/admin\/students\/(\d+)$/,
    'ADMIN',
    ({ state, params }) => {
      const child = byId(state.children, params[0])
      return makeStudentDetail({
        child,
        assessments: state.assessments.filter((a) => a.child_id === child.id),
        enrollments: state.enrollments.filter((e) => e.child_id === child.id),
      })
    },
  ],
  [
    'POST',
    /^\/api\/admin\/assessments$/,
    'ADMIN',
    ({ state, body }) => {
      const input = body as Record<string, unknown>
      const assessment = {
        ...state.assessments[0],
        id: nextId(state),
        class_id: null,
        class_title: null,
        notes: null,
        assessor_id: state.session?.id ?? 1,
        assessor_name: state.session?.full_name ?? 'Admin RUMI',
        created_at: NOW,
        ...input,
      }
      state.assessments = [assessment as MockState['assessments'][number], ...state.assessments]
      return withStatus(201, assessment)
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/enrollments\/(\d+)$/,
    'ADMIN',
    ({ state, params, body }) => {
      const current = byId(state.enrollments, params[0])
      if (!['CONFIRMED', 'ATTENDED', 'ABSENT'].includes(current.status)) {
        throw new MockError(
          409,
          'invalid_transition',
          `Status tidak dapat diubah dari ${current.status}.`,
        )
      }
      const [enrollments, enrollment] = patchList(state.enrollments, params[0], body as object)
      state.enrollments = enrollments
      return enrollment
    },
  ],
  [
    'GET',
    /^\/api\/admin\/orders$/,
    'ADMIN',
    ({ state, query }) => {
      const q = (query.get('q') ?? '').trim().toLowerCase()
      const orders = state.orders.filter(
        (o) =>
          (!query.get('status') || o.status === query.get('status')) &&
          (!q ||
            [o.order_code, o.parent_name, o.parent_email].some((v) => v.toLowerCase().includes(q))),
      )
      return makePaginated(
        orders,
        num(query.get('page') ?? '1'),
        num(query.get('per_page') ?? '20'),
      )
    },
  ],
  [
    'PATCH',
    /^\/api\/admin\/orders\/(\d+)\/status$/,
    'ADMIN',
    ({ state, params, body }) =>
      transitionOrder(state, num(params[0]), (body as { status: OrderStatus }).status),
  ],
]

function checkAccess(state: MockState, access: Access): void {
  if (access === 'public') return
  if (!state.session) throw new MockError(401, 'unauthorized', 'Silakan masuk terlebih dahulu.')
  if (state.session.role !== access)
    throw new MockError(403, 'forbidden', 'Anda tidak memiliki akses.')
}

function respond(
  route: Route,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store', ...headers },
    body: JSON.stringify(body),
  })
}

function readBody(raw: string | null): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export async function installMockBackend(page: Page, opts: MockOptions = {}): Promise<MockBackend> {
  const backend: MockBackend = { state: createMockState(opts), calls: [] }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const body = readBody(request.postData())
    backend.calls.push({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body,
    })

    const forced = opts.failures?.[`${method} ${url.pathname}`]
    if (forced) {
      const headers: Record<string, string> = forced.retryAfter
        ? { 'Retry-After': String(forced.retryAfter) }
        : {}
      return respond(
        route,
        forced.status,
        fail(forced.code, forced.error ?? 'Terjadi kesalahan pada server.', forced.fields),
        headers,
      )
    }

    const match = ROUTES.map(([m, re, access, handler]) => ({
      m,
      access,
      handler,
      params: re.exec(url.pathname),
    })).find((r) => r.params !== null && r.m === method)
    if (!match?.params) return respond(route, 404, fail('not_found', 'Data tidak ditemukan.'))

    try {
      checkAccess(backend.state, match.access)
      const result = match.handler({
        state: backend.state,
        params: match.params.slice(1),
        query: url.searchParams,
        body,
      })
      const { status, data } = result instanceof WithStatus ? result : { status: 200, data: result }
      return respond(route, status, ok(data))
    } catch (err) {
      if (err instanceof MockError)
        return respond(route, err.status, fail(err.code, err.message, err.fields))
      return respond(route, 500, fail('internal', 'Terjadi kesalahan pada server.'))
    }
  })

  return backend
}
