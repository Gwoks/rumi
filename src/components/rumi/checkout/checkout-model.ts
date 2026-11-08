/**
 * Pure checkout logic (PRD §5.8.4 #21, §5.9.1): the ids-and-quantities-only
 * request body, the idempotency key, the error-code → recovery mapping, and a
 * guard for the server-built WhatsApp URL. No React here, so it is unit tested
 * on its own.
 */
import { isApiError } from '@/api/errors'
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

/** How the user recovers from a failed checkout. */
export type CheckoutRecovery = 'cart' | 'details' | 'retry'

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

const TITLES: Record<string, CopyKey> = {
  out_of_stock: 'public.checkout.error.out_of_stock',
  class_full: 'public.checkout.error.class_full',
  item_unavailable: 'public.checkout.error.item_unavailable',
  already_enrolled: 'public.checkout.error.already_enrolled',
  validation_error: 'public.checkout.error.validation_error',
  not_found: 'public.checkout.error.not_found',
}

const CART_CODES = new Set(['out_of_stock', 'class_full', 'item_unavailable'])
const DETAIL_CODES = new Set(['already_enrolled', 'not_found'])

const HINTS: Record<CheckoutRecovery, CopyKey> = {
  cart: 'public.checkout.error.cartHint',
  details: 'public.checkout.error.detailsHint',
  retry: 'public.checkout.error.retryHint',
}

function deliveryFieldErrors(fields: FormErrors): FormErrors {
  return { ...pickFieldErrors(fields, 'delivery'), ...pickFieldErrors(fields) }
}

function recoveryFor(code: string, fieldErrors: FormErrors): CheckoutRecovery {
  if (CART_CODES.has(code)) return 'cart'
  if (DETAIL_CODES.has(code)) return 'details'
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
    title: t(TITLES[code] ?? 'public.checkout.error.generic'),
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
