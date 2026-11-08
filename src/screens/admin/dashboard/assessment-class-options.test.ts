import { describe, expect, it } from 'vitest'
import { makeEnrollment } from '@/test/factories'
import { assessmentClassOptions } from './assessment-class-options'

const TODAY = '2026-11-20'

describe('assessmentClassOptions', () => {
  it('offers only classes the child actually took part in, held today or earlier', () => {
    const options = assessmentClassOptions(
      [
        makeEnrollment({
          id: 1,
          class_id: 10,
          class_title: 'Hari Ini',
          class_date: TODAY,
          status: 'CONFIRMED',
        }),
        makeEnrollment({
          id: 2,
          class_id: 11,
          class_title: 'Hadir',
          class_date: '2026-11-14',
          status: 'ATTENDED',
        }),
        makeEnrollment({
          id: 3,
          class_id: 12,
          class_title: 'Batal',
          class_date: '2026-11-07',
          status: 'CANCELLED',
        }),
        makeEnrollment({
          id: 4,
          class_id: 13,
          class_title: 'Nanti',
          class_date: '2026-11-28',
          status: 'CONFIRMED',
        }),
        makeEnrollment({
          id: 5,
          class_id: 14,
          class_title: 'Belum Bayar',
          class_date: '2026-11-01',
          status: 'RESERVED',
        }),
        makeEnrollment({
          id: 6,
          class_id: 15,
          class_title: 'Absen',
          class_date: '2026-10-31',
          status: 'ABSENT',
        }),
      ],
      TODAY,
    )
    expect(options.map((o) => o.value)).toEqual(['10', '11'])
    expect(options[1].label).toBe('Hadir · 14 Nov 2026')
  })

  it('lists a class once even with several enrollments', () => {
    const options = assessmentClassOptions(
      [
        makeEnrollment({ id: 1, class_id: 10, class_date: '2026-11-14', status: 'ATTENDED' }),
        makeEnrollment({ id: 2, class_id: 10, class_date: '2026-11-14', status: 'CONFIRMED' }),
      ],
      TODAY,
    )
    expect(options).toHaveLength(1)
  })

  it('is empty when nothing qualifies', () => {
    expect(assessmentClassOptions([], TODAY)).toEqual([])
  })
})
