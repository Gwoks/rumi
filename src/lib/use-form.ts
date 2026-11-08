/**
 * Tiny controlled-form hook shared by the auth screens and checkout: string
 * values, a field → message error map, zod validation through
 * `validateForm`, and helpers to merge a server `validation_error` `fields`
 * map (dotted paths, PRD §5.1) back onto the right form.
 *
 * Updates are immutable; editing a field clears that field's error.
 */
import { useCallback, useState, type ChangeEvent } from 'react'
import type { z } from 'zod'
import { validateForm, type FormErrors } from './validation'

export type FormValues = Record<string, string>

type ChangeTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export interface BoundField {
  name: string
  value: string
  onChange: (event: ChangeEvent<ChangeTarget>) => void
}

export interface FormApi<T extends FormValues> {
  values: T
  errors: FormErrors
  setValue: (key: keyof T & string, value: string) => void
  setErrors: (errors: FormErrors) => void
  /** Validate the current values; returns the parsed output or null (errors set). */
  validate: <S extends z.ZodTypeAny>(schema: S) => z.output<S> | null
  /** `value` + `onChange` props for an Input / Select / Textarea. */
  bind: (key: keyof T & string) => BoundField
}

function withoutKey(errors: FormErrors, key: string): FormErrors {
  if (!(key in errors)) return errors
  return Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key))
}

export function useForm<T extends FormValues>(initial: T): FormApi<T> {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<FormErrors>({})

  const setValue = useCallback((key: keyof T & string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => withoutKey(prev, key))
  }, [])

  const validate = <S extends z.ZodTypeAny>(schema: S): z.output<S> | null => {
    const result = validateForm(schema, values)
    if (result.success) {
      setErrors({})
      return result.data
    }
    setErrors(result.errors)
    return null
  }

  const bind = (key: keyof T & string): BoundField => ({
    name: key,
    value: values[key] ?? '',
    onChange: (event) => setValue(key, event.target.value),
  })

  return { values, errors, setValue, setErrors, validate, bind }
}

/**
 * Server field errors under one prefix, with the prefix stripped:
 * `pickFieldErrors({ 'parent.email': 'x', 'child.dob': 'y' }, 'parent')` →
 * `{ email: 'x' }`. With no prefix, returns only the top-level keys.
 */
export function pickFieldErrors(fields: FormErrors, prefix?: string): FormErrors {
  const out: FormErrors = {}
  for (const [path, message] of Object.entries(fields)) {
    if (!prefix) {
      if (!path.includes('.')) out[path] = message
      continue
    }
    if (path.startsWith(`${prefix}.`)) out[path.slice(prefix.length + 1)] = message
  }
  return out
}

/** Move focus to the first invalid control inside `root` (after errors render). */
export function focusFirstInvalid(root: HTMLElement | null): void {
  if (!root) return
  requestAnimationFrame(() => {
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}
