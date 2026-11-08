/**
 * Class filters (PRD §5.8.2 #3): location (from the `locations` facet), a
 * date range and the child's age. The values live in the URL query
 * (`?location=&from=&to=&age=`), so a filtered list is shareable and the back
 * button works; the screen reads them back with `readClassFilters`.
 */
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { t } from '@/lib/copy'
import { DATE_STR_RE } from '@/api/enums'

export interface ClassFilterValues {
  location: string
  from: string
  to: string
  age: string
}

export const FILTER_KEYS = ['location', 'from', 'to', 'age'] as const
export const AGE_OPTIONS = [2, 3, 4, 5, 6, 7] as const
const MAX_AGE = 12

/** Read the filters from the URL, dropping malformed values. */
export function readClassFilters(params: URLSearchParams): ClassFilterValues {
  const date = (key: string) => {
    const value = params.get(key) ?? ''
    return DATE_STR_RE.test(value) ? value : ''
  }
  const rawAge = params.get('age') ?? ''
  const age = /^\d{1,2}$/.test(rawAge) && Number(rawAge) <= MAX_AGE ? rawAge : ''
  return { location: params.get('location') ?? '', from: date('from'), to: date('to'), age }
}

export function hasRangeError(values: ClassFilterValues): boolean {
  return values.from !== '' && values.to !== '' && values.from > values.to
}

export interface ClassFiltersProps {
  values: ClassFilterValues
  locations: readonly string[]
  onChange: (key: keyof ClassFilterValues, value: string) => void
  onReset: () => void
}

export function ClassFilters({ values, locations, onChange, onReset }: ClassFiltersProps) {
  const isFiltered = FILTER_KEYS.some((key) => values[key] !== '')
  const options =
    values.location && !locations.includes(values.location)
      ? [...locations, values.location]
      : locations
  return (
    <form
      aria-label={t('public.classes.filters.title')}
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <Field label={t('public.classes.filters.location')}>
        {(control) => (
          <Select
            {...control}
            value={values.location}
            onChange={(event) => onChange('location', event.target.value)}
          >
            <option value="">{t('public.classes.filters.allLocations')}</option>
            {options.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('public.classes.filters.from')}>
        {(control) => (
          <Input
            {...control}
            type="date"
            value={values.from}
            max={values.to || undefined}
            onChange={(event) => onChange('from', event.target.value)}
          />
        )}
      </Field>
      <Field
        label={t('public.classes.filters.to')}
        error={hasRangeError(values) ? t('public.classes.filters.rangeError') : null}
      >
        {(control) => (
          <Input
            {...control}
            type="date"
            value={values.to}
            min={values.from || undefined}
            onChange={(event) => onChange('to', event.target.value)}
          />
        )}
      </Field>
      <Field label={t('public.classes.filters.age')}>
        {(control) => (
          <Select
            {...control}
            value={values.age}
            onChange={(event) => onChange('age', event.target.value)}
          >
            <option value="">{t('public.classes.filters.allAges')}</option>
            {AGE_OPTIONS.map((age) => (
              <option key={age} value={String(age)}>
                {t('common.age.years', { n: age })}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button variant="soft" onClick={onReset} disabled={!isFiltered} className="lg:mb-0">
        {t('public.classes.filters.reset')}
      </Button>
    </form>
  )
}
