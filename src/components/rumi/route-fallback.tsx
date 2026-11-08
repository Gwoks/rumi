/**
 * Placeholder while a code-split route's module loads on a hard page load
 * (React Router's `hydrateFallbackElement`): a centered spinner whose
 * sr-only label is "Memuat…".
 */
import { Spinner } from '@/components/ui/spinner'

export function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6 text-ink-secondary">
      <Spinner />
    </div>
  )
}
