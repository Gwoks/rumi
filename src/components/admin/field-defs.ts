/**
 * Field definitions for the config-driven admin ResourceManager (plan:
 * "Admin CRUD"). A `FieldDef[]` describes a form; these pure helpers
 *  - turn a record into editable form values (`initialFormValues`),
 *  - parse + validate them, mirroring the PRD §5.8.5 rules so errors show
 *    before a round trip (`validateFields`),
 *  - build the request body — the full object on create, only the changed
 *    keys on edit (§5.4.9 PATCH semantics) (`buildPayload`),
 *  - map a server `validation_error` `fields` map back onto the form
 *    (`mapServerFieldErrors`).
 * The server stays authoritative; this only keeps the UI honest.
 */
import { TIME_RE } from '@/api/enums'
import { t } from '@/lib/copy'
import { formatRupiah, parseDateStr } from '@/lib/format'
import { charLength } from '@/lib/validation'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'time'
  | 'select'
  | 'checkbox'
  | 'url'
  | 'json'

/** Raw control value: text for inputs/selects, boolean for checkboxes. */
export type FormValue = string | boolean
export type FormValues = Readonly<Record<string, FormValue>>
/** Parsed value sent to the API (`null` clears an optional field). */
export type ParsedValue = string | number | boolean | null | Record<string, unknown>
export type ParsedValues = Readonly<Record<string, ParsedValue>>
export type FieldErrors = Readonly<Record<string, string>>
export type FormMode = 'create' | 'edit'

export interface FieldOption {
  value: string
  label: string
}

export type FieldOptions = readonly FieldOption[] | ((values: FormValues) => readonly FieldOption[])

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  hint?: string
  placeholder?: string
  /** `select` options; a function makes them depend on other values. */
  options?: FieldOptions
  /** Inclusive integer bounds (`number`, `money`). */
  min?: number
  max?: number
  /** Unicode-aware length bounds after trimming (`text`, `textarea`, `url`). */
  minLength?: number
  maxLength?: number
  /** Value for a new record (create mode). */
  defaultValue?: FormValue
  /** Sent on create only; shown read-only on edit (immutable server-side). */
  createOnly?: boolean
  /** Extra rule after type parsing; return an Indonesian message or null. */
  validation?: (value: ParsedValue, values: ParsedValues) => string | null
}

type ParseResult = { ok: true; value: ParsedValue } | { ok: false; error: string }

const ok = (value: ParsedValue): ParseResult => ({ ok: true, value })
const fail = (error: string): ParseResult => ({ ok: false, error })
const required = () => fail(t('common.validation.required'))

const WIDE_TYPES: ReadonlySet<FieldType> = new Set(['textarea', 'json', 'checkbox'])

/** Textareas, JSON editors and checkboxes span the full form width. */
export function isWideField(field: FieldDef): boolean {
  return WIDE_TYPES.has(field.type)
}

export function resolveOptions(field: FieldDef, values: FormValues): readonly FieldOption[] {
  if (!field.options) return []
  return typeof field.options === 'function' ? field.options(values) : field.options
}

function emptyValue(field: FieldDef): FormValue {
  return field.type === 'checkbox' ? false : ''
}

function toFormValue(field: FieldDef, raw: unknown): FormValue {
  if (field.type === 'checkbox') return raw === true
  if (raw === undefined || raw === null) return ''
  if (field.type === 'json') return JSON.stringify(raw, null, 2)
  return String(raw)
}

/** Form values for a record (edit) or from the field defaults (create). */
export function initialFormValues(
  fields: readonly FieldDef[],
  record?: Readonly<Record<string, unknown>> | null,
): FormValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      record ? toFormValue(field, record[field.name]) : (field.defaultValue ?? emptyValue(field)),
    ]),
  )
}

function parseText(field: FieldDef, raw: string): ParseResult {
  const value = raw.trim()
  if (value.length === 0) return field.required ? required() : ok(null)
  const length = charLength(value)
  if (field.minLength !== undefined && length < field.minLength) {
    return fail(t('common.validation.minChars', { n: field.minLength }))
  }
  if (field.maxLength !== undefined && length > field.maxLength) {
    return fail(t('common.validation.maxChars', { n: field.maxLength }))
  }
  // PRD §5.8.6: `https://…` or a same-origin path — never protocol-relative
  // `//host`, and never a backslash (browsers read `/\host` as `//host`).
  const isUrlOk =
    (value.startsWith('https://') || (value.startsWith('/') && !value.startsWith('//'))) &&
    !value.includes('\\')
  if (field.type === 'url' && !isUrlOk) return fail(t('admin.validation.url'))
  return ok(value)
}

function parseInteger(field: FieldDef, raw: string): ParseResult {
  const isMoney = field.type === 'money'
  const cleaned = isMoney ? raw.replace(/^\s*rp/i, '').replace(/[\s.]/g, '') : raw.trim()
  if (cleaned.length === 0) return field.required ? required() : ok(null)
  const value = Number(cleaned)
  if (!/^-?\d+$/.test(cleaned) || !Number.isSafeInteger(value)) {
    return fail(t(isMoney ? 'admin.validation.money' : 'admin.validation.integer'))
  }
  const show = (n: number) => (isMoney ? formatRupiah(n) : String(n))
  if (field.min !== undefined && value < field.min) {
    return fail(t('admin.validation.min', { n: show(field.min) }))
  }
  if (field.max !== undefined && value > field.max) {
    return fail(t('admin.validation.max', { n: show(field.max) }))
  }
  return ok(value)
}

