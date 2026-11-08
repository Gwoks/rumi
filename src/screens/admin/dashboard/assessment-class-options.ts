/**
 * Which classes an assessment may reference (PRD §5.8.5 AssessmentCreate
 * `class_id`): only ones the child really took part in — a CONFIRMED or
 * ATTENDED enrollment — whose class date is today or earlier (WIB). Cancelled,
 * unpaid (RESERVED), absent and future classes are left out. Each class is
 * listed once, in the enrollment order (newest first).
 */
import type { Enrollment, EnrollmentStatus } from '@/api/schemas'
import { t } from '@/lib/copy'
import { formatDate, todayWib } from '@/lib/format'

const LOGGABLE: ReadonlySet<EnrollmentStatus> = new Set(['CONFIRMED', 'ATTENDED'])

export interface ClassOption {
  value: string
  label: string
}

export function assessmentClassOptions(
  enrollments: readonly Enrollment[],
  today: string = todayWib(),
): ClassOption[] {
  const seen = new Set<number>()
  return enrollments.flatMap((e) => {
    if (!LOGGABLE.has(e.status) || e.class_date > today || seen.has(e.class_id)) return []
    seen.add(e.class_id)
    const label = t('admin.assessment.classOption', {
      title: e.class_title,
      date: formatDate(e.class_date),
    })
    return [{ value: String(e.class_id), label }]
  })
}
