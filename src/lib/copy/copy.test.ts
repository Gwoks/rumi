import { describe, expect, it } from 'vitest'
import { COPY_AREAS, copy, isCopyKey, t } from './index'

const PREFIX: Record<keyof typeof COPY_AREAS, string> = {
  common: 'common.',
  designKit: 'designKit.',
  public: 'public.',
  auth: 'auth.',
  parent: 'parent.',
  admin: 'admin.',
}

describe('copy', () => {
  it('keeps every area file inside its own prefix (lanes never collide)', () => {
    for (const [area, table] of Object.entries(COPY_AREAS)) {
      const prefix = PREFIX[area as keyof typeof COPY_AREAS]
      for (const key of Object.keys(table))
        expect(key.startsWith(prefix), `${area}: ${key}`).toBe(true)
    }
  })

  it('merges every area without losing keys', () => {
    const total = Object.values(COPY_AREAS).reduce((n, table) => n + Object.keys(table).length, 0)
    expect(Object.keys(copy)).toHaveLength(total)
  })

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(copy)) expect(value.trim(), key).not.toBe('')
  })

  it('interpolates {slots}', () => {
    expect(t('common.seats.few', { n: 2 })).toBe('Sisa 2 kursi')
    expect(t('common.cart.open.aria', { count: 3 })).toBe('Lihat keranjang, 3 item')
  })

  it('returns the raw string without vars', () => {
    expect(t('common.nav.home')).toBe('Beranda')
  })

  it('guards runtime keys', () => {
    expect(isCopyKey('common.nav.home')).toBe(true)
    expect(isCopyKey('common.nope')).toBe(false)
  })

  it('carries the PRD §5.5 enum labels', () => {
    expect(t('common.orderStatus.PENDING_WA')).toBe('Menunggu Konfirmasi')
    expect(t('common.level.3')).toBe('Berlatih Mandiri')
    expect(t('common.domain.ISLAMIC_STUDIES')).toBe('Studi Islam')
    expect(t('common.enrollmentStatus.ABSENT')).toBe('Tidak Hadir')
  })
})
