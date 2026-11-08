import { describe, expect, it } from 'vitest'
import cases from '../../fixtures/rupiah.json'
import {
  ageFromDob,
  dateTileParts,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatMonth,
  formatRupiah,
  initials,
  parseDateStr,
  todayWib,
} from './format'

describe('formatRupiah', () => {
  it.each(cases)(
    'formats $amount as "$formatted" (fixtures/rupiah.json)',
    ({ amount, formatted }) => {
      expect(formatRupiah(amount)).toBe(formatted)
    },
  )

  it('never emits a non-breaking space', () => {
    expect(formatRupiah(150000)).not.toMatch(/ /)
  })
})

describe('dates', () => {
  it('parses only real calendar dates', () => {
    expect(parseDateStr('2026-11-14')?.toISOString()).toBe('2026-11-14T00:00:00.000Z')
    expect(parseDateStr('2026-02-30')).toBeNull()
    expect(parseDateStr('14-11-2026')).toBeNull()
  })

  it('formats short and long Indonesian dates', () => {
    expect(formatDate('2026-11-14')).toBe('14 Nov 2026')
    expect(formatDateLong('2026-11-14')).toBe('Sabtu, 14 November 2026')
    expect(formatDateLong('2026-11-29')).toBe('Minggu, 29 November 2026')
  })

  it('returns invalid input unchanged', () => {
    expect(formatDate('nope')).toBe('nope')
    expect(formatDateLong('nope')).toBe('nope')
    expect(formatMonth('nope')).toBe('nope')
    expect(formatDateTime('nope')).toBe('nope')
    expect(dateTileParts('nope')).toEqual({ day: '', month: '', label: 'nope' })
  })

  it('builds date-tile parts', () => {
    expect(dateTileParts('2026-11-14')).toEqual({
      day: '14',
      month: 'NOV',
      label: 'Sabtu, 14 November 2026',
    })
  })

  it('formats a revenue month', () => {
    expect(formatMonth('2026-11')).toBe('Nov 2026')
  })

  it('shows timestamps in WIB', () => {
    expect(formatDateTime('2026-11-08T03:15:00Z')).toBe('8 Nov 2026, 10:15 WIB')
    expect(formatDateTime('2026-11-08T20:30:00Z')).toBe('9 Nov 2026, 03:30 WIB')
  })

  it('computes today in WIB (UTC+7)', () => {
    expect(todayWib(new Date('2026-11-08T16:59:00Z'))).toBe('2026-11-08')
    expect(todayWib(new Date('2026-11-08T17:00:00Z'))).toBe('2026-11-09')
  })
})

describe('ageFromDob (PRD §5.4.3)', () => {
  it('counts full years', () => {
    expect(ageFromDob('2020-04-15', '2026-04-14')).toBe(5)
    expect(ageFromDob('2020-04-15', '2026-04-15')).toBe(6)
    expect(ageFromDob('2020-04-15', '2026-11-08')).toBe(6)
  })

  it('reaches a 29 February birthday on 1 March in non-leap years', () => {
    expect(ageFromDob('2020-02-29', '2023-02-28')).toBe(2)
    expect(ageFromDob('2020-02-29', '2023-03-01')).toBe(3)
    expect(ageFromDob('2020-02-29', '2024-02-29')).toBe(4)
  })

  it('returns null for invalid dates', () => {
    expect(ageFromDob('nope', '2026-01-01')).toBeNull()
  })

  it('defaults today to WIB today', () => {
    expect(ageFromDob(todayWib())).toBe(0)
  })
})

describe('initials', () => {
  it('takes up to two uppercase letters', () => {
    expect(initials('Nadia Rahman')).toBe('NR')
    expect(initials('ustazah mariam yusuf')).toBe('UM')
    expect(initials('  Amina ')).toBe('A')
    expect(initials('')).toBe('')
  })
})
