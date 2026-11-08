/**
 * zod form schemas shared by every form (Indonesian messages from `t()`).
 * They mirror the server rules in PRD §5.4 / §5.8 so the user sees errors
 * before a round trip; the server stays authoritative (a `validation_error`
 * `fields` map is merged in by the form via `apiFieldErrors`).
 *
 * Text is trimmed before length checks (§5.4.4), passwords are not (§5.4.7),
 * and lengths count Unicode scalar values (`[...s].length`).
 */
import { z } from 'zod'
import { t } from './copy'
import { ageFromDob, parseDateStr, todayWib } from './format'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_WA_RE = /^62[1-9]\d{7,12}$/
export const MAX_CHILD_AGE = 12

export function charLength(value: string): number {
  return [...value].length
}

/** A required, trimmed text field with Unicode-aware length bounds. */
export function requiredText(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((s) => s.length > 0, { message: t('common.validation.required') })
    .refine((s) => s.length === 0 || charLength(s) >= min, {
      message: t('common.validation.minChars', { n: min }),
    })
    .refine((s) => charLength(s) <= max, { message: t('common.validation.maxChars', { n: max }) })
}

/** An optional, trimmed text field: empty after trimming becomes `null` (§5.4.4). */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .refine((s) => charLength(s) <= max, { message: t('common.validation.maxChars', { n: max }) })
    .transform((s) => (s.length === 0 ? null : s))
}

/**
 * WhatsApp phone normalization (PRD §5.4.6), identical to the server:
 * "0812-3456-7890" → "6281234567890"; returns null when invalid.
 */
export function normalizePhoneWa(raw: string): string | null {
  let digits = raw.replace(/[ \-.()]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (!/^\d+$/.test(digits)) return null
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
  else if (digits.startsWith('8')) digits = `62${digits}`
  else if (!digits.startsWith('62')) return null
  return PHONE_WA_RE.test(digits) ? digits : null
}

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .refine((s) => s.length > 0, { message: t('common.validation.required') })
  .refine((s) => s.length === 0 || (s.length <= 254 && EMAIL_RE.test(s)), {
    message: t('common.validation.email'),
  })

/** New password: 8–128 characters, not trimmed. */
export const passwordField = z
  .string()
  .refine((s) => charLength(s) >= 8, { message: t('common.validation.passwordMin') })
  .refine((s) => charLength(s) <= 128, { message: t('common.validation.passwordMax') })

/** Login password: just required (the server answers `invalid_credentials`). */
export const loginPasswordField = z
  .string()
  .refine((s) => s.length > 0, { message: t('common.validation.required') })
  .refine((s) => charLength(s) <= 128, { message: t('common.validation.passwordMax') })

export const phoneWaField = z.string().transform((value, ctx) => {
  const normalized = normalizePhoneWa(value)
  if (normalized === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('common.validation.phone') })
    return z.NEVER
  }
  return normalized
})

/** Child birth date: a real `YYYY-MM-DD`, not in the future (WIB), age ≤ 12. */
export const childDobField = z
  .string()
  .refine((s) => parseDateStr(s) !== null, { message: t('common.validation.date') })
  .refine((s) => parseDateStr(s) === null || s <= todayWib(), {
    message: t('common.validation.dobFuture'),
  })
  .refine((s) => (ageFromDob(s) ?? 0) <= MAX_CHILD_AGE, {
    message: t('common.validation.dobTooOld'),
  })

// ── Form schemas ──
export const loginFormSchema = z.object({ email: emailField, password: loginPasswordField })

export const forgotPasswordFormSchema = z.object({ email: emailField })

export const resetPasswordFormSchema = z
  .object({ password: passwordField, password_confirm: z.string() })
  .refine((v) => v.password === v.password_confirm, {
    message: t('common.validation.passwordMismatch'),
    path: ['password_confirm'],
  })

/** Register step 1 (PRD §5.8.3 RegisterBody.parent). */
export const parentFormSchema = z.object({
  full_name: requiredText(2, 100),
  email: emailField,
  phone_wa: phoneWaField,
  password: passwordField,
})

/** Register step 2 and "add child" (PRD §5.8.3 ChildInput). */
export const childFormSchema = z.object({
  name: requiredText(1, 80),
  dob: childDobField,
  notes: optionalText(500),
})

/** Checkout delivery (PRD §5.8.4): the address is required iff the cart has a kit. */
export function deliveryFormSchema(requiresAddress: boolean) {
  return z.object({
    name: requiredText(2, 100),
    phone_wa: phoneWaField,
    address: requiresAddress ? requiredText(1, 500) : optionalText(500),
    notes: optionalText(500),
  })
}

export type FormErrors = Record<string, string>

/** First message per dotted path (`parent.email`, `items.2.quantity`). */
export function zodFieldErrors(error: z.ZodError): FormErrors {
  const out: FormErrors = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!(path in out)) out[path] = issue.message
  }
  return out
}

export type FormResult<T> = { success: true; data: T } | { success: false; errors: FormErrors }

/** Validate form values; returns parsed data or a field → message map. */
export function validateForm<S extends z.ZodTypeAny>(
  schema: S,
  values: unknown,
): FormResult<z.output<S>> {
  const parsed = schema.safeParse(values)
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, errors: zodFieldErrors(parsed.error) }
}
