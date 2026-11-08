/**
 * CheckoutDialog (PRD §5.8.4 #21, §5.9.1; DESIGN.md "Stepper"): 1 Ringkasan →
 * 2 Detail (a child per class line + delivery) → 3 Konfirmasi → "Pesan via
 * WhatsApp" → POST /api/orders with ids and quantities only.
 *
 * The idempotency key is stable per checkout ATTEMPT: it is created on the
 * first submit and reused on every retry (also across closing and reopening
 * the dialog) until an order succeeds, so a lost response can never create a
 * second order — the server replays the first one (§5.9.1 step 2).
 */
import { useCallback, useRef, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Stepper } from '@/components/ui/stepper'
import { t, type CopyKey } from '@/lib/copy'
import { newIdempotencyKey, type CheckoutErrorView, type CheckoutRecovery } from './checkout-model'
import { ConfirmStep, DetailsStep, SummaryStep } from './checkout-steps'
import { CheckoutSuccess } from './checkout-success'
import {
  CONFIRM_STEP,
  DETAILS_STEP,
  SUMMARY_STEP,
  useCheckoutFlow,
  type CheckoutFlow,
  type CheckoutFlowOptions,
} from './use-checkout-flow'

const STEPS = [
  t('public.checkout.steps.summary'),
  t('public.checkout.steps.details'),
  t('public.checkout.steps.confirm'),
] as const

const RECOVERY_LABEL: Record<CheckoutRecovery, CopyKey> = {
  cart: 'public.checkout.editCart',
  details: 'public.checkout.error.editDetails',
  retry: 'common.retry',
}

export interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Close checkout and go back to the cart drawer. */
  onEditCart: () => void
}

export function CheckoutDialog({ open, onOpenChange, onEditCart }: CheckoutDialogProps) {
  const keyRef = useRef<string | null>(null)
  const [isBusy, setBusy] = useState(false)

  const takeKey = useCallback((): string => {
    if (!keyRef.current) keyRef.current = newIdempotencyKey()
    return keyRef.current
  }, [])
  const releaseKey = useCallback(() => {
    keyRef.current = null
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isBusy) return
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <CheckoutFlowView
          onClose={() => onOpenChange(false)}
          onEditCart={onEditCart}
          takeKey={takeKey}
          releaseKey={releaseKey}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  )
}

function ErrorAlert({
  error,
  onRecover,
}: {
  error: CheckoutErrorView
  onRecover: (recovery: CheckoutRecovery) => void
}) {
  return (
    <InlineAlert
      variant="danger"
      title={error.title}
      className="mb-5"
      action={
        <Button variant="secondary" size="sm" onClick={() => onRecover(error.recovery)}>
          {t(RECOVERY_LABEL[error.recovery])}
        </Button>
      }
    >
      <p>{error.message}</p>
      <p className="mt-1">{error.hint}</p>
    </InlineAlert>
  )
}

function FlowFooter({ flow, onEditCart }: { flow: CheckoutFlow; onEditCart: () => void }) {
  const { step, setStep, isSubmitting } = flow
  return (
    <DialogFooter>
      {step === SUMMARY_STEP ? (
        <Button variant="secondary" onClick={onEditCart}>
          {t('public.checkout.editCart')}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={isSubmitting}>
          {t('common.back')}
        </Button>
      )}
      {step < CONFIRM_STEP ? (
        <Button type="submit">{t('common.next')}</Button>
      ) : (
        <Button type="submit" variant="accent" loading={isSubmitting}>
          {t('public.checkout.confirm.submit')}
        </Button>
      )}
    </DialogFooter>
  )
}

function StepBody({ flow }: { flow: CheckoutFlow }) {
  const { cart, step, delivery } = flow
  if (step === SUMMARY_STEP) return <SummaryStep items={cart.items} totalIdr={cart.totalIdr} />
  if (step === DETAILS_STEP || !delivery) {
    return (
      <DetailsStep
        classLines={flow.classLines}
        hasKit={cart.hasKit}
        form={flow.form}
        childList={flow.childList}
        childErrors={flow.childErrors}
        onPickChild={flow.pickChild}
      />
    )
  }
  return (
    <ConfirmStep
      items={cart.items}
      totalIdr={cart.totalIdr}
      delivery={delivery}
      childName={flow.childName}
    />
  )
}

interface CheckoutFlowViewProps extends CheckoutFlowOptions {
  onEditCart: () => void
}

function CheckoutFlowView({ onEditCart, ...options }: CheckoutFlowViewProps) {
  const flow = useCheckoutFlow(options)
  const { cart, step, result, error } = flow

  if (result) {
    return (
      <>
        <DialogHeader
          title={t('public.checkout.successTitle')}
          description={t('public.checkout.success.heading')}
        />
        <CheckoutSuccess result={result} onDone={options.onClose} />
      </>
    )
  }

  if (cart.items.length === 0) {
    return (
      <>
        <DialogHeader
          title={t('public.checkout.title')}
          description={t('public.checkout.empty.body')}
        />
        <EmptyState icon={ShoppingBag} title={t('public.checkout.empty.title')} />
      </>
    )
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (step === SUMMARY_STEP) flow.setStep(DETAILS_STEP)
    else if (step === DETAILS_STEP) flow.goToConfirm()
    else void flow.submit()
  }

  const recover = (recovery: CheckoutRecovery) => {
    if (recovery === 'cart') onEditCart()
    else if (recovery === 'details') flow.setStep(DETAILS_STEP)
    else void flow.submit()
  }

  const progress = t('common.stepper.progress', { current: step + 1, total: STEPS.length })
  return (
    <form ref={flow.formRef} noValidate onSubmit={handleSubmit}>
      <DialogHeader
        title={t('public.checkout.title')}
        description={`${progress} · ${STEPS[step]}`}
      />
      <Stepper steps={STEPS} current={step} className="mb-6" />
      {error && <ErrorAlert error={error} onRecover={recover} />}
      <StepBody flow={flow} />
      <FlowFooter flow={flow} onEditCart={onEditCart} />
    </form>
  )
}
