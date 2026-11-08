/**
 * In-memory state + domain rules for the e2e mock backend (PRD §5.9 in
 * miniature): server-authoritative checkout (prices from the store, stock and
 * seats reserved, idempotent replay), the order state machine and metrics.
 * Every DTO comes from the shared factories, so e2e/contract.spec.ts keeps it
 * honest against the zod schemas.
 */
import type {
  Assessment,
  CheckoutBody,
  Child,
  CmsPage,
  CmsSection,
  Enrollment,
  Metrics,
  Order,
  OrderItem,
  OrderStatus,
  PageSlug,
  PlayKit,
  User,
  WeekendClass,
} from '../../src/api/schemas'
import {
  makeAdmin,
  makeAssessment,
  makeChild,
  makeCmsPage,
  makeEnrollment,
  makeMetrics,
  makeOrder,
  makeUser,
  makeWaUrl,
  NOW,
  SEED_CLASSES,
  SEED_KITS,
} from '../../src/test/factories'
import { formatDateLong, formatRupiah } from '../../src/lib/format'

export const PARENT_PASSWORD = 'rumi-parent-123'
export const ADMIN_PASSWORD = 'rumi-admin-123'
export const RESET_TOKEN = 'valid-reset-token'
/** `MAX_PENDING_ORDERS_PER_PARENT` default (PRD §5.9.1 step 5, §5.10). */
export const MAX_PENDING_ORDERS = 3

export interface Account {
  user: User
  password: string
}

export interface MockState {
  session: User | null
  accounts: Account[]
  children: Child[]
  classes: WeekendClass[]
  kits: PlayKit[]
  cms: CmsSection[]
  orders: Order[]
  enrollments: Enrollment[]
  assessments: Assessment[]
  nextId: number
  orderSeq: number
  /** `${parent_id}:${idempotency_key}` → order id (PRD §5.9.1 replay). */
  idempotency: Record<string, number>
}

export interface MockSeed {
  as?: 'PARENT' | 'ADMIN' | null
  classes?: WeekendClass[]
  kits?: PlayKit[]
  children?: Child[]
  orders?: Order[]
  enrollments?: Enrollment[]
  assessments?: Assessment[]
  cms?: Partial<Record<PageSlug, CmsPage>>
}

export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export function createMockState(seed: MockSeed = {}): MockState {
  const parent = makeUser()
  const admin = makeAdmin()
  const pages: PageSlug[] = ['home', 'who-we-are', 'our-approach']
  return {
    session: seed.as === 'PARENT' ? parent : seed.as === 'ADMIN' ? admin : null,
    accounts: [
      { user: parent, password: PARENT_PASSWORD },
      { user: admin, password: ADMIN_PASSWORD },
    ],
    children: seed.children ?? [makeChild()],
    classes: seed.classes ?? SEED_CLASSES.map((c) => ({ ...c })),
    kits: seed.kits ?? SEED_KITS.map((k) => ({ ...k })),
    cms: pages.flatMap((slug) => (seed.cms?.[slug] ?? makeCmsPage(slug)).sections),
    orders: seed.orders ?? [],
    enrollments: seed.enrollments ?? [
      makeEnrollment({
        status: 'ATTENDED',
        class_date: '2026-01-17',
        class_title: 'Mengenal Syukur',
      }),
    ],
    assessments: seed.assessments ?? [makeAssessment()],
    nextId: 100,
    orderSeq: 0,
    idempotency: {},
  }
}

export function nextId(state: MockState): number {
  state.nextId += 1
  return state.nextId
}

