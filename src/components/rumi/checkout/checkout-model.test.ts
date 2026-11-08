import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { UUID_RE } from '@/api/enums'
import type { CartItem } from '@/stores/cart'
import {
  buildCheckoutBody,
  checkoutErrorView,
  checkoutFingerprint,
  newIdempotencyKey,
  nextAttempt,
  safeHttpsUrl,
  stableStringify,
  type DeliveryData,
} from './checkout-model'

const KIT: CartItem = {
  type: 'KIT',
  line_id: 'kit-1',
  kit_id: 1,
  name: 'Nampan Tangan Kecil',
  price_idr: 185000,
  quantity: 2,
  max_stock: 12,
}
const CLASS: CartItem = {
  type: 'CLASS',
  line_id: 'class-1-a',
  class_id: 1,
  title: 'Bulan & Gerak',
  fee_idr: 200000,
  child_id: 7,
  date: '2026-11-14',
  time_slot: '09:30–11:30',
  location: 'Kemang',
}
const DELIVERY: DeliveryData = {
  name: 'Nadia Rahman',
  phone_wa: '6281211112222',
  address: 'Jl. Kemang Raya 12',
  notes: null,
}

describe('newIdempotencyKey', () => {
  it('returns a fresh UUID each time', () => {
    const a = newIdempotencyKey()
    expect(a).toMatch(UUID_RE)
    expect(newIdempotencyKey()).not.toBe(a)
  })

  it('builds a v4 UUID from random bytes when randomUUID is unavailable', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T) => real.getRandomValues(array),
    })
    try {
      const key = newIdempotencyKey()
      expect(key).toMatch(UUID_RE)
      expect(key[14]).toBe('4')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('buildCheckoutBody', () => {
  it('sends ids and quantities only — never a price or a total', () => {
    const body = buildCheckoutBody([KIT, CLASS], DELIVERY, 'key-1')
    expect(body).toEqual({
      idempotency_key: 'key-1',
      items: [
        { type: 'KIT', kit_id: 1, quantity: 2 },
        { type: 'CLASS', class_id: 1, child_id: 7 },
      ],
      delivery: { name: 'Nadia Rahman', phone_wa: '6281211112222', address: 'Jl. Kemang Raya 12' },
      notes: null,
    })
    expect(JSON.stringify(body)).not.toMatch(/price|total|fee/)
  })

  it('drops the address when there is no kit', () => {
    expect(buildCheckoutBody([CLASS], DELIVERY, 'k')?.delivery.address).toBeNull()
  })

  it('is null while a class line has no child, or the cart is empty', () => {
    expect(buildCheckoutBody([{ ...CLASS, child_id: null }], DELIVERY, 'k')).toBeNull()
    expect(buildCheckoutBody([], DELIVERY, 'k')).toBeNull()
  })
})

describe('checkoutErrorView', () => {
  it.each([
    ['out_of_stock', 'Stok tidak mencukupi', 'cart'],
    ['class_full', 'Kelas sudah penuh', 'cart'],
    ['item_unavailable', 'Item sudah tidak tersedia', 'cart'],
    ['already_enrolled', 'Anak sudah terdaftar', 'details'],
    ['too_many_pending_orders', 'Masih ada pesanan yang menunggu', 'orders'],
    ['not_found', 'Data anak tidak ditemukan', 'details'],
    ['internal', 'Pesanan belum terkirim', 'retry'],
    ['network_error', 'Pesanan belum terkirim', 'retry'],
  ])('maps %s to "%s" with %s recovery', (code, title, recovery) => {
    const view = checkoutErrorView(new ApiError(code, 'Pesan server.', 409))
    expect(view).toMatchObject({ code, title, recovery })
  })

  it('keeps the server sentence (it names the item)', () => {
    const err = new ApiError(
      'out_of_stock',
      'Stok Set Suara & Pasir tidak mencukupi (tersisa 4).',
      409,
    )
    expect(checkoutErrorView(err).message).toBe(
      'Stok Set Suara & Pasir tidak mencukupi (tersisa 4).',
    )
  })

  it('routes delivery field errors back to the details step', () => {
    const err = new ApiError('validation_error', 'Data tidak valid.', 422, {
      fields: { 'delivery.address': 'Alamat wajib diisi.', notes: 'Terlalu panjang.' },
    })
    expect(checkoutErrorView(err)).toMatchObject({
      recovery: 'details',
      fieldErrors: { address: 'Alamat wajib diisi.', notes: 'Terlalu panjang.' },
    })
  })

  it('sends item-level validation errors back to the cart', () => {
    const err = new ApiError('validation_error', 'Jumlah tidak valid.', 422, {
      fields: { 'items.0.quantity': 'Maksimal 10.' },
    })
    expect(checkoutErrorView(err)).toMatchObject({ recovery: 'cart', fieldErrors: {} })
  })

  it('treats a non-API error as retryable', () => {
    expect(checkoutErrorView(new Error('boom'))).toMatchObject({
      code: 'internal',
      recovery: 'retry',
      message: 'Terjadi kesalahan. Coba lagi.',
    })
  })
})

describe('checkout attempts (stable key per request body)', () => {
  const body = (delivery: DeliveryData, items: CartItem[] = [CLASS, KIT]) => {
    const built = buildCheckoutBody(items, delivery, 'ignored-key')
    if (!built) throw new Error('body')
    return built
  }

  it('serializes objects with sorted keys', () => {
    expect(stableStringify({ b: 1, a: [{ d: null, c: 'x' }] })).toBe(
      '{"a":[{"c":"x","d":null}],"b":1}',
    )
    expect(stableStringify('x')).toBe('"x"')
  })

  it('fingerprints items, delivery and notes but not the key', () => {
    const a = checkoutFingerprint(body(DELIVERY))
    const sameWithOtherKey = checkoutFingerprint({ ...body(DELIVERY), idempotency_key: 'other' })
    expect(sameWithOtherKey).toBe(a)
    expect(checkoutFingerprint(body({ ...DELIVERY, address: 'Jl. Damai 1' }))).not.toBe(a)
    expect(checkoutFingerprint(body({ ...DELIVERY, notes: 'Mohon cepat' }))).not.toBe(a)
    expect(checkoutFingerprint(body(DELIVERY, [CLASS, { ...KIT, quantity: 3 }]))).not.toBe(a)
  })

  it('reuses the key while the request is unchanged', () => {
    const makeKey = vi.fn().mockReturnValueOnce('key-1').mockReturnValueOnce('key-2')
    const first = nextAttempt(null, 'fp-a', makeKey)
    expect(first).toEqual({ key: 'key-1', fingerprint: 'fp-a' })
    expect(nextAttempt(first, 'fp-a', makeKey)).toBe(first)
    expect(nextAttempt(first, 'fp-b', makeKey)).toEqual({ key: 'key-2', fingerprint: 'fp-b' })
    expect(makeKey).toHaveBeenCalledTimes(2)
  })
})

describe('safeHttpsUrl', () => {
  it('accepts only https URLs', () => {
    expect(safeHttpsUrl('https://wa.me/62812?text=a')).toBe('https://wa.me/62812?text=a')
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpsUrl('http://wa.me/1')).toBeNull()
    expect(safeHttpsUrl('not a url')).toBeNull()
  })
})
