/**
 * zod schemas mirroring the FROZEN PRD §5 contract: the envelope (§5.1), every
 * shared DTO (§5.6), the CMS shapes (§5.7, in cms-schemas.ts) and every
 * request body / query (§5.8). JSON keys are snake_case and exact; nullable
 * keys are always present (`.nullable()`), optional request keys use
 * `.optional()`. Types are `z.infer`-ed so TS and the wire never drift.
 *
 * Unknown response keys are stripped (forward compatible); a missing or
 * mistyped key fails parsing → ApiError('contract_mismatch') in http.ts.
 */
import { z } from 'zod'
import { pageSlugSchema } from './cms-schemas'
import {
  assessmentLevelSchema,
  classStatusSchema,
  countSchema,
  dateStrSchema,
  domainSchema,
  enrollmentStatusSchema,
  idrSchema,
  idSchema,
  orderItemTypeSchema,
  orderStatusSchema,
  percentSchema,
  roleSchema,
  timeStrSchema,
  timestampSchema,
} from './enums'

export * from './enums'
export * from './cms-schemas'

// ── §5.1 Envelope ──
export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: z.string(),
  code: z.string(),
  fields: z.record(z.string()).optional(),
})
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>

export function envelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ success: z.literal(true), data, error: z.null() })
}

// ── §5.6 Shared DTOs ──
export const userSchema = z.object({
  id: idSchema,
  email: z.string(),
  full_name: z.string(),
  phone_wa: z.string(),
  role: roleSchema,
  created_at: timestampSchema,
})

export const childSchema = z.object({
  id: idSchema,
  parent_id: idSchema,
  name: z.string(),
  dob: dateStrSchema,
  age_years: countSchema,
  notes: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const cmsSectionSchema = z.object({
  id: idSchema,
  page_slug: pageSlugSchema,
  section_key: z.string(),
  title: z.string().nullable(),
  body: z.record(z.unknown()),
  image_url: z.string().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const cmsPageSchema = z.object({
  page_slug: pageSlugSchema,
  sections: z.array(cmsSectionSchema),
})

export const weekendClassSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string(),
  location: z.string(),
  image_url: z.string().nullable(),
  age_min: z.number().int().min(0).max(12),
  age_max: z.number().int().min(0).max(12),
  age_range: z.string(),
  date: dateStrSchema,
  start_time: timeStrSchema,
  end_time: timeStrSchema,
  time_slot: z.string(),
  fee_idr: idrSchema,
  capacity: z.number().int().positive(),
  seats_booked: countSchema,
  seats_left: countSchema,
  is_full: z.boolean(),
  is_upcoming: z.boolean(),
  status: classStatusSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const classListSchema = z.object({
  items: z.array(weekendClassSchema),
  locations: z.array(z.string()),
})

export const playKitSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: domainSchema,
  description: z.string(),
  image_url: z.string().nullable(),
  price_idr: idrSchema,
  stock: countSchema,
  badge_tag: z.string().nullable(),
  is_active: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const orderItemSchema = z.object({
  id: idSchema,
  type: orderItemTypeSchema,
  name: z.string(),
  kit_id: idSchema.nullable(),
  class_id: idSchema.nullable(),
  child_id: idSchema.nullable(),
  child_name: z.string().nullable(),
  class_date: dateStrSchema.nullable(),
  class_time_slot: z.string().nullable(),
  class_location: z.string().nullable(),
  enrollment_status: enrollmentStatusSchema.nullable(),
  unit_price_idr: idrSchema,
  quantity: z.number().int().positive(),
  line_total_idr: idrSchema,
})

export const orderSchema = z.object({
  id: idSchema,
  order_code: z.string(),
  parent_id: idSchema,
  parent_name: z.string(),
  parent_email: z.string(),
  status: orderStatusSchema,
  total_amount_idr: idrSchema,
  delivery_name: z.string(),
  delivery_phone: z.string(),
  delivery_address: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(orderItemSchema),
  wa_url: z.string(),
  expires_at: timestampSchema.nullable(),
  paid_at: timestampSchema.nullable(),
  cancelled_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const checkoutResultSchema = z.object({ order: orderSchema, wa_url: z.string() })

export const enrollmentSchema = z.object({
  id: idSchema,
  class_id: idSchema,
  class_title: z.string(),
  class_date: dateStrSchema,
  class_time_slot: z.string(),
  class_location: z.string(),
  child_id: idSchema,
  child_name: z.string(),
  order_id: idSchema.nullable(),
  order_code: z.string().nullable(),
  status: enrollmentStatusSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export const assessmentSchema = z.object({
  id: idSchema,
  child_id: idSchema,
  class_id: idSchema.nullable(),
  class_title: z.string().nullable(),
  assessor_id: idSchema,
  assessor_name: z.string(),
  domain: domainSchema,
  level: assessmentLevelSchema,
  milestone: z.string(),
  notes: z.string().nullable(),
  observed_on: dateStrSchema,
  created_at: timestampSchema,
})

export const domainLevelSchema = z.object({
  domain: domainSchema,
  level: assessmentLevelSchema.nullable(),
  observed_on: dateStrSchema.nullable(),
  milestone: z.string().nullable(),
})

export const attendanceSummarySchema = z.object({
  attended: countSchema,
  absent: countSchema,
  upcoming: countSchema,
  attendance_rate_pct: percentSchema.nullable(),
})

export const childReportSchema = z.object({
  child: childSchema,
  latest_levels: z.array(domainLevelSchema).length(5),
  assessments: z.array(assessmentSchema),
  attendance: attendanceSummarySchema,
  enrollments: z.array(enrollmentSchema),
  generated_at: timestampSchema,
})

export const studentSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  dob: dateStrSchema,
  age_years: countSchema,
  parent_id: idSchema,
  parent_name: z.string(),
  parent_email: z.string(),
  parent_phone_wa: z.string(),
  active_enrollments: countSchema,
  attendance: attendanceSummarySchema,
  latest_assessment_on: dateStrSchema.nullable(),
  created_at: timestampSchema,
})

export const studentDetailSchema = childReportSchema.extend({ parent: userSchema })

export const monthRevenueSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  revenue_idr: idrSchema,
})

export const lowStockKitSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: domainSchema,
  stock: countSchema,
})

export const classFillSchema = z.object({
  id: idSchema,
  title: z.string(),
  date: dateStrSchema,
  time_slot: z.string(),
  location: z.string(),
  status: classStatusSchema,
  capacity: z.number().int().positive(),
  seats_booked: countSchema,
  seats_left: countSchema,
  fill_rate_pct: percentSchema,
})

export const metricsSchema = z.object({
  total_revenue_idr: idrSchema,
  paid_orders: countSchema,
  pending_orders: countSchema,
  pending_amount_idr: idrSchema,
  enrolled_students: countSchema,
  revenue_by_month: z.array(monthRevenueSchema).length(6),
  low_stock_kits: z.array(lowStockKitSchema),
  upcoming_classes: z.array(classFillSchema).max(5),
  generated_at: timestampSchema,
})

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  per_page: z.number().int().min(1).max(100),
  total: countSchema,
})

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), meta: paginationMetaSchema })
}

