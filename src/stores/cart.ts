/**
 * Cart store: persisted to localStorage and synced across tabs
 * (`createStore`). Holds KIT lines (one per kit, with a quantity) and CLASS
 * lines (one seat per line; the child is picked in checkout). Prices here are
 * DISPLAY SNAPSHOTS only — the server recomputes everything at checkout and
 * the client sends only ids and quantities (PRD §5.9.1).
 *
 * All updates are immutable.
 */
import { z } from 'zod'
import type { CheckoutItem, PlayKit, WeekendClass } from '@/api/schemas'
import { createStore } from '@/lib/create-store'

/** PRD §5.8.4: a KIT line quantity is 1–10; a checkout holds 1–20 items. */
export const MAX_KIT_QUANTITY = 10
export const MAX_CART_LINES = 20
export const CART_STORAGE_KEY = 'rumi-cart-v1'

const idSchema = z.number().int().positive()
const moneySchema = z.number().int().nonnegative()

export const cartKitItemSchema = z.object({
  type: z.literal('KIT'),
  line_id: z.string(),
  kit_id: idSchema,
  name: z.string(),
  price_idr: moneySchema,
  quantity: z.number().int().min(1).max(MAX_KIT_QUANTITY),
  max_stock: z.number().int().nonnegative(),
})

export const cartClassItemSchema = z.object({
  type: z.literal('CLASS'),
  line_id: z.string(),
  class_id: idSchema,
  title: z.string(),
  fee_idr: moneySchema,
  child_id: idSchema.nullable(),
  date: z.string(),
  time_slot: z.string(),
  location: z.string(),
})

export const cartItemSchema = z.discriminatedUnion('type', [cartKitItemSchema, cartClassItemSchema])
export const cartStateSchema = z.object({ items: z.array(cartItemSchema).max(MAX_CART_LINES) })

export type CartKitItem = z.infer<typeof cartKitItemSchema>
export type CartClassItem = z.infer<typeof cartClassItemSchema>
export type CartItem = z.infer<typeof cartItemSchema>
export type CartState = z.infer<typeof cartStateSchema>

/** Outcome of an add, so the UI can toast the right message. */
export type AddResult = 'added' | 'updated' | 'already_in_cart' | 'cart_full' | 'out_of_stock'

const EMPTY: CartState = { items: [] }

export const cartStore = createStore<CartState>(EMPTY, {
  key: CART_STORAGE_KEY,
  parse: (raw) => {
    const parsed = cartStateSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  },
})

/** Highest allowed quantity for a kit line: min(stock, 10). */
export function kitQuantityCap(maxStock: number): number {
  return Math.max(0, Math.min(maxStock, MAX_KIT_QUANTITY))
}

function clampQuantity(quantity: number, maxStock: number): number {
  return Math.max(1, Math.min(Math.trunc(quantity), Math.max(1, kitQuantityCap(maxStock))))
}

function newLineId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

function setItems(update: (items: readonly CartItem[]) => CartItem[]): void {
  cartStore.setState((prev) => ({ ...prev, items: update(prev.items) }))
}

/** Add a kit (or bump its quantity), capped at min(stock, 10). */
export function addKit(
  kit: Pick<PlayKit, 'id' | 'name' | 'price_idr' | 'stock'>,
  quantity = 1,
): AddResult {
  if (kit.stock <= 0) return 'out_of_stock'
  const { items } = cartStore.getSnapshot()
  const existing = items.find((i): i is CartKitItem => i.type === 'KIT' && i.kit_id === kit.id)
  if (existing) {
    const next = clampQuantity(existing.quantity + quantity, kit.stock)
    setItems((list) =>
      list.map((i) =>
        i.line_id === existing.line_id
          ? {
              ...existing,
              name: kit.name,
              price_idr: kit.price_idr,
              max_stock: kit.stock,
              quantity: next,
            }
          : i,
      ),
    )
    return 'updated'
  }
  if (items.length >= MAX_CART_LINES) return 'cart_full'
  const line: CartKitItem = {
    type: 'KIT',
    line_id: `kit-${kit.id}`,
    kit_id: kit.id,
    name: kit.name,
    price_idr: kit.price_idr,
    quantity: clampQuantity(quantity, kit.stock),
    max_stock: kit.stock,
  }
  setItems((list) => [...list, line])
  return 'added'
}

