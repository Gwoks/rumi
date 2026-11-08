/**
 * DTO factories typed from the zod schemas (PRD §5.6), seeded with the §5.11
 * catalog. Shared by Vitest units and the Playwright mock backend
 * (e2e/mock-backend.ts); e2e/contract.spec.ts validates every one of them
 * against the schemas, so a factory can never drift from the contract.
 * Pure data — no DOM, no Playwright, no React.
 */
import type {
  Assessment,
  AttendanceSummary,
  CheckoutResult,
  Child,
  ChildReport,
  ClassFill,
  ClassList,
  CmsPage,
  CmsSection,
  Domain,
  DomainLevel,
  Enrollment,
  Health,
  Metrics,
  Order,
  OrderItem,
  PageSlug,
  Paginated,
  PlayKit,
  StudentDetail,
  StudentSummary,
  User,
  WeekendClass,
} from '@/api/schemas'
import { DOMAIN_VALUES } from '@/api/enums'
import { CMS_SEED } from './cms-seed'

export const NOW = '2026-11-08T03:15:00Z'
export const ADMIN_PHONE = '6281234567890'

export function makeUser(over: Partial<User> = {}): User {
  return {
    id: 2,
    email: 'nadia@example.com',
    full_name: 'Nadia Rahman',
    phone_wa: '6281211112222',
    role: 'PARENT',
    created_at: NOW,
    ...over,
  }
}

export function makeAdmin(over: Partial<User> = {}): User {
  return makeUser({
    id: 1,
    email: 'admin@rumi.id',
    full_name: 'Admin RUMI',
    phone_wa: ADMIN_PHONE,
    role: 'ADMIN',
    ...over,
  })
}

export function makeChild(over: Partial<Child> = {}): Child {
  return {
    id: 1,
    parent_id: 2,
    name: 'Amina',
    dob: '2020-04-15',
    age_years: 6,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  }
}

export function makeCmsSection(over: Partial<CmsSection> = {}): CmsSection {
  return {
    id: 1,
    page_slug: 'home',
    section_key: 'hero',
    title: 'Hero Beranda',
    body: CMS_SEED.home.hero.body,
    image_url: null,
    sort_order: 10,
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  }
}

/** The seeded CMS page (PRD §5.11.3), sections in sort_order. */
export function makeCmsPage(pageSlug: PageSlug): CmsPage {
  const sections = Object.entries(CMS_SEED[pageSlug]).map(([sectionKey, seed], index) =>
    makeCmsSection({
      id: seed.id,
      page_slug: pageSlug,
      section_key: sectionKey,
      title: seed.title,
      body: seed.body,
      sort_order: (index + 1) * 10,
    }),
  )
  return { page_slug: pageSlug, sections }
}

export function makeClass(over: Partial<WeekendClass> = {}): WeekendClass {
  const base: WeekendClass = {
    id: 1,
    title: 'Bulan & Gerak',
    description:
      'Mengenal ciptaan Allah lewat gerak tubuh, lagu, dan kisah tentang bulan. Setelah bergerak dan bernyanyi, anak memilih kegiatan menuang dan memilah dengan tenang.',
    location: 'Rumah Teduh, Kemang (Jakarta Selatan)',
    image_url: null,
    age_min: 3,
    age_max: 6,
    age_range: '3–6',
    date: '2026-11-14',
    start_time: '09:30',
    end_time: '11:30',
    time_slot: '09:30–11:30',
    fee_idr: 200000,
    capacity: 12,
    seats_booked: 0,
    seats_left: 12,
    is_full: false,
    is_upcoming: true,
    status: 'OPEN',
    created_at: NOW,
    updated_at: NOW,
  }
  const merged = { ...base, ...over }
  const seatsLeft = Math.max(0, merged.capacity - merged.seats_booked)
  return {
    ...merged,
    age_range: `${merged.age_min}–${merged.age_max}`,
    time_slot: `${merged.start_time}–${merged.end_time}`,
    seats_left: seatsLeft,
    is_full: seatsLeft === 0,
  }
}

/** The §5.11.2 public classes (OPEN + upcoming; the DRAFT one is admin-only). */
export const SEED_CLASSES: readonly WeekendClass[] = [
  makeClass(),
  makeClass({
    id: 2,
    title: 'Tukang Kebun Cilik',
    location: 'Ruang Kenari, Bintaro (Tangerang Selatan)',
    date: '2026-11-21',
    fee_idr: 175000,
    description:
      'Menanam benih, menyiram, dan merawat tanaman kecil sambil belajar bersyukur atas rezeki dari bumi.',
  }),
  makeClass({
    id: 3,
    title: 'Dunia Kita yang Ramah',
    date: '2026-11-29',
    start_time: '14:00',
    end_time: '16:00',
    fee_idr: 150000,
    description:
      'Belajar adab berteman: menyapa dengan salam, menunggu giliran, dan berbagi material dengan lembut.',
  }),
  makeClass({
    id: 4,
    title: 'Suara & Pasir',
    location: 'Studio Bambu, BSD City (Tangerang Selatan)',
    date: '2026-12-05',
    fee_idr: 250000,
    description:
      'Bermain bunyi huruf, menulis di atas pasir, dan mengenal huruf hijaiyah lewat sentuhan.',
  }),
]

