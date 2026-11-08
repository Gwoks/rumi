import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore, useStore, type Store } from './create-store'

interface Counter {
  n: number
}

const parse = (raw: unknown): Counter | null =>
  typeof raw === 'object' && raw !== null && typeof (raw as Counter).n === 'number'
    ? (raw as Counter)
    : null

const stores: Store<unknown>[] = []
function track<T>(store: Store<T>): Store<T> {
  stores.push(store as Store<unknown>)
  return store
}

afterEach(() => {
  stores.splice(0).forEach((s) => s.dispose())
})

describe('createStore', () => {
  it('notifies subscribers and keeps snapshot identity stable between updates', () => {
    const store = track(createStore<Counter>({ n: 0 }))
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const first = store.getSnapshot()
    expect(store.getSnapshot()).toBe(first)

    store.setState((prev) => ({ ...prev, n: prev.n + 1 }))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toEqual({ n: 1 })
    expect(store.getSnapshot()).not.toBe(first)

    unsubscribe()
    store.setState({ n: 5 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('skips identical states', () => {
    const store = track(createStore<Counter>({ n: 0 }))
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState((prev) => prev)
    expect(listener).not.toHaveBeenCalled()
  })

  it('persists to localStorage and restores validated state', () => {
    const store = track(createStore<Counter>({ n: 0 }, { key: 'k', parse }))
    store.setState({ n: 3 })
    expect(JSON.parse(localStorage.getItem('k') ?? 'null')).toEqual({ n: 3 })
    const again = track(createStore<Counter>({ n: 0 }, { key: 'k', parse }))
    expect(again.getSnapshot()).toEqual({ n: 3 })
  })

  it('falls back to the initial state on corrupt or invalid storage', () => {
    localStorage.setItem('bad-json', '{oops')
    expect(track(createStore<Counter>({ n: 1 }, { key: 'bad-json', parse })).getSnapshot()).toEqual(
      { n: 1 },
    )
    localStorage.setItem('bad-shape', JSON.stringify({ n: 'x' }))
    expect(
      track(createStore<Counter>({ n: 2 }, { key: 'bad-shape', parse })).getSnapshot(),
    ).toEqual({ n: 2 })
  })

  it('survives a throwing localStorage', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const store = track(createStore<Counter>({ n: 0 }, { key: 'k', parse }))
    expect(store.getSnapshot()).toEqual({ n: 0 })
    store.setState({ n: 9 })
    expect(store.getSnapshot()).toEqual({ n: 9 })
    getItem.mockRestore()
    setItem.mockRestore()
  })

  it('syncs across tabs through the storage event', () => {
    const store = track(createStore<Counter>({ n: 0 }, { key: 'sync', parse }))
    const listener = vi.fn()
    store.subscribe(listener)
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'sync', newValue: JSON.stringify({ n: 7 }) }),
    )
    expect(store.getSnapshot()).toEqual({ n: 7 })
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'other', newValue: JSON.stringify({ n: 1 }) }),
    )
    expect(store.getSnapshot()).toEqual({ n: 7 })
    window.dispatchEvent(new StorageEvent('storage', { key: 'sync', newValue: null }))
    expect(store.getSnapshot()).toEqual({ n: 0 })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('resets to the initial state', () => {
    const store = track(createStore<Counter>({ n: 0 }))
    store.setState({ n: 4 })
    store.reset()
    expect(store.getSnapshot()).toEqual({ n: 0 })
  })

  it('stops listening after dispose', () => {
    const store = createStore<Counter>({ n: 0 }, { key: 'gone', parse })
    store.dispose()
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'gone', newValue: JSON.stringify({ n: 1 }) }),
    )
    expect(store.getSnapshot()).toEqual({ n: 0 })
  })
})

describe('useStore', () => {
  it('re-renders on change', () => {
    const store = track(createStore<Counter>({ n: 0 }))
    const { result } = renderHook(() => useStore(store))
    expect(result.current.n).toBe(0)
    act(() => store.setState({ n: 2 }))
    expect(result.current.n).toBe(2)
  })
})
