/**
 * The single `ApiError` shape thrown by the API client (hookbox pattern).
 * Zero dependencies. `code` is a PRD §5.2 server code or one of the
 * frontend-only codes below; the UI branches on `code`, never on `message`.
 */

/** Frontend-only codes (never sent by the server, PRD §5.2). */
export const CLIENT_CODES = {
  network: 'network_error',
  contract: 'contract_mismatch',
} as const

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfter?: number
  readonly fields?: FieldErrors

  constructor(
    code: string,
    message: string,
    status: number,
    extra: { retryAfter?: number; fields?: FieldErrors } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryAfter = extra.retryAfter
    this.fields = extra.fields
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}
