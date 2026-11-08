/**
 * Formatting at the edge (PRD §5.4.3, DESIGN.md "Do"). Money is integer IDR,
 * dates are `YYYY-MM-DD`, timestamps are RFC 3339 `…Z`, and business time is
 * WIB (UTC+7, no DST).
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** "Rp 1.250.000" / "-Rp 25.000" — must equal fixtures/rupiah.json (PRD §5.4.3). */
export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount).replace(/ /g, ' ')
}

/** Parse a `YYYY-MM-DD` string into a UTC-midnight Date, or null if not a real date. */
export function parseDateStr(value: string): Date | null {
  const m = DATE_RE.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  const isReal =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  return isReal ? date : null
}

function utcFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...options })
}

const shortDate = utcFormatter({ day: 'numeric', month: 'short', year: 'numeric' })
const longDate = utcFormatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const monthYear = utcFormatter({ month: 'short', year: 'numeric' })
const monthShort = utcFormatter({ month: 'short' })

/** "14 Nov 2026". Returns the input unchanged when it is not a real date. */
export function formatDate(value: string): string {
  const date = parseDateStr(value)
  return date ? shortDate.format(date) : value
}

/** "Sabtu, 14 November 2026" (the WhatsApp `{tanggal}` shape). */
export function formatDateLong(value: string): string {
  const date = parseDateStr(value)
  return date ? longDate.format(date) : value
}

/** Date-tile parts: day "14", month "NOV", and the full label for `aria-label`. */
export function dateTileParts(value: string): { day: string; month: string; label: string } {
  const date = parseDateStr(value)
  if (!date) return { day: '', month: '', label: value }
  return {
    day: String(date.getUTCDate()),
    month: monthShort.format(date).replace('.', '').toUpperCase(),
    label: longDate.format(date),
  }
}

/** "2026-11" (Metrics.revenue_by_month) → "Nov 2026". */
export function formatMonth(value: string): string {
  const m = MONTH_RE.exec(value)
  if (!m) return value
  return monthYear.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)))
}

/** RFC 3339 timestamp → WIB wall clock "8 Nov 2026, 10:15 WIB". */
export function formatDateTime(timestamp: string): string {
  const ms = Date.parse(timestamp)
  if (Number.isNaN(ms)) return timestamp
  const wib = new Date(ms + WIB_OFFSET_MS)
  const hh = String(wib.getUTCHours()).padStart(2, '0')
  const mm = String(wib.getUTCMinutes()).padStart(2, '0')
  return `${shortDate.format(wib)}, ${hh}:${mm} WIB`
}

/** Today's calendar date in WIB as `YYYY-MM-DD` (PRD §5.4.2 "today"). */
export function todayWib(now: Date = new Date()): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * Full years from `dob` to `today` (PRD §5.4.3): the age goes up when today's
 * (month, day) is on or after the dob's — so a 29 Feb birthday is reached on
 * 1 Mar in non-leap years. Returns null for an invalid date.
 */
export function ageFromDob(dob: string, today: string = todayWib()): number | null {
  const birth = parseDateStr(dob)
  const now = parseDateStr(today)
  if (!birth || !now) return null
  const years = now.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayReached =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate())
  return birthdayReached ? years : years - 1
}

/** "Nadia Rahman" → "NR" (max 2 letters, uppercase). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? '')
    .join('')
}
