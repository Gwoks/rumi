/**
 * Router `errorElement`: a render or loader crash anywhere below the root.
 * Self-contained (the layout itself may be what failed).
 */
import { Link } from 'react-router-dom'
import { Logo } from '@/components/rumi/logo'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'

export function RouteErrorScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center text-ink">
      <div className="max-w-md">
        <Logo className="justify-center" />
        <h1 className="mt-8 text-h2 text-ink">{t('common.routeError.title')}</h1>
        <p className="mt-4 text-body text-ink-secondary">{t('common.routeError.body')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => window.location.reload()}>{t('common.routeError.reload')}</Button>
          <Button asChild variant="secondary">
            <Link to={ROUTES.home}>{t('common.notFound.home')}</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
