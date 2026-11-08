/**
 * Hooks shared by the parent and admin dashboards:
 * - `useUpdateSearchParams`: immutable query-string updates (`null` removes a key).
 * - `useTabParam`: the active section lives in `?tab=` (deep-linkable, back
 *   button friendly); unknown or missing values fall back to the first section.
 * - `useLogoutToHome`: logs out, then lands on Beranda.
 */
import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { logout } from '@/api/auth-store'
import { ROUTES } from '@/lib/navigation'

export const TAB_PARAM = 'tab'

export type ParamUpdates = Readonly<Record<string, string | null>>

/** Returns `update({ key: value | null }, { replace })` over the current search params. */
export function useUpdateSearchParams(): (
  updates: ParamUpdates,
  options?: { replace?: boolean },
) => void {
  const [, setParams] = useSearchParams()
  return useCallback(
    (updates, options) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(updates)) {
            if (value === null) next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: options?.replace ?? false },
      )
    },
    [setParams],
  )
}

export function useTabParam<T extends string>(
  ids: readonly T[],
  fallback: T,
): [T, (id: string) => void] {
  const [params] = useSearchParams()
  const update = useUpdateSearchParams()
  const raw = params.get(TAB_PARAM)
  const active = ids.find((id) => id === raw) ?? fallback
  const setActive = useCallback(
    (id: string) => update({ [TAB_PARAM]: id === fallback ? null : id }),
    [update, fallback],
  )
  return [active, setActive]
}

export function useLogoutToHome(): { onLogout: () => void; isLoggingOut: boolean } {
  const navigate = useNavigate()
  const [isLoggingOut, setLoggingOut] = useState(false)
  const onLogout = useCallback(() => {
    setLoggingOut(true)
    logout()
      // The local session is cleared even when the call fails (auth-store
      // `finally`), so the user still lands signed-out on Beranda.
      .catch(() => undefined)
      .finally(() => {
        setLoggingOut(false)
        navigate(ROUTES.home, { replace: true })
      })
  }, [navigate])
  return { onLogout, isLoggingOut }
}
