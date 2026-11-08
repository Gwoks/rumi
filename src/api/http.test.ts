import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { fail, ok } from '@/test/factories'
import { ApiError } from './errors'
import { buildUrl, doFetch, parseJsonResponse } from './http'

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('buildUrl', () => {
  it('skips empty values and encodes the rest', () => {
    expect(buildUrl('/api/classes')).toBe('/api/classes')
    expect(
      buildUrl('/api/classes', {
        location: 'Rumah Teduh, Kemang',
        age: 4,
        from: '',
        to: undefined,
      }),
    ).toBe('/api/classes?location=Rumah+Teduh%2C+Kemang&age=4')
    expect(buildUrl('/api/kits', { category: undefined })).toBe('/api/kits')
  })
})

describe('doFetch', () => {
  it('always sends the session cookie (same-origin)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await doFetch('/api/health', { method: 'GET', credentials: 'omit' })
    expect(fetchMock).toHaveBeenCalledWith('/api/health', {
      method: 'GET',
      credentials: 'same-origin',
    })
  })

  it('maps a rejected fetch to network_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(doFetch('/api/health', {})).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    })
  })

  it('re-throws an AbortError as itself', async () => {
    const abort = new DOMException('aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(doFetch('/api/health', {})).rejects.toBe(abort)
  })
})

describe('parseJsonResponse', () => {
  const schema = z.object({ status: z.literal('ok') })

  it('unwraps and validates the success envelope', async () => {
    await expect(
      parseJsonResponse(jsonResponse(200, ok({ status: 'ok' })), schema),
    ).resolves.toEqual({ status: 'ok' })
  })

  it('accepts null data (deletes, logout)', async () => {
    await expect(parseJsonResponse(jsonResponse(200, ok(null)), z.null())).resolves.toBeNull()
  })

  it('flags a DTO mismatch as contract_mismatch', async () => {
    const err = await parseJsonResponse(jsonResponse(200, ok({ status: 'nope' })), schema).catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('contract_mismatch')
  })

  it('flags a non-envelope 2xx as contract_mismatch', async () => {
    const res = new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    await expect(parseJsonResponse(res, schema)).rejects.toMatchObject({
      code: 'contract_mismatch',
    })
  })

  it('maps the error envelope with fields and Retry-After', async () => {
    const res = jsonResponse(
      422,
      fail('validation_error', 'Data tidak valid.', { 'parent.email': 'Email tidak valid.' }),
    )
    await expect(parseJsonResponse(res, schema)).rejects.toMatchObject({
      code: 'validation_error',
      message: 'Data tidak valid.',
      status: 422,
      fields: { 'parent.email': 'Email tidak valid.' },
    })
    const limited = jsonResponse(429, fail('rate_limited', 'Terlalu banyak percobaan.'), {
      'Retry-After': '30',
    })
    await expect(parseJsonResponse(limited, schema)).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfter: 30,
    })
  })

  it('maps a non-enveloped error by status', async () => {
    const gateway = new Response('Bad Gateway', { status: 502 })
    await expect(parseJsonResponse(gateway, schema)).rejects.toMatchObject({
      code: 'unavailable',
      status: 502,
    })
    const odd = new Response('nope', { status: 418, headers: { 'Retry-After': 'soon' } })
    await expect(parseJsonResponse(odd, schema)).rejects.toMatchObject({
      code: 'contract_mismatch',
      retryAfter: undefined,
    })
  })
})
