import { afterEach, describe, expect, it, vi } from 'vitest'
import { isUsableResetToken, readResetToken, scrubResetTokenFromUrl } from './reset-token'

afterEach(() => window.history.replaceState(null, '', '/'))

describe('reset token (PRD §5.8.3 #11)', () => {
  it('reads the token from the fragment first', () => {
    expect(readResetToken('#token=abc-123', '')).toBe('abc-123')
    expect(readResetToken('#token=frag', '?token=query')).toBe('frag')
  })

  it('falls back to the legacy query form', () => {
    expect(readResetToken('', '?token=old-link')).toBe('old-link')
    expect(readResetToken('#other=1', '?token= spaced ')).toBe('spaced')
  })

  it('returns an empty string without a token', () => {
    expect(readResetToken('', '')).toBe('')
    expect(readResetToken('#', '?next=/x')).toBe('')
  })

  it('accepts 1–200 characters', () => {
    expect(isUsableResetToken('')).toBe(false)
    expect(isUsableResetToken('a')).toBe(true)
    expect(isUsableResetToken('a'.repeat(200))).toBe(true)
    expect(isUsableResetToken('a'.repeat(201))).toBe(false)
  })

  it('removes the token from the address bar and keeps the path', () => {
    window.history.pushState({ idx: 3 }, '', '/reset-password?token=q#token=f')
    const replace = vi.spyOn(window.history, 'replaceState')
    scrubResetTokenFromUrl()
    expect(replace).toHaveBeenCalledWith({ idx: 3 }, '', '/reset-password')
    expect(window.location.pathname).toBe('/reset-password')
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('')
  })

  it('leaves a URL without a token alone', () => {
    window.history.pushState(null, '', '/reset-password')
    const replace = vi.spyOn(window.history, 'replaceState')
    scrubResetTokenFromUrl()
    expect(replace).not.toHaveBeenCalled()
  })
})
