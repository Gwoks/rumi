/**
 * SPA route tree (PRD §4.1). Flat routes at their FINAL paths under one root
 * layout (AppRoot: cart drawer + scroll restoration):
 *  - public + auth + /design-kit + 404 render inside <PublicLayout>
 *  - dashboards and the report are guarded by <RequireRole>
 *  - dashboards, the report and /design-kit are code-split via route `lazy`
 *    so the public bundle stays small (Vite 500 kB chunk budget); each lazy
 *    route shows <RouteFallback> while its module loads on a hard page load
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppRoot } from '@/components/rumi/app-root'
import { PublicLayout } from '@/components/rumi/public-layout'
import { RequireRole } from '@/components/rumi/require-role'
import { RouteFallback } from '@/components/rumi/route-fallback'
import { ROUTES } from '@/lib/navigation'
import { ForgotPasswordScreen } from '@/screens/auth/forgot-password'
import { LoginScreen } from '@/screens/auth/login'
import { RegisterScreen } from '@/screens/auth/register'
import { ResetPasswordScreen } from '@/screens/auth/reset-password'
import { NotFoundScreen } from '@/screens/not-found'
import { HomeScreen } from '@/screens/public/home'
import { OurApproachScreen } from '@/screens/public/our-approach'
import { PlayKitsScreen } from '@/screens/public/play-kits'
import { WeekendClassesScreen } from '@/screens/public/weekend-classes'
import { WhoWeAreScreen } from '@/screens/public/who-we-are'
import { RouteErrorScreen } from '@/screens/route-error'
import type { Role } from '@/api/enums'

/** Code-split a screen; optionally guard it with <RequireRole>. */
function lazyScreen<M>(
  load: () => Promise<M>,
  pick: (mod: M) => React.ComponentType,
  role?: Role,
): Pick<RouteObject, 'lazy' | 'hydrateFallbackElement'> {
  return {
    hydrateFallbackElement: <RouteFallback />,
    lazy: async () => {
      const Screen = pick(await load())
      return {
        element: role ? (
          <RequireRole role={role}>
            <Screen />
          </RequireRole>
        ) : (
          <Screen />
        ),
      }
    },
  }
}

export const routes: RouteObject[] = [
  {
    element: <AppRoot />,
    errorElement: <RouteErrorScreen />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: ROUTES.home, element: <HomeScreen /> },
          { path: ROUTES.whoWeAre, element: <WhoWeAreScreen /> },
          { path: ROUTES.ourApproach, element: <OurApproachScreen /> },
          { path: ROUTES.weekendClasses, element: <WeekendClassesScreen /> },
          { path: ROUTES.playKits, element: <PlayKitsScreen /> },
          { path: ROUTES.login, element: <LoginScreen /> },
          { path: ROUTES.register, element: <RegisterScreen /> },
          { path: ROUTES.forgotPassword, element: <ForgotPasswordScreen /> },
          { path: ROUTES.resetPassword, element: <ResetPasswordScreen /> },
          {
            path: ROUTES.designKit,
            ...lazyScreen(
              () => import('@/screens/design-kit'),
              (m) => m.DesignKitScreen,
            ),
          },
          { path: '*', element: <NotFoundScreen /> },
        ],
      },
      {
        path: ROUTES.parentDashboard,
        ...lazyScreen(
          () => import('@/screens/parent/dashboard'),
          (m) => m.ParentDashboardScreen,
          'PARENT',
        ),
      },
      {
        path: ROUTES.parentReport,
        ...lazyScreen(
          () => import('@/screens/parent/report'),
          (m) => m.ParentReportScreen,
          'PARENT',
        ),
      },
      {
        path: ROUTES.adminDashboard,
        ...lazyScreen(
          () => import('@/screens/admin/dashboard'),
          (m) => m.AdminDashboardScreen,
          'ADMIN',
        ),
      },
      { path: '/parent', element: <Navigate to={ROUTES.parentDashboard} replace /> },
      { path: '/admin', element: <Navigate to={ROUTES.adminDashboard} replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
