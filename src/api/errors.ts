/**
 * The single `ApiError` shape thrown by the API client (hookbox pattern).
 * Zero dependencies. `code` is a PRD §5.2 server code or one of the
 * frontend-only codes below; the UI branches on `code`, never on `message`.
 */

/** Every `code` the server may send (PRD §5.2, complete list). */
export const SERVER_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'invalid_credentials',
  'forbidden',
  'origin_mismatch',
  'not_found',
  'method_not_allowed',
  'conflict',
  'email_taken',
  'item_unavailable',
  'already_enrolled',
  'class_full',
  'out_of_stock',
  'too_many_pending_orders',
  'invalid_transition',
  'payload_too_large',
  'validation_error',
  'invalid_token',
  'rate_limited',
  'internal',
  'unavailable',
] as const

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number]

const SERVER_CODE_SET: ReadonlySet<string> = new Set(SERVER_ERROR_CODES)

export function isServerErrorCode(code: string): code is ServerErrorCode {
  return SERVER_CODE_SET.has(code)
}

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
