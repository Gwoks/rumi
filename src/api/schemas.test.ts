import { describe, expect, it } from 'vitest'
import { CMS_SEED } from '@/test/cms-seed'
import { makeOrder } from '@/test/factories'
import {
  CMS_REGISTRY,
  cmsBodySchemaFor,
  cmsSectionKeys,
  dateStrSchema,
  envelope,
  errorEnvelopeSchema,
  heroBodySchema,
  idrSchema,
  orderSchema,
  parseCmsBody,
  timestampSchema,
  timeStrSchema,
} from './schemas'

describe('scalars (PRD §5.4.1)', () => {
  it('validates formats', () => {
    expect(timestampSchema.safeParse('2026-11-08T03:15:00Z').success).toBe(true)
    expect(timestampSchema.safeParse('2026-11-08T03:15:00.123Z').success).toBe(false)
    expect(dateStrSchema.safeParse('2026-02-29').success).toBe(false)
    expect(dateStrSchema.safeParse('2028-02-29').success).toBe(true)
    expect(timeStrSchema.safeParse('23:59').success).toBe(true)
    expect(timeStrSchema.safeParse('24:00').success).toBe(false)
    expect(idrSchema.safeParse(150000.5).success).toBe(false)
    expect(idrSchema.safeParse('150000').success).toBe(false)
  })
})

describe('envelope (PRD §5.1)', () => {
  it('accepts success and error shapes', () => {
    expect(
      envelope(orderSchema).safeParse({ success: true, data: makeOrder(), error: null }).success,
    ).toBe(true)
    expect(
      envelope(orderSchema).safeParse({ success: false, data: makeOrder(), error: null }).success,
    ).toBe(false)
    expect(
      errorEnvelopeSchema.safeParse({ success: false, data: null, error: 'x', code: 'not_found' })
        .success,
    ).toBe(true)
  })

  it('rejects a missing nullable key (every DTO key is always present)', () => {
    const { notes: _omitted, ...withoutNotes } = makeOrder()
    expect(orderSchema.safeParse(withoutNotes).success).toBe(false)
  })
})

describe('CMS registry (PRD §5.7)', () => {
  it('has exactly the 9 registered pairs', () => {
    const pairs = Object.entries(CMS_REGISTRY).flatMap(([page, sections]) =>
      Object.keys(sections).map((key) => `${page}/${key}`),
    )
    expect(pairs).toEqual([
      'home/hero',
      'home/rumi_way',
      'who-we-are/founder_message',
      'who-we-are/philosophy',
      'who-we-are/mission',
      'who-we-are/educators',
      'our-approach/intro',
      'our-approach/domains',
      'our-approach/values',
    ])
    expect(cmsSectionKeys('home')).toEqual(['hero', 'rumi_way'])
  })

  it('validates every seed body (PRD §5.11.3)', () => {
    for (const [page, sections] of Object.entries(CMS_SEED)) {
      for (const [key, seed] of Object.entries(sections)) {
        expect(cmsBodySchemaFor(page, key)?.safeParse(seed.body).success, `${page}/${key}`).toBe(
          true,
        )
      }
    }
  })

  it('is strict: unknown keys, bad lengths and unknown pairs fail', () => {
    const hero = CMS_SEED.home.hero.body
    expect(heroBodySchema.safeParse({ ...hero, extra: 1 }).success).toBe(false)
    expect(heroBodySchema.safeParse({ ...hero, eyebrow: '   ' }).success).toBe(false)
    expect(heroBodySchema.safeParse({ ...hero, eyebrow: 'x'.repeat(121) }).success).toBe(false)
    expect(cmsBodySchemaFor('home', 'nope')).toBeNull()
    expect(cmsBodySchemaFor('nope', 'hero')).toBeNull()
  })

  it('rejects duplicate domains', () => {
    const domains = CMS_SEED['our-approach'].domains.body
    const dup = { ...domains, items: [domains.items[0], domains.items[0]] }
    expect(cmsBodySchemaFor('our-approach', 'domains')?.safeParse(dup).success).toBe(false)
  })

  it('parses a typed body or returns null', () => {
    expect(parseCmsBody('home', 'hero', CMS_SEED.home.hero.body)?.heading_highlight).toBe(
      'bertanya & bertumbuh.',
    )
    expect(parseCmsBody('home', 'hero', { eyebrow: 'x' })).toBeNull()
    expect(parseCmsBody('home', 'nope' as 'hero', {})).toBeNull()
  })
})