export function makeClassList(items: readonly WeekendClass[] = SEED_CLASSES): ClassList {
  const locations = [...new Set(SEED_CLASSES.map((c) => c.location))].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )
  return { items: [...items], locations }
}

export function makeKit(over: Partial<PlayKit> = {}): PlayKit {
  return {
    id: 1,
    name: 'Nampan Tangan Kecil',
    category: 'PRACTICAL_LIFE',
    description:
      'Nampan kayu yang cantik untuk kegiatan menuang, memilah, dan bekerja dengan fokus.',
    image_url: null,
    price_idr: 185000,
    stock: 12,
    badge_tag: 'Favorit',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  }
}

/** The §5.11.2 kits, newest first (the public order is created_at DESC, id DESC). */
export const SEED_KITS: readonly PlayKit[] = [
  makeKit({
    id: 4,
    name: 'Taman Berhitung',
    category: 'MATH',
    price_idr: 150000,
    stock: 16,
    badge_tag: null,
    description:
      'Taman manik-manik dan angka yang ceria untuk mengasah kepekaan bilangan secara langsung.',
  }),
  makeKit({
    id: 3,
    name: 'Set Suara & Pasir',
    category: 'SENSORIAL',
    price_idr: 225000,
    stock: 4,
    badge_tag: 'Baru',
    description:
      'Kartu huruf bertekstur dan permainan bunyi untuk pembaca cilik yang penuh rasa ingin tahu.',
  }),
  makeKit({
    id: 2,
    name: 'Kartu Bulan Gurun',
    category: 'ISLAMIC_STUDIES',
    price_idr: 120000,
    stock: 8,
    badge_tag: null,
    description:
      'Kartu percakapan lembut untuk menjelajahi rasa syukur, kebaikan, dan rasa takjub.',
  }),
  makeKit(),
]

export function makeKitOrderItem(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 1,
    type: 'KIT',
    name: 'Nampan Tangan Kecil',
    kit_id: 1,
    class_id: null,
    child_id: null,
    child_name: null,
    class_date: null,
    class_time_slot: null,
    class_location: null,
    enrollment_status: null,
    unit_price_idr: 185000,
    quantity: 2,
    line_total_idr: 370000,
    ...over,
  }
}

export function makeClassOrderItem(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 2,
    type: 'CLASS',
    name: 'Bulan & Gerak',
    kit_id: null,
    class_id: 1,
    child_id: 1,
    child_name: 'Amina',
    class_date: '2026-11-14',
    class_time_slot: '09:30–11:30',
    class_location: 'Rumah Teduh, Kemang (Jakarta Selatan)',
    enrollment_status: 'RESERVED',
    unit_price_idr: 200000,
    quantity: 1,
    line_total_idr: 200000,
    ...over,
  }
}

export function makeWaUrl(message: string, phone = ADMIN_PHONE): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`
}

export function makeOrder(over: Partial<Order> = {}): Order {
  const items = over.items ?? [makeClassOrderItem({ id: 1 }), makeKitOrderItem({ id: 2 })]
  const total = items.reduce((sum, item) => sum + item.line_total_idr, 0)
  const code = over.order_code ?? 'RUMI-2026-0001'
  return {
    id: 1,
    order_code: code,
    parent_id: 2,
    parent_name: 'Nadia Rahman',
    parent_email: 'nadia@example.com',
    status: 'PENDING_WA',
    total_amount_idr: total,
    delivery_name: 'Nadia Rahman',
    delivery_phone: '6281211112222',
    delivery_address: items.some((i) => i.type === 'KIT')
      ? 'Jl. Kemang Raya 12, Jakarta Selatan'
      : null,
    notes: null,
    items,
    wa_url: makeWaUrl(`Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #${code}.`),
    expires_at: '2026-11-10T03:15:00Z',
    paid_at: null,
    cancelled_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  }
}

export function makeCheckoutResult(order: Order = makeOrder()): CheckoutResult {
  return { order, wa_url: order.wa_url }
}

