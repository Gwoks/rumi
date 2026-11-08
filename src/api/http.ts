/**
 * HTTP core (hookbox `http.ts` split): URL building, the fetch call with
 * `credentials: 'same-origin'` (the HttpOnly session cookie, PRD §5.3.2), the
 * `{ success, data, error }` envelope (§5.1) and zod validation of `data`.
 *
 * - fetch rejects            → ApiError('network_error', status 0)
 * - non-2xx                  → ApiError(<server code>, <server message>, status,
 *                               { retryAfter, fields })
 * - 2xx failing the schema   → ApiError('contract_mismatch')
 */
import type { z } from 'zod'
import { t } from '@/lib/copy'
import { ApiError, CLIENT_CODES } from './errors'
import { envelope, errorEnvelopeSchema } from './schemas'

export type QueryValue = string | number | boolean | null | undefined
export type Query = object

/** Build `path?query`, skipping undefined / null / empty values. */
export function buildUrl(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** `fetch` with the session cookie; a network failure becomes `network_error`
 * while a deliberate `AbortError` propagates as itself. */
export async function doFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, credentials: 'same-origin' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(CLIENT_CODES.network, t('common.error.network'), 0)
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

function retryAfterSeconds(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After')
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

async function toApiError(res: Response): Promise<ApiError> {
  const parsed = errorEnvelopeSchema.safeParse(await readJson(res))
  const retryAfter = retryAfterSeconds(res)
  if (parsed.success) {
    const { code, error, fields } = parsed.data
    return new ApiError(code, error, res.status, { retryAfter, fields })
  }
  // A non-enveloped error (e.g. an nginx 502 page) is not the API speaking.
  const code = res.status >= 500 ? 'unavailable' : CLIENT_CODES.contract
  return new ApiError(code, t('common.error.generic'), res.status, { retryAfter })
}

/** Unwrap and validate a §5.1 envelope into `T`, or throw an `ApiError`. */
export async function parseJsonResponse<T extends z.ZodTypeAny>(
  res: Response,
  schema: T,
): Promise<z.infer<T>> {
  if (!res.ok) throw await toApiError(res)
  const parsed = envelope(schema).safeParse(await readJson(res))
  if (!parsed.success) {
    throw new ApiError(CLIENT_CODES.contract, t('common.error.contract'), res.status)
  }
  return parsed.data.data as z.infer<T>
}
