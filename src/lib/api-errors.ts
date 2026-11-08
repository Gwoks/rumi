/**
 * Map any thrown value to an Indonesian sentence for the UI. Server errors
 * already carry an Indonesian `error` message (PRD §5.1); client-side codes get
 * copy from `t()`. Branch on `err.code` for behavior, use this only for text.
 */
import { ApiError, CLIENT_CODES } from '@/api/errors'
import { t } from './copy'

export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return t('common.error.generic')
  if (err.code === CLIENT_CODES.network) return t('common.error.network')
  if (err.code === CLIENT_CODES.contract) return t('common.error.contract')
  if (err.code === 'rate_limited' && err.retryAfter !== undefined) {
    return t('common.error.rateLimited', { seconds: Math.max(1, Math.ceil(err.retryAfter)) })
  }
  return err.message || t('common.error.generic')
}

/** Server `fields` map (dotted paths) for a `validation_error`, else empty. */
export function apiFieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && err.code === 'validation_error' && err.fields) return err.fields
  return {}
}