export function makeEnrollment(over: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 1,
    class_id: 1,
    class_title: 'Bulan & Gerak',
    class_date: '2026-11-14',
    class_time_slot: '09:30–11:30',
    class_location: 'Rumah Teduh, Kemang (Jakarta Selatan)',
    child_id: 1,
    child_name: 'Amina',
    order_id: 1,
    order_code: 'RUMI-2026-0001',
    status: 'RESERVED',
    created_at: NOW,
    updated_at: NOW,
    ...over,
  }
}

export function makeAssessment(over: Partial<Assessment> = {}): Assessment {
  return {
    id: 1,
    child_id: 1,
    class_id: null,
    class_title: null,
    assessor_id: 1,
    assessor_name: 'Admin RUMI',
    domain: 'PRACTICAL_LIFE',
    level: 3,
    milestone: 'Memilih kegiatan menuang tiga kali dan merapikannya sendiri',
    notes: 'Konsentrasinya makin tumbuh — ia memilih kegiatan yang sama tiga kali.',
    observed_on: '2026-10-24',
    created_at: NOW,
    ...over,
  }
}

export function makeAttendance(over: Partial<AttendanceSummary> = {}): AttendanceSummary {
  return { attended: 1, absent: 0, upcoming: 1, attendance_rate_pct: 100, ...over }
}

export function makeDomainLevels(
  assessments: readonly Assessment[] = [makeAssessment()],
): DomainLevel[] {
  return DOMAIN_VALUES.map((domain: Domain) => {
    const latest = assessments
      .filter((a) => a.domain === domain)
      .sort((a, b) =>
        a.observed_on === b.observed_on ? b.id - a.id : b.observed_on.localeCompare(a.observed_on),
      )[0]
    return latest
      ? {
          domain,
          level: latest.level,
          observed_on: latest.observed_on,
          milestone: latest.milestone,
        }
      : { domain, level: null, observed_on: null, milestone: null }
  })
}

export function makeChildReport(over: Partial<ChildReport> = {}): ChildReport {
  const assessments = over.assessments ?? [makeAssessment()]
  return {
    child: makeChild(),
    latest_levels: makeDomainLevels(assessments),
    assessments,
    attendance: makeAttendance(),
    enrollments: [makeEnrollment()],
    generated_at: NOW,
    ...over,
  }
}

export function makeStudentSummary(over: Partial<StudentSummary> = {}): StudentSummary {
  return {
    id: 1,
    name: 'Amina',
    dob: '2020-04-15',
    age_years: 6,
    parent_id: 2,
    parent_name: 'Nadia Rahman',
    parent_email: 'nadia@example.com',
    parent_phone_wa: '6281211112222',
    active_enrollments: 1,
    attendance: makeAttendance(),
    latest_assessment_on: '2026-10-24',
    created_at: NOW,
    ...over,
  }
}

export function makeStudentDetail(over: Partial<StudentDetail> = {}): StudentDetail {
  return { ...makeChildReport(), parent: makeUser(), ...over }
}

export function makeClassFill(over: Partial<ClassFill> = {}): ClassFill {
  return {
    id: 1,
    title: 'Bulan & Gerak',
    date: '2026-11-14',
    time_slot: '09:30–11:30',
    location: 'Rumah Teduh, Kemang (Jakarta Selatan)',
    status: 'OPEN',
    capacity: 12,
    seats_booked: 3,
    seats_left: 9,
    fill_rate_pct: 25,
    ...over,
  }
}

export function makeMetrics(over: Partial<Metrics> = {}): Metrics {
  return {
    total_revenue_idr: 295000,
    paid_orders: 1,
    pending_orders: 1,
    pending_amount_idr: 570000,
    enrolled_students: 1,
    revenue_by_month: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map(
      (month) => ({
        month,
        revenue_idr: 0,
      }),
    ),
    low_stock_kits: [{ id: 3, name: 'Set Suara & Pasir', category: 'SENSORIAL', stock: 4 }],
    upcoming_classes: [makeClassFill()],
    generated_at: NOW,
    ...over,
  }
}

export function makePaginated<T>(items: readonly T[], page = 1, perPage = 20): Paginated<T> {
  const start = (page - 1) * perPage
  return {
    items: items.slice(start, start + perPage),
    meta: { page, per_page: perPage, total: items.length },
  }
}

export function makeHealth(over: Partial<Health> = {}): Health {
  return { status: 'ok', version: '0.1.0', ...over }
}

/** Wrap data in the §5.1 success envelope. */
export function ok<T>(data: T): { success: true; data: T; error: null } {
  return { success: true, data, error: null }
}

/** Build a §5.1 error envelope. */
export function fail(
  code: string,
  error: string,
  fields?: Record<string, string>,
): { success: false; data: null; error: string; code: string; fields?: Record<string, string> } {
  return fields
    ? { success: false, data: null, error, code, fields }
    : { success: false, data: null, error, code }
}
