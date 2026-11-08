/**
 * Root layout route element: renders the matched route plus app-wide
 * overlays (the cart drawer) and scroll restoration. Mounted once in router.tsx.
 */
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { CartDrawer } from './cart-drawer'

export function AppRoot() {
  return (
    <>
      <Outlet />
      <CartDrawer />
      <ScrollRestoration />
    </>
  )
}