export const healthSchema = z.object({ status: z.literal('ok'), version: z.string() })

// ── §5.8 auth responses ──
export const authUserSchema = z.object({ user: userSchema })
export const meSchema = z.object({ user: userSchema.nullable() })
export const registerResultSchema = z.object({ user: userSchema, child: childSchema })

// ── §5.8 request bodies ──
export const childInputSchema = z.object({
  name: z.string(),
  dob: dateStrSchema,
  notes: z.string().nullable().optional(),
})
export const childPatchSchema = childInputSchema.partial()

export const registerBodySchema = z.object({
  parent: z.object({
    full_name: z.string(),
    email: z.string(),
    phone_wa: z.string(),
    password: z.string(),
  }),
  child: childInputSchema,
})
export const loginBodySchema = z.object({ email: z.string(), password: z.string() })
export const forgotPasswordBodySchema = z.object({ email: z.string() })
export const resetPasswordBodySchema = z.object({ token: z.string(), password: z.string() })

export const checkoutItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('KIT'), kit_id: idSchema, quantity: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal('CLASS'), class_id: idSchema, child_id: idSchema }),
])
export const checkoutBodySchema = z.object({
  idempotency_key: z.string(),
  items: z.array(checkoutItemSchema).min(1).max(20),
  delivery: z.object({
    name: z.string(),
    phone_wa: z.string(),
    address: z.string().nullable().optional(),
  }),
  notes: z.string().nullable().optional(),
})

export const cmsCreateSchema = z.object({
  page_slug: z.string(),
  section_key: z.string(),
  title: z.string().nullable().optional(),
  body: z.record(z.unknown()),
  image_url: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})
export const cmsPatchSchema = cmsCreateSchema.omit({ page_slug: true, section_key: true }).partial()

