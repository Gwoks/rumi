/**
 * Form controls (DESIGN.md "Form controls"): Input, SearchInput, Textarea,
 * Select (native, with a chevron), Checkbox (label row), Label and Field.
 *
 * `Field` wires the label, hint and error to its control: the control gets
 * `id`, `aria-invalid` and an `aria-describedby` pointing at the hint and
 * error. Errors are icon + text + aria-invalid (never color-only). Required
 * fields show `*` plus sr-only "wajib".
 */
import { AlertCircle, ChevronDown, Search } from 'lucide-react'
import { forwardRef, useId } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { FOCUS } from '@/lib/styles'

const CONTROL = cn(
  'w-full rounded-xl border border-border-strong bg-surface px-3 py-3 text-body-sm text-ink placeholder:text-ink-tertiary transition',
  FOCUS,
  'focus-visible:border-primary-strong aria-[invalid=true]:border-danger disabled:bg-surface-subtle disabled:text-ink-disabled',
)

interface InvalidProp {
  /** Sets aria-invalid (the danger border follows from it). */
  invalid?: boolean
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & InvalidProp

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(CONTROL, className)}
      {...props}
    />
  )
})

/** Search input: a leading Search icon (decorative) and `type="search"`. */
export const SearchInput = forwardRef<HTMLInputElement, InputProps>(function SearchInput(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        size={17}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
      />
      <Input ref={ref} type="search" className={cn('pl-10', className)} {...props} />
    </div>
  )
})

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(CONTROL, 'min-h-32', className)}
      {...props}
    />
  )
})

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & InvalidProp

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || props['aria-invalid'] || undefined}
        className={cn(CONTROL, 'appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
      />
    </div>
  )
})

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode
  description?: React.ReactNode
}

/** Checkbox inside a full-width clickable label row. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border border-border-subtle p-3 text-body-sm text-ink hover:bg-surface-subtle',
        className,
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn('h-4 w-4 shrink-0 rounded border-border-strong accent-primary-strong', FOCUS)}
        {...props}
      />
      <span>
        <span className="font-medium">{label}</span>
        {description && (
          <span className="block text-caption text-ink-secondary">{description}</span>
        )}
      </span>
    </label>
  )
})

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  optional?: boolean
}

export function Label({ className, children, required, optional, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-body-sm font-medium text-ink-secondary', className)}
      {...props}
    >
      {children}
      {required && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
          <span className="sr-only"> ({t('common.required')})</span>
        </>
      )}
      {optional && (
        <span className="ml-1 font-normal text-ink-tertiary">{t('common.optional')}</span>
      )}
    </label>
  )
}

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: boolean
}

export interface FieldProps {
  label: string
  /** Render the control with the wiring props spread onto it. */
  children: (control: FieldControlProps) => React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  optional?: boolean
  className?: string
  /** Use a fixed id (otherwise one is generated). */
  id?: string
}

export function Field({
  label,
  children,
  hint,
  error,
  required,
  optional,
  className,
  id,
}: FieldProps) {
  const autoId = useId()
  const controlId = id ?? autoId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <Label htmlFor={controlId} required={required} optional={optional}>
        {label}
      </Label>
      <div className="mt-2">
        {children({
          id: controlId,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : undefined,
          required,
        })}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-caption text-ink-tertiary">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="mt-1.5 flex items-center gap-1.5 text-caption font-medium text-danger"
        >
          <AlertCircle aria-hidden="true" size={14} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
