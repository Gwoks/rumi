/**
 * Drawer (DESIGN.md "Drawer"): Radix Dialog styled as a right-side sheet
 * (full width on mobile, max-w-md from `sm`). Used by the cart drawer.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { Button } from './button'
import { DialogOverlay } from './dialog'

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

export const DrawerContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DrawerContent({ className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-y-0 right-0 z-overlay flex w-full max-w-md flex-col bg-surface text-ink shadow-modal outline-none animate-sheet-in-right sm:rounded-l-modal',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export interface DrawerHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}

export function DrawerHeader({ title, description, className }: DrawerHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-border-subtle p-5',
        className,
      )}
    >
      <div>
        <DialogPrimitive.Title className="text-h3 text-ink">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-body-sm text-ink-secondary">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close asChild>
        <Button
          variant="icon"
          size="icon"
          aria-label={t('common.close')}
          className="-mr-2 shrink-0"
        >
          <X aria-hidden="true" size={20} />
        </Button>
      </DialogPrimitive.Close>
    </div>
  )
}

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 space-y-3 overflow-auto p-5', className)} {...props} />
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-3 border-t border-border-subtle p-5', className)} {...props} />
}
