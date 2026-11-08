import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps a custom font size next to a text color', () => {
    expect(cn('text-body-sm', 'text-ink')).toBe('text-body-sm text-ink')
  })

  it('resolves conflicting custom font sizes (last wins)', () => {
    expect(cn('text-body-sm text-ink', 'text-h3')).toBe('text-ink text-h3')
  })

  it('resolves conflicting colors and shadows', () => {
    expect(cn('bg-surface', 'bg-canvas')).toBe('bg-canvas')
    expect(cn('shadow-sm', 'shadow-card')).toBe('shadow-card')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})
