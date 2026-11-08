/**
 * Dialog (DESIGN.md "Overlays"): Radix Dialog re-themed by tokens. A bottom
 * sheet on mobile (`rounded-t-modal`, aligned to the bottom), a centered
 * modal from `sm` up. Radix traps focus, closes on Esc and restores focus.
 * `DialogHeader` renders the mandatory `Dialog.Title` plus a "Tutup" button.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { Button } from './button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogDescription = DialogPrimitive.Description

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-overlay bg-ink/40 backdrop-blur-sm animate-overlay-in',
        className,
      )}
      {...props}
    />
  )
})

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  size?: 'default' | 'wide'
}

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ className, size = 'default', children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <div className="pointer-events-none fixed inset-0 z-overlay flex items-end justify-center sm:items-center sm:p-6">
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'pointer-events-auto max-h-[92vh] w-full overflow-auto rounded-t-modal bg-surface p-6 text-ink shadow-modal outline-none animate-content-in sm:rounded-modal',
            size === 'wide' ? 'max-w-3xl' : 'max-w-lg',
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  )
})

export interface DialogHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Hide the close button (e.g. a blocking confirm). */
  hideClose?: boolean
  className?: string
}

export function DialogHeader({
  title,
  description,
  hideClose = false,
  className,
}: DialogHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <DialogPrimitive.Title className="text-h3 text-ink">{title}</DialogPrimitive.Title>
        {!hideClose && (
          <DialogPrimitive.Close asChild>
            <Button
              variant="icon"
              size="icon"
              aria-label={t('common.close')}
              className="-mr-2 -mt-2 shrink-0"
            >
              <X aria-hidden="true" size={20} />
            </Button>
          </DialogPrimitive.Close>
        )}
      </div>
      {description && (
        <DialogPrimitive.Description className="mt-2 text-body-sm text-ink-secondary">
          {description}
        </DialogPrimitive.Description>
      )}
    </div>
  )
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex flex-wrap justify-end gap-3', className)} {...props} />
}
