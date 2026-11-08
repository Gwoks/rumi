import { describe, expect, it } from 'vitest'
import { ApiError, CLIENT_CODES, isApiError, isServerErrorCode, SERVER_ERROR_CODES } from './errors'

describe('error codes (PRD §5.2)', () => {
  it('lists every server code once, including the checkout cap', () => {
    expect(new Set(SERVER_ERROR_CODES).size).toBe(SERVER_ERROR_CODES.length)
    expect(SERVER_ERROR_CODES).toContain('too_many_pending_orders')
    expect(SERVER_ERROR_CODES).toContain('rate_limited')
  })

  it('tells server codes from frontend-only codes', () => {
    expect(isServerErrorCode('too_many_pending_orders')).toBe(true)
    expect(isServerErrorCode(CLIENT_CODES.network)).toBe(false)
    expect(isServerErrorCode('made_up')).toBe(false)
  })

  it('carries code, status, retryAfter and fields', () => {
    const err = new ApiError('rate_limited', 'x', 429, { retryAfter: 3, fields: { a: 'b' } })
    expect(isApiError(err)).toBe(true)
    expect(err).toMatchObject({ code: 'rate_limited', status: 429, retryAfter: 3 })
    expect(err.fields).toEqual({ a: 'b' })
    expect(isApiError(new Error('x'))).toBe(false)
  })
})
