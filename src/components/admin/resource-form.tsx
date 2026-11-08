/**
 * The create/edit form the ResourceManager generates from a `FieldDef[]`:
 * one labelled control per field (text, textarea, number, money with a
 * Rupiah preview, date, time, select, checkbox, url, JSON editor), client
 * validation via field-defs.ts, and server errors (`validation_error` fields
 * next to their control, anything else — e.g. a 409 — as a form alert).
 * The form state lives inside the dialog content, so it resets every time
 * the dialog opens.
 */
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { InlineAlert } from '@/components/ui/inline-alert'
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
  type FieldControlProps,
} from '@/components/ui/input'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatRupiah } from '@/lib/format'
import {
  buildPayload,
  initialFormValues,
  isWideField,
  mapServerFieldErrors,
  parseBaseline,
  parseField,
  resolveOptions,
  validateFields,
  type FieldDef,
  type FieldErrors,
  type FormMode,
  type FormValue,
  type FormValues,
  type ParsedValue,
} from './field-defs'

export type ResourcePayload = Record<string, ParsedValue>

interface ControlProps {
  field: FieldDef
  control: FieldControlProps
  value: string
  values: FormValues
  disabled: boolean
  onChange: (value: FormValue) => void
}

function TextControl({ field, control, value, values, disabled, onChange }: ControlProps) {
  const common = {
    ...control,
    value,
    disabled,
    placeholder: field.placeholder,
  }
  switch (field.type) {
    case 'textarea':
      return <Textarea {...common} rows={4} onChange={(e) => onChange(e.target.value)} />
    case 'json':
      return (
        <Textarea
          {...common}
          spellCheck={false}
          className="min-h-64 font-mono text-caption"
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'select':
      return (
        <Select {...common} onChange={(e) => onChange(e.target.value)}>
          {value === '' && (
            <option value="" disabled>
              {t('admin.resource.selectPlaceholder', { label: field.label.toLowerCase() })}
            </option>
          )}
          {resolveOptions(field, values).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )
    case 'date':
    case 'time':
      return <Input {...common} type={field.type} onChange={(e) => onChange(e.target.value)} />
    case 'number':
    case 'money':
      return (
        <Input
          {...common}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'url':
      return (
        <Input
          {...common}
          inputMode="url"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return <Input {...common} onChange={(e) => onChange(e.target.value)} />
  }
}

function hintFor(field: FieldDef, value: FormValue, values: FormValues, isLocked: boolean) {
  if (isLocked) return t('admin.resource.immutable')
  if (field.type === 'money') {
    const parsed = parseField(field, value, values)
    if (parsed.ok && typeof parsed.value === 'number') {
      return t('admin.resource.moneyPreview', { amount: formatRupiah(parsed.value) })
    }
  }
  return field.hint
}

interface FieldControlRowProps {
  field: FieldDef
  id: string
  values: FormValues
  error: string | undefined
  isLocked: boolean
  onChange: (name: string, value: FormValue) => void
}

function FieldControlRow({ field, id, values, error, isLocked, onChange }: FieldControlRowProps) {
  const value = values[field.name]
  if (field.type === 'checkbox') {
    return (
      <Checkbox
        id={id}
        label={field.label}
        description={field.hint}
        checked={value === true}
        disabled={isLocked}
        onChange={(e) => onChange(field.name, e.target.checked)}
        className="sm:col-span-2"
      />
    )
  }
  return (
    <Field
      id={id}
      label={field.label}
      required={field.required}
      hint={hintFor(field, value, values, isLocked)}
      error={error}
      className={cn(isWideField(field) && 'sm:col-span-2')}
    >
      {(control) => (
        <TextControl
          field={field}
          control={control}
          value={typeof value === 'string' ? value : ''}
          values={values}
          disabled={isLocked}
          onChange={(next) => onChange(field.name, next)}
        />
      )}
    </Field>
  )
}

interface ResourceFormProps {
  fields: readonly FieldDef[]
  mode: FormMode
  record: Readonly<Record<string, unknown>> | null
  onSubmit: (payload: ResourcePayload) => Promise<void>
  onCancel: () => void
}

function omitKey(errors: FieldErrors, name: string): FieldErrors {
  if (!(name in errors)) return errors
  return Object.fromEntries(Object.entries(errors).filter(([key]) => key !== name))
}

function ResourceForm({ fields, mode, record, onSubmit, onCancel }: ResourceFormProps) {
  const formId = useId()
  const initial = useMemo(() => initialFormValues(fields, record), [fields, record])
  const baseline = useMemo(() => parseBaseline(fields, initial), [fields, initial])
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(false)
  const controlId = (name: string) => `${formId}-${name}`

  const focusFirstError = (next: FieldErrors) => {
    const first = fields.find((f) => next[f.name])
    if (first) requestAnimationFrame(() => document.getElementById(controlId(first.name))?.focus())
  }

  const handleChange = (name: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => omitKey(prev, name))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateFields(fields, values)
    if (!result.success) {
      setErrors(result.errors)
      setFormError(t('admin.resource.formError'))
      focusFirstError(result.errors)
      return
    }
    const payload = buildPayload(fields, result.data, mode, baseline)
    if (Object.keys(payload).length === 0) {
      setFormError(t('admin.resource.noChanges'))
      return
    }
    setBusy(true)
    try {
      await onSubmit(payload)
    } catch (err) {
      const mapped = mapServerFieldErrors(fields, apiFieldErrors(err))
      setErrors(mapped.errors)
      setFormError([apiErrorMessage(err), ...mapped.unmatched].join(' '))
      focusFirstError(mapped.errors)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)}>
      {formError && (
        <InlineAlert variant="danger" className="mb-5">
          {formError}
        </InlineAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldControlRow
            key={field.name}
            field={field}
            id={controlId(field.name)}
            values={values}
            error={errors[field.name]}
            isLocked={mode === 'edit' && field.createOnly === true}
            onChange={handleChange}
          />
        ))}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isBusy}>
          {t('admin.resource.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface ResourceFormDialogProps extends Omit<ResourceFormProps, 'onCancel'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  title,
  ...formProps
}: ResourceFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" aria-describedby={undefined}>
        <DialogHeader title={title} />
        <ResourceForm {...formProps} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
