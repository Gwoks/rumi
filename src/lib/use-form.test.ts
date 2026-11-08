import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { focusFirstInvalid, pickFieldErrors, useForm } from './use-form'

const schema = z.object({
  name: z.string().trim().min(2, 'terlalu pendek'),
  city: z.string(),
})

describe('useForm', () => {
  it('binds values and updates them immutably', () => {
    const { result } = renderHook(() => useForm({ name: '', city: 'Jakarta' }))
    const before = result.current.values
    act(() => {
      result.current
        .bind('name')
        .onChange({ target: { value: 'Nadia' } } as React.ChangeEvent<HTMLInputElement>)
    })
    expect(result.current.values).toEqual({ name: 'Nadia', city: 'Jakarta' })
    expect(before).toEqual({ name: '', city: 'Jakarta' })
    expect(result.current.bind('city')).toMatchObject({ name: 'city', value: 'Jakarta' })
  })

  it('validates: sets errors on failure, clears them on success', () => {
    const { result } = renderHook(() => useForm({ name: 'N', city: '' }))
    let parsed: unknown
    act(() => {
      parsed = result.current.validate(schema)
    })
    expect(parsed).toBeNull()
    expect(result.current.errors).toEqual({ name: 'terlalu pendek' })

    act(() => result.current.setValue('name', ' Nadia '))
    expect(result.current.errors).toEqual({})
    act(() => {
      parsed = result.current.validate(schema)
    })
    expect(parsed).toEqual({ name: 'Nadia', city: '' })
  })

  it('accepts server errors and clears only the edited field', () => {
    const { result } = renderHook(() => useForm({ name: '', city: '' }))
    act(() => result.current.setErrors({ name: 'a', city: 'b' }))
    act(() => result.current.setValue('city', 'Depok'))
    expect(result.current.errors).toEqual({ name: 'a' })
  })
})

describe('pickFieldErrors', () => {
  const fields = { 'parent.email': 'x', 'child.dob': 'y', notes: 'z' }

  it('strips a prefix', () => {
    expect(pickFieldErrors(fields, 'parent')).toEqual({ email: 'x' })
    expect(pickFieldErrors(fields, 'child')).toEqual({ dob: 'y' })
  })

  it('keeps only top-level keys without a prefix', () => {
    expect(pickFieldErrors(fields)).toEqual({ notes: 'z' })
  })
})

describe('focusFirstInvalid', () => {
  it('focuses the first aria-invalid control', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    const root = document.createElement('form')
    root.innerHTML = '<input id="a" /><input id="b" aria-invalid="true" />'
    document.body.append(root)
    focusFirstInvalid(root)
    expect(document.activeElement?.id).toBe('b')
    root.remove()
  })

  it('ignores a missing root', () => {
    expect(() => focusFirstInvalid(null)).not.toThrow()
  })
})
