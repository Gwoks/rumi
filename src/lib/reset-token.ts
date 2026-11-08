/**
 * Password-reset token in the URL (PRD §5.8.3 #11, §6.22). New links carry it
 * in the fragment (`/reset-password#token=…`), which the browser never sends
 * to a server, so it cannot reach nginx or app logs; links sent before that
 * change used `?token=` and are still accepted. Once read, the token is
 * removed from the address bar so it does not linger in history, a screenshot
 * or a copied URL.
 */
export const MAX_RESET_TOKEN_LENGTH = 200

function tokenParam(raw: string, prefix: '#' | '?'): string {
  const body = raw.startsWith(prefix) ? raw.slice(1) : raw
  return new URLSearchParams(body).get('token')?.trim() ?? ''
}

/** The token from `#token=` (preferred) or the legacy `?token=`; '' if absent. */
export function readResetToken(hash: string, search: string): string {
  return tokenParam(hash, '#') || tokenParam(search, '?')
}

export function isUsableResetToken(token: string): boolean {
  return token.length > 0 && token.length <= MAX_RESET_TOKEN_LENGTH
}

/**
 * Drop the query and fragment from the address bar when they carry a token.
 * Keeps `history.state` so the router's own bookkeeping (`idx`, `key`) stays.
 */
export function scrubResetTokenFromUrl(): void {
  const { hash, search, pathname } = window.location
  if (readResetToken(hash, search) === '') return
  window.history.replaceState(window.history.state, '', pathname)
}
