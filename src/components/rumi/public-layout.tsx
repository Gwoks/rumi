/**
 * Public layout route element: skip link → header → main#main → footer.
 * Screens rendered inside it supply only their content (one h1 each).
 */
import { Outlet } from 'react-router-dom'
import { MAIN_ID, SkipLink } from './skip-link'
import { PublicFooter } from './public-footer'
import { PublicHeader } from './public-header'

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <SkipLink />
      <PublicHeader />
      <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
        {children ?? <Outlet />}
      </main>
      <PublicFooter />
    </div>
  )
}
