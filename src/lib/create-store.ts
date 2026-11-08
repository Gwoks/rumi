/**
 * Generic external store (hookbox `api/session.ts` pattern): a listener Set,
 * `subscribe`, a `getSnapshot` with stable identity (the state object only
 * changes on `setState`), optional localStorage persistence wrapped in
 * try/catch, and cross-tab sync through the `storage` event. Components read
 * it with `useStore` (useSyncExternalStore).
 *
 * Updates must be immutable: `setState(prev => ({ ...prev, x }))`.
 */
import { useSyncExternalStore } from 'react'

export type Listener = () => void

export interface PersistOptions<T> {
  /** localStorage key. */
  key: string
  /** Validate untrusted storage content; return null to fall back to the initial state. */
  parse: (raw: unknown) => T | null
}

export interface Store<T> {
  getSnapshot: () => T
  subscribe: (listener: Listener) => () => void
  setState: (next: T | ((prev: T) => T)) => void
  /** Back to the initial state (also persisted). */
  reset: () => void
  /** Remove the cross-tab listener (tests, HMR). */
  dispose: () => void
}

function readPersisted<T>(persist: PersistOptions<T>, raw: string | null): T | null {
  if (raw === null) return null
  try {
    return persist.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

function loadInitial<T>(initial: T, persist?: PersistOptions<T>): T {
  if (!persist) return initial
  try {
    return readPersisted(persist, localStorage.getItem(persist.key)) ?? initial
  } catch {
    return initial
  }
}

function writePersisted<T>(persist: PersistOptions<T> | undefined, state: T): void {
  if (!persist) return
  try {
    localStorage.setItem(persist.key, JSON.stringify(state))
  } catch {
    /* storage unavailable (private mode / quota) — keep the in-memory state */
  }
}

export function createStore<T>(initial: T, persist?: PersistOptions<T>): Store<T> {
  let state = loadInitial(initial, persist)
  const listeners = new Set<Listener>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const replace = (next: T, shouldPersist: boolean) => {
    if (Object.is(next, state)) return
    state = next
    if (shouldPersist) writePersisted(persist, state)
    emit()
  }

  const onStorage = (event: StorageEvent) => {
    if (!persist || event.key !== persist.key) return
    replace(readPersisted(persist, event.newValue) ?? initial, false)
  }

  const canListen = typeof window !== 'undefined' && !!persist
  if (canListen) window.addEventListener('storage', onStorage)

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setState: (next) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      replace(value, true)
    },
    reset: () => replace(initial, true),
    dispose: () => {
      if (canListen) window.removeEventListener('storage', onStorage)
      listeners.clear()
    },
  }
}

/** React binding: re-renders when the store's snapshot identity changes. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