function itemsFor(state: MockState, body: CheckoutBody): OrderItem[] {
  return body.items.map((item, index) => {
    if (item.type === 'KIT') {
      const kit = state.kits.find((k) => k.id === item.kit_id && k.is_active)
      if (!kit) throw new MockError(409, 'item_unavailable', 'Kit sudah tidak tersedia.')
      if (kit.stock < item.quantity) {
        throw new MockError(
          409,
          'out_of_stock',
          `Stok ${kit.name} tidak mencukupi (tersisa ${kit.stock}).`,
        )
      }
      return {
        id: index + 1,
        type: 'KIT',
        name: kit.name,
        kit_id: kit.id,
        class_id: null,
        child_id: null,
        child_name: null,
        class_date: null,
        class_time_slot: null,
        class_location: null,
        enrollment_status: null,
        unit_price_idr: kit.price_idr,
        quantity: item.quantity,
        line_total_idr: kit.price_idr * item.quantity,
      }
    }
    const cls = state.classes.find(
      (c) => c.id === item.class_id && c.status === 'OPEN' && c.is_upcoming,
    )
    if (!cls) throw new MockError(409, 'item_unavailable', 'Kelas sudah tidak tersedia.')
    const child = state.children.find((c) => c.id === item.child_id)
    if (!child) throw new MockError(404, 'not_found', 'Data anak tidak ditemukan.')
    if (cls.seats_left <= 0)
      throw new MockError(409, 'class_full', `Kelas ${cls.title} sudah penuh.`)
    return {
      id: index + 1,
      type: 'CLASS',
      name: cls.title,
      kit_id: null,
      class_id: cls.id,
      child_id: child.id,
      child_name: child.name,
      class_date: cls.date,
      class_time_slot: cls.time_slot,
      class_location: cls.location,
      enrollment_status: 'RESERVED',
      unit_price_idr: cls.fee_idr,
      quantity: 1,
      line_total_idr: cls.fee_idr,
    }
  })
}

function adjustSeats(state: MockState, classId: number, delta: number): void {
  state.classes = state.classes.map((c) => {
    if (c.id !== classId) return c
    const seatsBooked = c.seats_booked + delta
    const seatsLeft = c.capacity - seatsBooked
    return { ...c, seats_booked: seatsBooked, seats_left: seatsLeft, is_full: seatsLeft === 0 }
  })
}

function adjustStock(state: MockState, kitId: number, delta: number): void {
  state.kits = state.kits.map((k) => (k.id === kitId ? { ...k, stock: k.stock + delta } : k))
}

/** The PRD §5.9.3 WhatsApp message (mock fidelity: same lines, same order). */
export function waMessage(
  code: string,
  user: User,
  items: OrderItem[],
  body: CheckoutBody,
): string {
  const total = items.reduce((sum, i) => sum + i.line_total_idr, 0)
  const children = [...new Set(items.flatMap((i) => (i.child_name ? [i.child_name] : [])))]
  const address = items.some((i) => i.type === 'KIT') ? (body.delivery.address ?? null) : null
  const lines = items.map((i) =>
    i.type === 'CLASS'
      ? `- Kelas ${i.name} (${i.child_name}) · ${formatDateLong(i.class_date ?? '')} · ${i.class_time_slot} WIB · ${i.class_location} · ${formatRupiah(i.line_total_idr)}`
      : `- Kit ${i.name} ×${i.quantity} · ${formatRupiah(i.line_total_idr)}`,
  )
  return [
    `Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #${code}.`,
    '',
    `Nama Orang Tua: ${user.full_name}`,
    `Nama Anak: ${children.length > 0 ? children.join(', ') : '-'}`,
    `No. WhatsApp: ${body.delivery.phone_wa}`,
    `Total: ${formatRupiah(total)}`,
    '',
    'Detail:',
    ...lines,
    '',
    `Penerima: ${body.delivery.name}`,
    ...(address ? [`Alamat: ${address}`] : []),
    ...(body.notes ? [`Catatan: ${body.notes}`] : []),
    '',
    'Mohon info pembayarannya. Terima kasih.',
  ].join('\n')
}

