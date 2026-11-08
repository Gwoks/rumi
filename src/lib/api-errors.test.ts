import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { apiErrorMessage, apiFieldErrors } from './api-errors'

describe('apiErrorMessage', () => {
  it('uses the server sentence for server codes', () => {
    expect(
      apiErrorMessage(new ApiError('class_full', 'Kelas Bulan & Gerak sudah penuh.', 409)),
    ).toBe('Kelas Bulan & Gerak sudah penuh.')
  })

  it('uses copy for client-side codes', () => {
    expect(apiErrorMessage(new ApiError('network_error', 'x', 0))).toMatch(/Tidak dapat terhubung/)
    expect(apiErrorMessage(new ApiError('contract_mismatch', 'x', 200))).toMatch(/Respons server/)
    expect(apiErrorMessage(new Error('boom'))).toBe('Terjadi kesalahan. Coba lagi.')
    expect(apiErrorMessage(new ApiError('internal', '', 500))).toBe('Terjadi kesalahan. Coba lagi.')
  })

  it('formats rate limits with Retry-After', () => {
    expect(apiErrorMessage(new ApiError('rate_limited', 'x', 429, { retryAfter: 12 }))).toBe(
      'Terlalu banyak percobaan. Coba lagi dalam 12 detik.',
    )
  })
})

describe('apiFieldErrors', () => {
  it('returns fields only for validation errors', () => {
    const fields = { 'parent.email': 'Email tidak valid.' }
    expect(apiFieldErrors(new ApiError('validation_error', 'x', 422, { fields }))).toEqual(fields)
    expect(apiFieldErrors(new ApiError('conflict', 'x', 409, { fields }))).toEqual({})
    expect(apiFieldErrors('nope')).toEqual({})
  })
})
