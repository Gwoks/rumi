import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { useAsync } from './use-async'

describe('useAsync', () => {
  it('loads data and reloads on demand', async () => {
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    const { result } = renderHook(() => useAsync(load, []))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe(1)
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toBe(2))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('keeps ApiErrors and wraps other errors', async () => {
    const apiErr = new ApiError('not_found', 'Data tidak ditemukan.', 404)
    const { result } = renderHook(() => useAsync(() => Promise.reject(apiErr), []))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe(apiErr)

    const { result: other } = renderHook(() =>
      useAsync(() => Promise.reject(new Error('boom')), []),
    )
    await waitFor(() => expect(other.current.status).toBe('error'))
    expect(other.current.error?.code).toBe('internal')
    expect(other.current.error?.message).toBe('boom')
  })

  it('ignores stale results after deps change', async () => {
    let resolveFirst: (v: string) => void = () => {}
    const first = new Promise<string>((r) => (resolveFirst = r))
    const { result, rerender } = renderHook(
      ({ key }) => useAsync(() => (key === 'a' ? first : Promise.resolve('b')), [key]),
      {
        initialProps: { key: 'a' },
      },
    )
    rerender({ key: 'b' })
    await waitFor(() => expect(result.current.data).toBe('b'))
    await act(async () => resolveFirst('a'))
    expect(result.current.data).toBe('b')
  })
})
