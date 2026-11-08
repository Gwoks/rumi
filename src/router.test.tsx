import { render, screen } from '@testing-library/react'
import type { RouteObject } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RouteFallback } from '@/components/rumi/route-fallback'
import { routes } from './router'

function flatten(list: RouteObject[]): RouteObject[] {
  return list.flatMap((route) => [route, ...flatten(route.children ?? [])])
}

describe('route tree', () => {
  it('gives every code-split route a hydrate fallback (no React Router warning)', () => {
    const lazy = flatten(routes).filter((route) => route.lazy)
    expect(lazy.length).toBeGreaterThanOrEqual(4)
    for (const route of lazy) {
      expect(route.hydrateFallbackElement, route.path).toBeTruthy()
    }
  })

  it('renders the fallback as a centered loading status', () => {
    render(<RouteFallback />)
    expect(screen.getByRole('status')).toHaveTextContent('Memuat…')
  })
})
