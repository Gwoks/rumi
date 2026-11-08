/**
 * Toast (DESIGN.md "Toast"): Radix Toast re-themed — a dark pill at the bottom
 * center. `useToast().toast(message, 'success' | 'error')` from anywhere under
 * <ToastProvider> (mounted in components/providers.tsx, above the router, so a
 * toast survives navigation). `dismissAll()` clears stale toasts when a view
 * takes over (Radix pauses the timer while the window is blurred, e.g. after
 * WhatsApp opens in a new tab).
 */
import * as ToastPrimitive from '@radix-ui/react-toast'
import { AlertCircle, Check } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { t } from '@/lib/copy'

export type ToastVariant = 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

export interface ToastApi {
  toast: (message: string, variant?: ToastVariant) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastApi>({ toast: () => {}, dismissAll: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

export const TOAST_DURATION_MS = 3200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, message, variant }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const dismissAll = useCallback(() => setItems([]), [])

  const value = useMemo(() => ({ toast, dismissAll }), [toast, dismissAll])

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider
        swipeDirection="down"
        duration={TOAST_DURATION_MS}
        label={t('common.toast.region')}
      >
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            type={item.variant === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
            className="flex items-center gap-2 rounded-full bg-surface-inverse px-5 py-3 text-body-sm font-medium text-ink-inverse shadow-float animate-toast-in"
          >
            {item.variant === 'success' ? (
              <Check aria-hidden="true" size={16} className="shrink-0 text-highlight" />
            ) : (
              <AlertCircle aria-hidden="true" size={16} className="shrink-0 text-accent" />
            )}
            <ToastPrimitive.Description>{item.message}</ToastPrimitive.Description>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          label={t('common.toast.viewport')}
          className="fixed bottom-6 left-1/2 z-toast flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 outline-none"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
