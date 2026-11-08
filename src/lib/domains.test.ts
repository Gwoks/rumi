import { describe, expect, it } from 'vitest'
import { DOMAIN_VALUES } from '@/api/enums'
import {
  CMS_ICONS,
  DOMAINS,
  domainMeta,
  LEVELS,
  levelPercent,
  TONE_SOFT,
  TONE_SOLID,
} from './domains'
import { t } from './copy'

describe('domains', () => {
  it('lists the five domains in canonical PRD order', () => {
    expect(DOMAINS.map((d) => d.key)).toEqual(DOMAIN_VALUES)
  })

  it('maps labels, tones and icons per DESIGN.md', () => {
    expect(t(domainMeta('LANGUAGE').labelKey)).toBe('Bahasa')
    expect(domainMeta('LANGUAGE').tone).toBe('yellow')
    expect(domainMeta('SENSORIAL').tone).toBe('orange')
    expect(domainMeta('MATH').icon).toBeTruthy()
  })

  it('throws on an unknown domain', () => {
    expect(() => domainMeta('NOPE' as never)).toThrow()
  })

  it('uses full literal tone classes', () => {
    expect(TONE_SOFT).toEqual({
      teal: 'bg-primary-soft',
      orange: 'bg-accent-soft',
      yellow: 'bg-highlight-soft',
    })
    expect(TONE_SOLID.yellow).toBe('bg-highlight')
  })

  it('maps levels and widths', () => {
    expect(LEVELS.map((l) => t(l.labelKey))).toEqual([
      'Mulai Mengenal',
      'Berkembang',
      'Berlatih Mandiri',
      'Menguasai',
    ])
    expect(levelPercent(null)).toBe(0)
    expect(levelPercent(2)).toBe(50)
    expect(levelPercent(4)).toBe(100)
  })

  it('covers every CMS icon name', () => {
    expect(Object.keys(CMS_ICONS).sort()).toEqual([
      'book',
      'hands',
      'heart',
      'leaf',
      'moon',
      'sparkles',
      'star',
      'sun',
    ])
  })
})
