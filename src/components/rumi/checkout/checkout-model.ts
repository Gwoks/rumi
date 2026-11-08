/**
 * Pure checkout logic (PRD §5.8.4 #21, §5.9.1): the ids-and-quantities-only
 * request body, the idempotency key and when to reuse it, the error-code →
 * recovery mapping, and a guard for the server-built WhatsApp URL. No React
 * here, so it is unit tested on its own.
 */
import { isApiError, type ServerErrorCode } from '@/api/errors'
import type { CheckoutBody } from '@/api/schemas'
import { apiErrorMessage } from '@/lib/api-errors'
import { t, type CopyKey } from '@/lib/copy'
import { pickFieldErrors } from '@/lib/use-form'
import type { FormErrors } from '@/lib/validation'
import { toCheckoutItems, type CartItem } from '@/stores/cart'

/** A RFC 4122 v4 UUID (PRD §5.8.4: `idempotency_key` must be a UUID). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** The validated delivery step (output of `deliveryFormSchema`). */
export interface DeliveryData {
  name: string
  phone_wa: string
  address: string | null
  notes: string | null
}

/**
 * The checkout body: ids and quantities only — never a price or a total
 * (the server recomputes everything). Null while a class line has no child.
 */
export function buildCheckoutBody(
  items: readonly CartItem[],
  delivery: DeliveryData,
  idempotencyKey: string,
): CheckoutBody | null {
  const checkoutItems = toCheckoutItems(items)
  if (!checkoutItems || checkoutItems.length === 0) return null
  const hasKit = checkoutItems.some((item) => item.type === 'KIT')
  return {
    idempotency_key: idempotencyKey,
    items: checkoutItems,
    delivery: {
      name: delivery.name,
      phone_wa: delivery.phone_wa,
      address: hasKit ? delivery.address : null,
    },
    notes: delivery.notes,
  }
}

/** Stable JSON: object keys sorted at every level, so equal data → equal text. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

/** What the server would receive, minus the key: items, delivery and notes. */
export function checkoutFingerprint(body: CheckoutBody): string {
  return stableStringify({ items: body.items, delivery: body.delivery, notes: body.notes ?? null })
}

/** One submit attempt: its idempotency key and the request it was made for. */
export interface CheckoutAttempt {
  key: string
  fingerprint: string
}

/**
 * Reuse the key only while the request is unchanged (a retry after a lost
 * response must replay the same order). Any edit to the cart, the delivery or
 * the notes starts a new key, so a replay never silently drops the edit (§6.31).
 */
export function nextAttempt(
  prev: CheckoutAttempt | null,
  fingerprint: string,
  makeKey: () => string = newIdempotencyKey,
): CheckoutAttempt {
  if (prev && prev.fingerprint === fingerprint) return prev
  return { key: makeKey(), fingerprint }
}

/** How the user recovers from a failed checkout. */
export type CheckoutRecovery = 'cart' | 'details' | 'orders' | 'retry'

export interface CheckoutErrorView {
  code: string
  title: string
  /** The server's Indonesian sentence (it names the item, PRD §5.2). */
  message: string
  hint: string
  recovery: CheckoutRecovery
  /** Delivery-form errors (keys: name, phone_wa, address, notes). */
  fieldErrors: FormErrors
}

const TITLES: Partial<Record<ServerErrorCode, CopyKey>> = {
  out_of_stock: 'public.checkout.error.out_of_stock',
  class_full: 'public.checkout.error.class_full',
  item_unavailable: 'public.checkout.error.item_unavailable',
  already_enrolled: 'public.checkout.error.already_enrolled',
  validation_error: 'public.checkout.error.validation_error',
  not_found: 'public.checkout.error.not_found',
  too_many_pending_orders: 'public.checkout.error.too_many_pending_orders',
}

const CART_CODES: ReadonlySet<string> = new Set<ServerErrorCode>([
  'out_of_stock',
  'class_full',
  'item_unavailable',
])
const DETAIL_CODES: ReadonlySet<string> = new Set<ServerErrorCode>([
  'already_enrolled',
  'not_found',
])

const HINTS: Record<CheckoutRecovery, CopyKey> = {
  cart: 'public.checkout.error.cartHint',
  details: 'public.checkout.error.detailsHint',
  orders: 'public.checkout.error.ordersHint',
  retry: 'public.checkout.error.retryHint',
}

function deliveryFieldErrors(fields: FormErrors): FormErrors {
  return { ...pickFieldErrors(fields, 'delivery'), ...pickFieldErrors(fields) }
}

function recoveryFor(code: string, fieldErrors: FormErrors): CheckoutRecovery {
  if (CART_CODES.has(code)) return 'cart'
  if (DETAIL_CODES.has(code)) return 'details'
  if (code === 'too_many_pending_orders') return 'orders'
  if (code === 'validation_error') {
    return Object.keys(fieldErrors).length > 0 ? 'details' : 'cart'
  }
  return 'retry'
}

/** Map any checkout failure to a title, the server message and a recovery path. */
export function checkoutErrorView(err: unknown): CheckoutErrorView {
  const code = isApiError(err) ? err.code : 'internal'
  const fields = isApiError(err) && err.fields ? err.fields : {}
  const fieldErrors = code === 'validation_error' ? deliveryFieldErrors(fields) : {}
  const recovery = recoveryFor(code, fieldErrors)
  return {
    code,
    title: t(TITLES[code as ServerErrorCode] ?? 'public.checkout.error.generic'),
    message: apiErrorMessage(err),
    hint: t(HINTS[recovery]),
    recovery,
    fieldErrors,
  }
}

/** Only an https URL may be opened (the server builds `wa_url`, PRD §5.9.3). */
export function safeHttpsUrl(raw: string): string | null {
  try {
    return new URL(raw).protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}
