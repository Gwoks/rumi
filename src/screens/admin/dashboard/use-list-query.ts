/**
 * Search + page state for the paginated admin lists (students, orders):
 * the search text is debounced before it reaches the API, and the page
 * resets to 1 whenever the (debounced) search or a filter changes — derived
 * during render, no effect round trip.
 */
import { useEffect, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300
export const PER_PAGE = 20

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export interface ListQuery {
  search: string
  setSearch: (value: string) => void
  /** Trimmed, debounced search sent to the API. */
  q: string
  page: number
  setPage: (page: number) => void
}

/** `resetKey` (e.g. the status filter) also sends the list back to page 1. */
export function useListQuery(resetKey = ''): ListQuery {
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const scope = `${resetKey}|${q}`
  const [paging, setPaging] = useState({ scope, page: 1 })
  const page = paging.scope === scope ? paging.page : 1
  return {
    search,
    setSearch,
    q,
    page,
    setPage: (next: number) => setPaging({ scope, page: next }),
  }
}
