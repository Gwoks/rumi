/** /design-kit 09: dialog (bottom sheet on mobile), drawer, confirm dialog, toasts. */
import { useState } from 'react'
import { ConfirmDialog } from '@/components/rumi/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { useToast } from '@/components/ui/toast'
import { t } from '@/lib/copy'
import { KitSection } from './kit-section'

export function OverlaysSection() {
  const { toast } = useToast()
  const [isConfirmOpen, setConfirmOpen] = useState(false)

  return (
    <KitSection
      id="overlay"
      eyebrow={t('designKit.overlays.eyebrow')}
      title={t('designKit.overlays.title')}
      intro={t('designKit.overlays.intro')}
    >
      <Card padding="standard">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">{t('designKit.dialog.open')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader
                title={t('designKit.dialog.title')}
                description={t('designKit.dialog.body')}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">{t('common.cancel')}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="accent">{t('designKit.dialog.confirm')}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary">{t('designKit.drawer.open')}</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader title={t('designKit.drawer.title')} />
              <DrawerBody>
                <p className="text-body-sm text-ink-secondary">{t('designKit.drawer.body')}</p>
              </DrawerBody>
            </DrawerContent>
          </Drawer>

          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            {t('designKit.confirm.open')}
          </Button>
          <ConfirmDialog
            open={isConfirmOpen}
            onOpenChange={setConfirmOpen}
            title={t('designKit.confirm.title')}
            body={t('designKit.confirm.body')}
            confirmLabel={t('designKit.confirm.action')}
            tone="danger"
            onConfirm={() => toast(t('designKit.confirm.done'))}
          />

          <Button variant="soft" onClick={() => toast(t('designKit.toast.successMessage'))}>
            {t('designKit.toast.success')}
          </Button>
          <Button variant="soft" onClick={() => toast(t('designKit.toast.errorMessage'), 'error')}>
            {t('designKit.toast.error')}
          </Button>
        </div>
      </Card>
    </KitSection>
  )
}
