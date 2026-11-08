/**
 * Date tile (DESIGN.md "Date tile"): day + short month on yellow soft; the
 * full Indonesian date is the accessible name (`micro` text is allowed only
 * because the full date is given).
 */
import { dateTileParts } from '@/lib/format'

export function DateTile({ date }: { date: string }) {
  const parts = dateTileParts(date)
  return (
    <span
      role="img"
      aria-label={parts.label}
      className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-highlight-soft text-center text-ink"
    >
      <span aria-hidden="true">
        <span className="block text-xl font-bold leading-none">{parts.day}</span>
        <span className="text-micro uppercase">{parts.month}</span>
      </span>
    </span>
  )
}
