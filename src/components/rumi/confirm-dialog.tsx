/**
 * ConfirmDialog (DESIGN.md "ConfirmDialog"): body text, then `secondary`
 * "Batal" and a `primary` or `danger` confirm, right-aligned. The confirm
 * shows a spinner while `onConfirm` (sync or async) runs; the dialog stays
 * open on failure so the caller can surface the error.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { t } from '@/lib/copy'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  /** Resolve to close; throw/reject to keep the dialog open. */
  onConfirm: () => void | Promise<void>
  /** Extra content under the body (e.g. an InlineAlert with the error). */
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel = t('common.cancel'),
  tone = 'primary',
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [isBusy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      /* the caller surfaces the error (e.g. via `children` or a toast) */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader title={title} description={body} hideClose={isBusy} />
        {children}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => void handleConfirm()}
            loading={isBusy}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