function parseJson(field: FieldDef, raw: string): ParseResult {
  if (raw.trim().length === 0) return field.required ? required() : ok(null)
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return fail(t('admin.validation.json'))
  }
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
  return isObject ? ok(value as Record<string, unknown>) : fail(t('admin.validation.jsonObject'))
}

function parseSelect(field: FieldDef, raw: string, values: FormValues): ParseResult {
  if (raw.length === 0) return field.required ? required() : ok(null)
  const options = resolveOptions(field, values)
  if (options.length > 0 && !options.some((o) => o.value === raw)) {
    return fail(t('admin.validation.option'))
  }
  return ok(raw)
}

/** Parse one control value by its field type. */
export function parseField(field: FieldDef, raw: FormValue, values: FormValues): ParseResult {
  if (field.type === 'checkbox') return ok(raw === true)
  const text = typeof raw === 'string' ? raw : ''
  switch (field.type) {
    case 'number':
    case 'money':
      return parseInteger(field, text)
    case 'date':
      if (!text) return field.required ? required() : ok(null)
      return parseDateStr(text) ? ok(text) : fail(t('common.validation.date'))
    case 'time':
      if (!text) return field.required ? required() : ok(null)
      return TIME_RE.test(text) ? ok(text) : fail(t('admin.validation.time'))
    case 'select':
      return parseSelect(field, text, values)
    case 'json':
      return parseJson(field, text)
    default:
      return parseText(field, text)
  }
}

function parseAll(
  fields: readonly FieldDef[],
  values: FormValues,
): { data: Record<string, ParsedValue>; errors: Record<string, string> } {
  const entries = fields.map(
    (field) =>
      [field.name, parseField(field, values[field.name] ?? emptyValue(field), values)] as const,
  )
  return {
    data: Object.fromEntries(
      entries.flatMap(([name, r]) => (r.ok ? [[name, r.value] as const] : [])),
    ),
    errors: Object.fromEntries(
      entries.flatMap(([name, r]) => (r.ok ? [] : [[name, r.error] as const])),
    ),
  }
}

export type ValidationResult =
  | { success: true; data: ParsedValues }
  | { success: false; errors: FieldErrors }

/** Parse every field, then run each field's extra `validation` with all parsed values. */
export function validateFields(fields: readonly FieldDef[], values: FormValues): ValidationResult {
  const { data, errors } = parseAll(fields, values)
  const ruleErrors = Object.fromEntries(
    fields.flatMap((field) => {
      if (!field.validation || field.name in errors) return []
      const message = field.validation(data[field.name], data)
      return message ? [[field.name, message] as const] : []
    }),
  )
  const allErrors = { ...errors, ...ruleErrors }
  return Object.keys(allErrors).length > 0
    ? { success: false, errors: allErrors }
    : { success: true, data }
}

/** Parsed values that parse cleanly (the edit baseline for `buildPayload`). */
export function parseBaseline(fields: readonly FieldDef[], values: FormValues): ParsedValues {
  return parseAll(fields, values).data
}

function isSame(a: ParsedValue | undefined, b: ParsedValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The request body: every field on create; on edit only the changed fields
 * that are not `createOnly` (an empty object means "no changes").
 */
export function buildPayload(
  fields: readonly FieldDef[],
  data: ParsedValues,
  mode: FormMode,
  baseline: ParsedValues = {},
): Record<string, ParsedValue> {
  const editable = fields.filter((field) => mode === 'create' || !field.createOnly)
  const entries = editable.map((field) => [field.name, data[field.name] ?? null] as const)
  if (mode === 'create') return Object.fromEntries(entries)
  return Object.fromEntries(entries.filter(([name, value]) => !isSame(value, baseline[name])))
}

/**
 * Map a server `fields` map (dotted paths, e.g. `body.cards.0.title`) onto
 * the form: a path matches the field with the same name or a `name.` prefix
 * (the sub-path is kept in the message). Unmatched messages are returned for
 * a form-level alert.
 */
export function mapServerFieldErrors(
  fields: readonly FieldDef[],
  serverFields: Readonly<Record<string, string>>,
): { errors: FieldErrors; unmatched: string[] } {
  const matched = Object.entries(serverFields).map(([path, message]) => {
    const field = fields.find((f) => path === f.name || path.startsWith(`${f.name}.`))
    if (!field) return { name: null, message }
    const detail =
      path === field.name ? message : `${path.slice(field.name.length + 1)}: ${message}`
    return { name: field.name, message: detail }
  })
  const errors = matched.reduce<Record<string, string>>((acc, { name, message }) => {
    if (name === null) return acc
    return { ...acc, [name]: acc[name] ? `${acc[name]} ${message}` : message }
  }, {})
  const unmatched = matched.filter((m) => m.name === null).map((m) => m.message)
  return { errors, unmatched }
}