export const classCreateSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: z.string(),
  image_url: z.string().nullable().optional(),
  age_min: z.number().int(),
  age_max: z.number().int(),
  date: dateStrSchema,
  start_time: timeStrSchema,
  end_time: timeStrSchema,
  fee_idr: idrSchema,
  capacity: z.number().int(),
  status: classStatusSchema.optional(),
})
export const classPatchSchema = classCreateSchema.partial()

export const kitCreateSchema = z.object({
  name: z.string(),
  category: domainSchema,
  description: z.string(),
  image_url: z.string().nullable().optional(),
  price_idr: idrSchema,
  stock: countSchema,
  badge_tag: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})
export const kitPatchSchema = kitCreateSchema.partial()

export const assessmentCreateSchema = z.object({
  child_id: idSchema,
  class_id: idSchema.nullable().optional(),
  domain: domainSchema,
  level: assessmentLevelSchema,
  milestone: z.string(),
  notes: z.string().nullable().optional(),
  observed_on: dateStrSchema,
})
export const enrollmentStatusPatchSchema = z.object({ status: z.enum(['ATTENDED', 'ABSENT']) })
export const orderStatusPatchSchema = z.object({ status: z.enum(['PAID', 'CANCELLED']) })

// ── §5.8 query params (all optional) ──
export interface ClassQuery {
  location?: string
  from?: string
  to?: string
  age?: number
}
export interface KitQuery {
  category?: z.infer<typeof domainSchema>
}
export interface AdminCmsQuery {
  page_slug?: z.infer<typeof pageSlugSchema>
}
export interface AdminClassQuery {
  status?: z.infer<typeof classStatusSchema>
}
export interface PageQuery {
  page?: number
  per_page?: number
}
export interface StudentQuery extends PageQuery {
  q?: string
}
export interface AdminOrderQuery extends PageQuery {
  status?: z.infer<typeof orderStatusSchema>
  q?: string
}

// ── Inferred types ──
export type User = z.infer<typeof userSchema>
export type Child = z.infer<typeof childSchema>
export type CmsSection = z.infer<typeof cmsSectionSchema>
export type CmsPage = z.infer<typeof cmsPageSchema>
export type WeekendClass = z.infer<typeof weekendClassSchema>
export type ClassList = z.infer<typeof classListSchema>
export type PlayKit = z.infer<typeof playKitSchema>
export type OrderItem = z.infer<typeof orderItemSchema>
export type Order = z.infer<typeof orderSchema>
export type CheckoutResult = z.infer<typeof checkoutResultSchema>
export type Enrollment = z.infer<typeof enrollmentSchema>
export type Assessment = z.infer<typeof assessmentSchema>
export type DomainLevel = z.infer<typeof domainLevelSchema>
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>
export type ChildReport = z.infer<typeof childReportSchema>
export type StudentSummary = z.infer<typeof studentSummarySchema>
export type StudentDetail = z.infer<typeof studentDetailSchema>
export type MonthRevenue = z.infer<typeof monthRevenueSchema>
export type LowStockKit = z.infer<typeof lowStockKitSchema>
export type ClassFill = z.infer<typeof classFillSchema>
export type Metrics = z.infer<typeof metricsSchema>
export type PaginationMeta = z.infer<typeof paginationMetaSchema>
export type Paginated<T> = { items: T[]; meta: PaginationMeta }
export type Health = z.infer<typeof healthSchema>
export type MeResult = z.infer<typeof meSchema>
export type RegisterResult = z.infer<typeof registerResultSchema>
export type ChildInput = z.infer<typeof childInputSchema>
export type ChildPatch = z.infer<typeof childPatchSchema>
export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>
export type CheckoutItem = z.infer<typeof checkoutItemSchema>
export type CheckoutBody = z.infer<typeof checkoutBodySchema>
export type CmsCreate = z.infer<typeof cmsCreateSchema>
export type CmsPatch = z.infer<typeof cmsPatchSchema>
export type ClassCreate = z.infer<typeof classCreateSchema>
export type ClassPatch = z.infer<typeof classPatchSchema>
export type KitCreate = z.infer<typeof kitCreateSchema>
export type KitPatch = z.infer<typeof kitPatchSchema>
export type AssessmentCreate = z.infer<typeof assessmentCreateSchema>
export type EnrollmentStatusPatch = z.infer<typeof enrollmentStatusPatchSchema>
export type OrderStatusPatch = z.infer<typeof orderStatusPatchSchema>
