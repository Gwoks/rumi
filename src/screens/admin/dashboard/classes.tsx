/**
 * "Kelas" — ResourceManager configured for weekend classes (PRD §5.8.5
 * #27–#30, ClassCreate / ClassPatch rules): title 3–120, description 1–2000,
 * location 3–160, ages 0–12 with max ≥ min, date, start/end (end > start),
 * fee 0–100.000.000, capacity 1–200, status (default DRAFT). The server adds
 * the "start must be upcoming", "capacity ≥ seats booked" and 409 rules.
 */
import { api } from '@/api/client'
import { CLASS_STATUS_VALUES } from '@/api/enums'
import type { ClassCreate, ClassPatch, WeekendClass } from '@/api/schemas'
import type { FieldDef, ParsedValue, ParsedValues } from '@/components/admin/field-defs'
import { ResourceManager, type ResourceColumn } from '@/components/admin/resource-manager'
import { Price } from '@/components/rumi/price'
import { ClassStatusBadge } from '@/components/rumi/status-badge'
import { t } from '@/lib/copy'
import { formatDateLong } from '@/lib/format'
import { IMAGE_URL_MAX, MAX_IDR } from './shared'

const MAX_AGE = 12
const MAX_CAPACITY = 200

const STATUS_OPTIONS = CLASS_STATUS_VALUES.map((status) => ({
  value: status,
  label: t(`common.classStatus.${status}`),
}))

const ageMaxRule = (value: ParsedValue, values: ParsedValues): string | null =>
  typeof value === 'number' && typeof values.age_min === 'number' && value < values.age_min
    ? t('admin.validation.ageRange')
    : null

const endTimeRule = (value: ParsedValue, values: ParsedValues): string | null =>
  typeof value === 'string' && typeof values.start_time === 'string' && value <= values.start_time
    ? t('admin.validation.endTime')
    : null

const CLASS_FIELDS: readonly FieldDef[] = [
  {
    name: 'title',
    label: t('admin.classes.field.title'),
    type: 'text',
    required: true,
    minLength: 3,
    maxLength: 120,
  },
  {
    name: 'location',
    label: t('admin.classes.field.location'),
    type: 'text',
    required: true,
    minLength: 3,
    maxLength: 160,
  },
  {
    name: 'description',
    label: t('admin.classes.field.description'),
    type: 'textarea',
    required: true,
    maxLength: 2000,
  },
  { name: 'date', label: t('admin.classes.field.date'), type: 'date', required: true },
  {
    name: 'status',
    label: t('admin.classes.field.status'),
    type: 'select',
    required: true,
    options: STATUS_OPTIONS,
    defaultValue: 'DRAFT',
  },
  { name: 'start_time', label: t('admin.classes.field.start'), type: 'time', required: true },
  {
    name: 'end_time',
    label: t('admin.classes.field.end'),
    type: 'time',
    required: true,
    validation: endTimeRule,
  },
  {
    name: 'age_min',
    label: t('admin.classes.field.ageMin'),
    type: 'number',
    required: true,
    min: 0,
    max: MAX_AGE,
    defaultValue: '3',
  },
  {
    name: 'age_max',
    label: t('admin.classes.field.ageMax'),
    type: 'number',
    required: true,
    min: 0,
    max: MAX_AGE,
    defaultValue: '6',
    validation: ageMaxRule,
  },
  {
    name: 'fee_idr',
    label: t('admin.classes.field.fee'),
    type: 'money',
    required: true,
    min: 0,
    max: MAX_IDR,
  },
  {
    name: 'capacity',
    label: t('admin.classes.field.capacity'),
    type: 'number',
    required: true,
    min: 1,
    max: MAX_CAPACITY,
    defaultValue: '12',
  },
  {
    name: 'image_url',
    label: t('admin.classes.field.image'),
    type: 'url',
    maxLength: IMAGE_URL_MAX,
  },
]

const CLASS_COLUMNS: readonly ResourceColumn<WeekendClass>[] = [
  {
    key: 'class',
    header: t('admin.classes.col.class'),
    render: (c) => (
      <>
        <span className="block font-semibold">{c.title}</span>
        <span className="block text-caption text-ink-secondary">{c.location}</span>
      </>
    ),
  },
  {
    key: 'schedule',
    header: t('admin.classes.col.schedule'),
    className: 'text-ink-secondary',
    render: (c) => t('admin.classes.schedule', { date: formatDateLong(c.date), time: c.time_slot }),
  },
  { key: 'fee', header: t('admin.classes.col.fee'), render: (c) => <Price amount={c.fee_idr} /> },
  {
    key: 'seats',
    header: t('admin.classes.col.seats'),
    className: 'tabular-nums',
    render: (c) => t('admin.classes.seats', { booked: c.seats_booked, capacity: c.capacity }),
  },
  {
    key: 'status',
    header: t('admin.classes.col.status'),
    render: (c) => <ClassStatusBadge status={c.status} isFull={c.is_full} />,
  },
]

export function ClassesManager() {
  return (
    <ResourceManager<WeekendClass>
      title={t('admin.classes.title')}
      description={t('admin.classes.description')}
      singular={t('admin.classes.singular')}
      columns={CLASS_COLUMNS}
      fields={CLASS_FIELDS}
      itemLabel={(c) => c.title}
      load={() => api.adminListClasses()}
      create={(payload) => api.adminCreateClass(payload as ClassCreate)}
      update={(id, payload) => api.adminUpdateClass(id, payload as ClassPatch)}
      remove={(id) => api.adminDeleteClass(id)}
    />
  )
}
