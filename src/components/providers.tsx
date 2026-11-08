/** Shared provider tree wrapping the router (hookbox pattern). The toast
 * provider sits above the router so a toast survives navigation. */
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast'

export function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
