/**
 * ChildSwitcher: picks which child the parent dashboard shows. Presentational
 * and controlled — the screen loads the children (`api.listChildren`) and
 * keeps the selection in the URL (`?child=`). A labelled native select (always
 * keyboard- and screen-reader-friendly) next to the child's initials tile.
 */
import type { Child } from '@/api/schemas'
import { Field, Select } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { initials } from '@/lib/format'

export type ChildOption = Pick<Child, 'id' | 'name' | 'age_years'>

export interface ChildSwitcherProps {
  items: readonly ChildOption[]
  value: number | null
  onChange: (childId: number) => void
  className?: string
}

export function ChildSwitcher({ items, value, onChange, className }: ChildSwitcherProps) {
  const selected = items.find((c) => c.id === value) ?? items[0] ?? null
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <span
        aria-hidden="true"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-highlight-soft text-body-sm font-bold text-ink"
      >
        {selected ? initials(selected.name) : ''}
      </span>
      <Field label={t('parent.childSwitcher.label')} className="min-w-48 flex-1">
        {(control) => (
          <Select
            {...control}
            value={selected ? String(selected.id) : ''}
            disabled={items.length === 0}
            onChange={(event) => onChange(Number(event.target.value))}
          >
            {items.map((child) => (
              <option key={child.id} value={child.id}>
                {t('parent.childSwitcher.option', { name: child.name, age: child.age_years })}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  )
}
