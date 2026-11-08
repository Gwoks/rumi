/**
 * Segmented control (DESIGN.md "Segmented control"): a radiogroup of buttons.
 * The selected item is a raised white chip (not color alone). Arrow keys move
 * the selection (roving tabindex).
 */
import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { FOCUS } from '@/lib/styles'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, -1)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-xl bg-primary-soft p-1 text-caption font-semibold',
        className,
      )}
    >
      {options.map((option, index) => {
        const isOn = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={isOn}
            tabIndex={isOn ? 0 : -1}
            data-state={isOn ? 'on' : 'off'}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'min-h-10 rounded-lg px-3 py-2 text-ink-secondary transition',
              FOCUS,
              'data-[state=on]:bg-surface data-[state=on]:text-primary-strong data-[state=on]:shadow-sm',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