/**
 * Add one seat in a class. A class already in the cart without a child yet is
 * not added twice; once each line has a child, another seat can be added
 * (one per child).
 */
export function addClass(
  cls: Pick<WeekendClass, 'id' | 'title' | 'fee_idr' | 'date' | 'time_slot' | 'location'>,
): AddResult {
  const { items } = cartStore.getSnapshot()
  const pending = items.some(
    (i) => i.type === 'CLASS' && i.class_id === cls.id && i.child_id === null,
  )
  if (pending) return 'already_in_cart'
  if (items.length >= MAX_CART_LINES) return 'cart_full'
  const line: CartClassItem = {
    type: 'CLASS',
    line_id: newLineId(`class-${cls.id}`),
    class_id: cls.id,
    title: cls.title,
    fee_idr: cls.fee_idr,
    child_id: null,
    date: cls.date,
    time_slot: cls.time_slot,
    location: cls.location,
  }
  setItems((list) => [...list, line])
  return 'added'
}

/** Set a kit line's quantity (clamped to 1…min(stock, 10)). */
export function setQuantity(lineId: string, quantity: number): void {
  setItems((list) =>
    list.map((i) =>
      i.line_id === lineId && i.type === 'KIT'
        ? { ...i, quantity: clampQuantity(quantity, i.max_stock) }
        : i,
    ),
  )
}

/**
 * Pick (or clear) the child for a class line. Refused (returns false) when
 * another line already books the same child into the same class.
 */
export function setChild(lineId: string, childId: number | null): boolean {
  const { items } = cartStore.getSnapshot()
  const line = items.find((i): i is CartClassItem => i.type === 'CLASS' && i.line_id === lineId)
  if (!line) return false
  const duplicate =
    childId !== null &&
    items.some(
      (i) =>
        i.type === 'CLASS' &&
        i.line_id !== lineId &&
        i.class_id === line.class_id &&
        i.child_id === childId,
    )
  if (duplicate) return false
  setItems((list) => list.map((i) => (i.line_id === lineId ? { ...line, child_id: childId } : i)))
  return true
}

export function removeItem(lineId: string): void {
  setItems((list) => list.filter((i) => i.line_id !== lineId))
}

export function clearCart(): void {
  cartStore.setState(EMPTY)
}

export interface CartTotals {
  /** Kit units + class seats (the header count chip). */
  itemCount: number
  lineCount: number
  /** Display-only estimate; the server's total is authoritative. */
  totalIdr: number
  hasKit: boolean
  hasClass: boolean
  /** True while any class line still needs a child. */
  needsChild: boolean
}

export function lineTotal(item: CartItem): number {
  return item.type === 'KIT' ? item.price_idr * item.quantity : item.fee_idr
}

export function cartTotals(items: readonly CartItem[]): CartTotals {
  return {
    itemCount: items.reduce((n, i) => n + (i.type === 'KIT' ? i.quantity : 1), 0),
    lineCount: items.length,
    totalIdr: items.reduce((sum, i) => sum + lineTotal(i), 0),
    hasKit: items.some((i) => i.type === 'KIT'),
    hasClass: items.some((i) => i.type === 'CLASS'),
    needsChild: items.some((i) => i.type === 'CLASS' && i.child_id === null),
  }
}

/** The ids-and-quantities-only checkout payload, or null while a child is missing. */
export function toCheckoutItems(items: readonly CartItem[]): CheckoutItem[] | null {
  const out: CheckoutItem[] = []
  for (const item of items) {
    if (item.type === 'KIT') {
      out.push({ type: 'KIT', kit_id: item.kit_id, quantity: item.quantity })
      continue
    }
    if (item.child_id === null) return null
    out.push({ type: 'CLASS', class_id: item.class_id, child_id: item.child_id })
  }
  return out
}
