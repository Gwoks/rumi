/** Test helper: render inside a memory router + the app providers. */
import { render, type RenderResult } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { Providers } from '@/components/providers'

export interface RenderOptions {
  route?: string
  /** Extra routes (e.g. a /login stub) next to the element under test. */
  routes?: RouteObject[]
  path?: string
}

export function renderWithRouter(
  ui: React.ReactElement,
  { route = '/', routes = [], path = '*' }: RenderOptions = {},
): RenderResult {
  const router = createMemoryRouter([{ path, element: ui }, ...routes], { initialEntries: [route] })
  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
}
