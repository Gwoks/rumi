/**
 * SPA entry: providers around the router, the token stylesheet + Inter, the
 * auth bootstrap (GET /api/auth/me) and the global 401 rule (PRD §5.2): any
 * `unauthorized` clears the auth store and redirects to /login?next=….
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { bootstrapAuth, clearAuth } from '@/api/auth-store'
import { setUnauthorizedHandler } from '@/api/client'
import { Providers } from '@/components/providers'
import { loginPathWithNext, ROUTES } from '@/lib/navigation'
import { router } from '@/router'
import '@fontsource-variable/inter/wght.css'
import './globals.css'

setUnauthorizedHandler(() => {
  clearAuth()
  const { pathname, search } = router.state.location
  if (pathname === ROUTES.login) return
  void router.navigate(loginPathWithNext(`${pathname}${search}`), { replace: true })
})

void bootstrapAuth()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
)