/** POST /api/orders: server-authoritative; returns [status, order]. */
export function checkout(state: MockState, user: User, body: CheckoutBody): [201 | 200, Order] {
  const replayKey = `${user.id}:${body.idempotency_key.toLowerCase()}`
  const replay = state.orders.find((o) => o.id === state.idempotency[replayKey])
  if (replay) return [200, replay]
  // The replay is answered first; only then the PENDING_WA cap (§5.9.1 step 5).
  const pending = state.orders.filter(
    (o) => o.parent_id === user.id && o.status === 'PENDING_WA',
  ).length
  if (pending >= MAX_PENDING_ORDERS) {
    throw new MockError(
      409,
      'too_many_pending_orders',
      `Anda masih memiliki ${pending} pesanan yang menunggu konfirmasi. Selesaikan atau tunggu konfirmasi pesanan tersebut sebelum membuat pesanan baru.`,
    )
  }
  const items = itemsFor(state, body)
  for (const item of items) {
    if (item.kit_id !== null) adjustStock(state, item.kit_id, -item.quantity)
    if (item.class_id !== null) adjustSeats(state, item.class_id, 1)
  }
  state.orderSeq += 1
  const code = `RUMI-2026-${String(state.orderSeq).padStart(4, '0')}`
  const order = makeOrder({
    id: nextId(state),
    order_code: code,
    parent_id: user.id,
    parent_name: user.full_name,
    parent_email: user.email,
    items,
    delivery_name: body.delivery.name,
    delivery_phone: body.delivery.phone_wa,
    delivery_address: items.some((i) => i.type === 'KIT') ? (body.delivery.address ?? null) : null,
    notes: body.notes ?? null,
    wa_url: makeWaUrl(waMessage(code, user, items, body)),
  })
  state.orders = [order, ...state.orders]
  state.idempotency = { ...state.idempotency, [replayKey]: order.id }
  state.enrollments = [
    ...items
      .filter((i) => i.type === 'CLASS')
      .map((i) =>
        makeEnrollment({
          id: nextId(state),
          class_id: i.class_id ?? 0,
          class_title: i.name,
          class_date: i.class_date ?? '',
          class_time_slot: i.class_time_slot ?? '',
          class_location: i.class_location ?? '',
          child_id: i.child_id ?? 0,
          child_name: i.child_name ?? '',
          order_id: order.id,
          order_code: code,
          status: 'RESERVED',
        }),
      ),
    ...state.enrollments,
  ]
  return [201, order]
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_WA: ['PAID', 'CANCELLED'],
  PAID: ['CANCELLED'],
  CANCELLED: [],
}

/** PATCH /api/admin/orders/{id}/status (PRD §5.9.4). */
export function transitionOrder(state: MockState, orderId: number, to: OrderStatus): Order {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order) throw new MockError(404, 'not_found', 'Data tidak ditemukan.')
  if (!TRANSITIONS[order.status].includes(to)) {
    throw new MockError(
      409,
      'invalid_transition',
      `Status tidak dapat diubah dari ${order.status} ke ${to}.`,
    )
  }
  const enrollmentStatus = to === 'PAID' ? 'CONFIRMED' : 'CANCELLED'
  if (to === 'CANCELLED') {
    for (const item of order.items) {
      if (item.kit_id !== null) adjustStock(state, item.kit_id, item.quantity)
      if (item.class_id !== null) adjustSeats(state, item.class_id, -1)
    }
  }
  state.enrollments = state.enrollments.map((e) =>
    e.order_id === order.id && (e.status === 'RESERVED' || e.status === 'CONFIRMED')
      ? { ...e, status: enrollmentStatus }
      : e,
  )
  const updated: Order = {
    ...order,
    status: to,
    expires_at: null,
    paid_at: to === 'PAID' ? NOW : order.paid_at,
    cancelled_at: to === 'CANCELLED' ? NOW : null,
    items: order.items.map((i) =>
      i.type === 'CLASS' &&
      (i.enrollment_status === 'RESERVED' || i.enrollment_status === 'CONFIRMED')
        ? { ...i, enrollment_status: enrollmentStatus }
        : i,
    ),
  }
  state.orders = state.orders.map((o) => (o.id === orderId ? updated : o))
  return updated
}

/** GET /api/admin/metrics computed from the mock state (real aggregates only). */
export function computeMetrics(state: MockState): Metrics {
  const paid = state.orders.filter((o) => o.status === 'PAID')
  const pending = state.orders.filter((o) => o.status === 'PENDING_WA')
  const sum = (orders: Order[]) => orders.reduce((n, o) => n + o.total_amount_idr, 0)
  return makeMetrics({
    total_revenue_idr: sum(paid),
    paid_orders: paid.length,
    pending_orders: pending.length,
    pending_amount_idr: sum(pending),
    enrolled_students: new Set(
      state.enrollments
        .filter((e) => ['CONFIRMED', 'ATTENDED', 'ABSENT'].includes(e.status))
        .map((e) => e.child_id),
    ).size,
    low_stock_kits: state.kits
      .filter((k) => k.is_active && k.stock <= 5)
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
      .map(({ id, name, category, stock }) => ({ id, name, category, stock })),
  })
}
