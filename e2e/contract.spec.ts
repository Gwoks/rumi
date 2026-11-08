/**
 * Static §5 contract checks (Node context, no browser): every factory the mock
 * backend serves must round-trip through the zod schemas unchanged — a missing
 * key, a wrong type or an EXTRA key (zod strips unknown keys, so `toEqual`
 * catches it) fails here before it can hide a real contract drift.
 */
import { expect, test } from '@playwright/test'
import type { z } from 'zod'
import {
  checkoutResultSchema,
  childReportSchema,
  childSchema,
  classListSchema,
  cmsBodySchemaFor,
  cmsPageSchema,
  envelope,
  errorEnvelopeSchema,
  healthSchema,
  metricsSchema,
  orderSchema,
  paginated,
  playKitSchema,
  registerResultSchema,
  studentDetailSchema,
  studentSummarySchema,
  userSchema,
  weekendClassSchema,
  assessmentSchema,
  enrollmentSchema,
  meSchema,
  type PageSlug,
} from '../src/api/schemas'
import {
  fail,
  makeAdmin,
  makeAssessment,
  makeCheckoutResult,
  makeChild,
  makeChildReport,
  makeClass,
  makeClassList,
  makeCmsPage,
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
  SEED_CLASSES,
  SEED_KITS,
} from '../src/test/factories'
import { checkout, computeMetrics, createMockState, transitionOrder } from './support/mock-store'

function roundTrip<T extends z.ZodTypeAny>(schema: T, value: unknown, label: string) {
  const parsed = schema.safeParse(value)
  expect(
    parsed.success,
    `${label}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`,
  ).toBe(true)
  expect(parsed.data, `${label} has keys the schema does not know`).toEqual(value)
}

test('every DTO factory matches its schema exactly', () => {
  roundTrip(userSchema, makeUser(), 'User')
  roundTrip(userSchema, makeAdmin(), 'User (admin)')
  roundTrip(meSchema, { user: null }, 'Me (anonymous)')
  roundTrip(childSchema, makeChild(), 'Child')
  roundTrip(weekendClassSchema, makeClass(), 'WeekendClass')
  roundTrip(weekendClassSchema, makeClass({ seats_booked: 12 }), 'WeekendClass (full)')
  SEED_CLASSES.forEach((c) => roundTrip(weekendClassSchema, c, `seed class ${c.title}`))
  roundTrip(classListSchema, makeClassList(), 'ClassList')
  roundTrip(playKitSchema, makeKit(), 'PlayKit')
  SEED_KITS.forEach((k) => roundTrip(playKitSchema, k, `seed kit ${k.name}`))
  roundTrip(orderSchema, makeOrder(), 'Order')
  roundTrip(checkoutResultSchema, makeCheckoutResult(), 'CheckoutResult')
  roundTrip(enrollmentSchema, makeEnrollment(), 'Enrollment')
  roundTrip(assessmentSchema, makeAssessment(), 'Assessment')
  roundTrip(childReportSchema, makeChildReport(), 'ChildReport')
  roundTrip(studentSummarySchema, makeStudentSummary(), 'StudentSummary')
  roundTrip(studentDetailSchema, makeStudentDetail(), 'StudentDetail')
  roundTrip(
    paginated(studentSummarySchema),
    makePaginated([makeStudentSummary()]),
    'Paginated<StudentSummary>',
  )
  roundTrip(paginated(orderSchema), makePaginated([makeOrder()]), 'Paginated<Order>')
  roundTrip(metricsSchema, makeMetrics(), 'Metrics')
  roundTrip(healthSchema, makeHealth(), 'Health')
  roundTrip(registerResultSchema, { user: makeUser(), child: makeChild() }, 'RegisterResult')
})

test('every seeded CMS page and body matches the §5.7 registry', () => {
  for (const slug of ['home', 'who-we-are', 'our-approach'] as PageSlug[]) {
    const page = makeCmsPage(slug)
    roundTrip(cmsPageSchema, page, `CmsPage ${slug}`)
    for (const section of page.sections) {
      const schema = cmsBodySchemaFor(section.page_slug, section.section_key)
      expect(schema, `${slug}/${section.section_key} is registered`).not.toBeNull()
      roundTrip(schema!, section.body, `${slug}/${section.section_key} body`)
    }
  }
})

test('envelopes match §5.1', () => {
  roundTrip(envelope(orderSchema), ok(makeOrder()), 'success envelope')
  roundTrip(
    errorEnvelopeSchema,
    fail('validation_error', 'Data tidak valid.', { 'delivery.address': 'Wajib diisi.' }),
    'error envelope',
  )
  roundTrip(
    errorEnvelopeSchema,
    fail('not_found', 'Data tidak ditemukan.'),
    'error envelope without fields',
  )
})

test('the mock store produces contract-valid orders, transitions and metrics', () => {
  const state = createMockState({ as: 'PARENT' })
  const [status, order] = checkout(state, makeUser(), {
    idempotency_key: '0b5c7d1e-8f6a-4b2c-9d3e-1a2b3c4d5e6f',
    items: [
      { type: 'KIT', kit_id: 1, quantity: 2 },
      { type: 'CLASS', class_id: 1, child_id: 1 },
    ],
    delivery: { name: 'Nadia Rahman', phone_wa: '6281211112222', address: 'Jl. Kemang Raya 12' },
  })
  expect(status).toBe(201)
  roundTrip(orderSchema, order, 'checkout order')
  expect(order.total_amount_idr).toBe(2 * 185000 + 200000)
  expect(order.order_code).toBe('RUMI-2026-0001')
  expect(state.kits.find((k) => k.id === 1)?.stock).toBe(10)

  const [replayStatus, replay] = checkout(state, makeUser(), {
    idempotency_key: '0B5C7D1E-8F6A-4B2C-9D3E-1A2B3C4D5E6F',
    items: [{ type: 'KIT', kit_id: 1, quantity: 1 }],
    delivery: { name: 'x', phone_wa: 'y' },
  })
  expect(replayStatus).toBe(200)
  expect(replay.id).toBe(order.id)

  roundTrip(orderSchema, transitionOrder(state, order.id, 'PAID'), 'paid order')
  roundTrip(metricsSchema, computeMetrics(state), 'computed metrics')
  roundTrip(orderSchema, transitionOrder(state, order.id, 'CANCELLED'), 'cancelled order')
  expect(state.kits.find((k) => k.id === 1)?.stock).toBe(12)
  expect(() => transitionOrder(state, order.id, 'PAID')).toThrow(/Status tidak dapat diubah/)
})
