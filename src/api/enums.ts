/**
 * Scalar formats and enums (PRD §5.4.1, §5.5, FROZEN). Dependency-free except
 * zod so e2e specs and the mock backend can import them.
 */
import { z } from 'zod'

export const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
export const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function isRealDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export const timestampSchema = z.string().regex(TIMESTAMP_RE)
export const dateStrSchema = z.string().regex(DATE_STR_RE).refine(isRealDate)
export const timeStrSchema = z.string().regex(TIME_RE)
/** Whole Rupiah — a JSON integer, never a float or a string. */
export const idrSchema = z.number().int().nonnegative()
export const idSchema = z.number().int().positive()
export const countSchema = z.number().int().nonnegative()
export const percentSchema = z.number().int().min(0).max(100)

export const roleSchema = z.enum(['PARENT', 'ADMIN'])
/** Canonical order (PRD §5.5) — also the kit category. */
export const domainSchema = z.enum([
  'PRACTICAL_LIFE',
  'SENSORIAL',
  'LANGUAGE',
  'MATH',
  'ISLAMIC_STUDIES',
])
export const classStatusSchema = z.enum(['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'])
export const orderStatusSchema = z.enum(['PENDING_WA', 'PAID', 'CANCELLED'])
export const enrollmentStatusSchema = z.enum([
  'RESERVED',
  'CONFIRMED',
  'ATTENDED',
  'ABSENT',
  'CANCELLED',
])
export const orderItemTypeSchema = z.enum(['KIT', 'CLASS'])
export const assessmentLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])

export type Role = z.infer<typeof roleSchema>
export type Domain = z.infer<typeof domainSchema>
export type ClassStatus = z.infer<typeof classStatusSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>
export type OrderItemType = z.infer<typeof orderItemTypeSchema>
export type AssessmentLevel = z.infer<typeof assessmentLevelSchema>

export const DOMAIN_VALUES = domainSchema.options
export const ORDER_STATUS_VALUES = orderStatusSchema.options
export const CLASS_STATUS_VALUES = classStatusSchema.options
export const ENROLLMENT_STATUS_VALUES = enrollmentStatusSchema.options
