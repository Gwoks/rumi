/**
 * Route guard (PRD §5.3.1): while the session is being checked → spinner;
 * anonymous → /login?next=<path+search>; wrong role → that role's home;
 * bootstrap failure → an alert with retry. The API still enforces RBAC; this
 * only keeps the UI honest.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { bootstrapAuth } from '@/api/auth-store'
import type { Role } from '@/api/schemas'
import { useAuth } from '@/api/use-auth'
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Spinner } from '@/components/ui/spinner'
import { apiErrorMessage } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { homeForRole, loginPathWithNext } from '@/lib/navigation'

export interface RequireRoleProps {
  role: Role
  children: React.ReactNode
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6 text-ink">{children}</div>
  )
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, status, error } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <FullPage>
        <span className="flex items-center gap-3 text-body-sm text-ink-secondary" aria-busy="true">
          <Spinner label={t('common.auth.checking')} />
          {t('common.auth.checking')}
        </span>
      </FullPage>
    )
  }

  if (status === 'error') {
    return (
      <FullPage>
        <InlineAlert
          variant="danger"
          title={t('common.auth.bootstrapError')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void bootstrapAuth()}>
              {t('common.retry')}
            </Button>
          }
          className="max-w-md"
        >
          {apiErrorMessage(error)}
        </InlineAlert>
      </FullPage>
    )
  }

  if (!user) {
    return <Navigate to={loginPathWithNext(`${location.pathname}${location.search}`)} replace />
  }

  if (user.role !== role) return <Navigate to={homeForRole(user.role)} replace />

  return <>{children}</>
}
