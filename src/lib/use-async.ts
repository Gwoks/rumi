/**
 * Minimal data-loading hook for screens (no react-query, per CLAUDE.md):
 * runs `load` on mount and whenever `deps` change, ignores stale results, and
 * exposes `reload()`. Errors are kept as `ApiError` so screens branch on `code`.
 *
 *   const classes = useAsync(() => api.listClasses(query), [query.location])
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { ApiError } from '@/api/errors'

export type AsyncStatus = 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  status: AsyncStatus
  data: T | undefined
  error: ApiError | null
  reload: () => void
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  return new ApiError('internal', err instanceof Error ? err.message : String(err), 0)
}

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({
    status: 'loading',
    data: undefined,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    loadRef.current().then(
      (data) => {
        if (active) setState({ status: 'success', data, error: null })
      },
      (err: unknown) => {
        if (active) setState((prev) => ({ ...prev, status: 'error', error: toApiError(err) }))
      },
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-provided deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
