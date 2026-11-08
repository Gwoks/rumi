import { beforeEach, describe, expect, it } from 'vitest'
import { makeClass, makeKit } from '@/test/factories'
import {
  addClass,
  addKit,
  CART_STORAGE_KEY,
  cartStore,
  cartTotals,
  clearCart,
  kitQuantityCap,
  MAX_CART_LINES,
  removeItem,
  setChild,
  setQuantity,
  toCheckoutItems,
  type CartClassItem,
} from './cart'

const items = () => cartStore.getSnapshot().items
const classLines = () => items().filter((i): i is CartClassItem => i.type === 'CLASS')

beforeEach(() => clearCart())

describe('cart: kits', () => {
  it('adds a kit, then bumps its quantity', () => {
    expect(addKit(makeKit())).toBe('added')
    expect(addKit(makeKit(), 2)).toBe('updated')
    expect(items()).toEqual([
      {
        type: 'KIT',
        line_id: 'kit-1',
        kit_id: 1,
        name: 'Nampan Tangan Kecil',
        price_idr: 185000,
        quantity: 3,
        max_stock: 12,
      },
    ])
  })

  it('caps the quantity at min(stock, 10)', () => {
    addKit(makeKit({ stock: 3 }), 5)
    expect(items()[0]).toMatchObject({ quantity: 3 })
    addKit(makeKit({ id: 2, stock: 50 }), 15)
    expect(items()[1]).toMatchObject({ quantity: 10 })
    expect(kitQuantityCap(4)).toBe(4)
    expect(kitQuantityCap(40)).toBe(10)
  })

  it('refuses an out-of-stock kit', () => {
    expect(addKit(makeKit({ stock: 0 }))).toBe('out_of_stock')
    expect(items()).toEqual([])
  })

  it('sets a clamped quantity and ignores class lines', () => {
    addKit(makeKit({ stock: 5 }))
    setQuantity('kit-1', 99)
    expect(items()[0]).toMatchObject({ quantity: 5 })
    setQuantity('kit-1', 0)
    expect(items()[0]).toMatchObject({ quantity: 1 })
    addClass(makeClass())
    const before = classLines()[0]
    setQuantity(before.line_id, 3)
    expect(classLines()[0]).toBe(before)
  })
})

describe('cart: classes', () => {
  it('adds one seat per line and waits for a child before adding another', () => {
    expect(addClass(makeClass())).toBe('added')
    expect(addClass(makeClass())).toBe('already_in_cart')
    const [line] = classLines()
    expect(line).toMatchObject({
      class_id: 1,
      title: 'Bulan & Gerak',
      fee_idr: 200000,
      child_id: null,
    })
    expect(setChild(line.line_id, 1)).toBe(true)
    expect(addClass(makeClass())).toBe('added')
    expect(classLines()).toHaveLength(2)
  })

  it('never books the same child twice into one class', () => {
    addClass(makeClass())
    setChild(classLines()[0].line_id, 1)
    addClass(makeClass())
    const second = classLines()[1]
    expect(setChild(second.line_id, 1)).toBe(false)
    expect(setChild(second.line_id, 2)).toBe(true)
    expect(setChild(second.line_id, null)).toBe(true)
    expect(setChild('missing', 1)).toBe(false)
  })

  it('stops at 20 lines', () => {
    for (let id = 1; id <= MAX_CART_LINES; id += 1) addKit(makeKit({ id }))
    expect(addKit(makeKit({ id: 99 }))).toBe('cart_full')
    expect(addClass(makeClass())).toBe('cart_full')
    expect(items()).toHaveLength(MAX_CART_LINES)
  })
})

describe('cart: totals, removal and checkout payload', () => {
  it('derives totals', () => {
    addKit(makeKit(), 2)
    addClass(makeClass())
    expect(cartTotals(items())).toEqual({
      itemCount: 3,
      lineCount: 2,
      totalIdr: 2 * 185000 + 200000,
      hasKit: true,
      hasClass: true,
      needsChild: true,
    })
    expect(cartTotals([])).toMatchObject({
      itemCount: 0,
      totalIdr: 0,
      hasKit: false,
      needsChild: false,
    })
  })

  it('builds the ids-and-quantities payload once every class has a child', () => {
    addKit(makeKit(), 2)
    addClass(makeClass({ id: 7 }))
    expect(toCheckoutItems(items())).toBeNull()
    setChild(classLines()[0].line_id, 3)
    expect(toCheckoutItems(items())).toEqual([
      { type: 'KIT', kit_id: 1, quantity: 2 },
      { type: 'CLASS', class_id: 7, child_id: 3 },
    ])
  })

  it('removes and clears', () => {
    addKit(makeKit())
    addKit(makeKit({ id: 2 }))
    removeItem('kit-1')
    expect(items().map((i) => i.line_id)).toEqual(['kit-2'])
    clearCart()
    expect(items()).toEqual([])
  })

  it('persists to localStorage', () => {
    addKit(makeKit())
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}').items).toHaveLength(1)
  })

  it('ignores tampered storage from another tab', () => {
    addKit(makeKit())
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: CART_STORAGE_KEY,
        newValue: JSON.stringify({ items: [{ type: 'KIT', price_idr: -1 }] }),
      }),
    )
    expect(items()).toEqual([])
  })
})
