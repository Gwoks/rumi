/** Parent dashboard sections (`?tab=`) and small pure helpers shared by them. */
import type { Child, Enrollment } from '@/api/schemas'

export const PARENT_TABS = ['overview', 'attendance', 'progress', 'orders'] as const
export type ParentTab = (typeof PARENT_TABS)[number]

/** Child-scoped sections (everything except "Pesanan"). */
export type ChildTab = Exclude<ParentTab, 'orders'>

export const CHILD_PARAM = 'child'

/** The child named by `?child=`, else the first child, else null. */
export function pickChild(children: readonly Child[], raw: string | null): Child | null {
  const requested = Number(raw)
  return children.find((c) => c.id === requested) ?? children[0] ?? null
}

const ACTIVE_STATUSES: ReadonlySet<Enrollment['status']> = new Set(['RESERVED', 'CONFIRMED'])

/** The soonest RESERVED/CONFIRMED enrollment on or after `today` (WIB date). */
export function nextUpcomingEnrollment(
  enrollments: readonly Enrollment[],
  today: string,
): Enrollment | null {
  return (
    [...enrollments]
      .filter((e) => ACTIVE_STATUSES.has(e.status) && e.class_date >= today)
      .sort(
        (a, b) =>
          a.class_date.localeCompare(b.class_date) ||
          a.class_time_slot.localeCompare(b.class_time_slot),
      )[0] ?? null
  )
}

/** Only ever open a WhatsApp deep link the server built (`https://wa.me/…`). */
export function isWhatsAppUrl(url: string): boolean {
  return url.startsWith('https://wa.me/')
}
