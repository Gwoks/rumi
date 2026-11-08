/**
 * State and actions of one checkout session (the dialog renders it): the
 * current step, the delivery form, the child picked per class line, the
 * submit with a stable idempotency key, and the error → recovery mapping.
 */
import { useRef, useState } from 'react'
import { api } from '@/api/client'
import { isApiError } from '@/api/errors'
import type { CheckoutResult, Child } from '@/api/schemas'
import { useAuth } from '@/api/use-auth'
import { t } from '@/lib/copy'
import { useAsync, type AsyncState } from '@/lib/use-async'
import { focusFirstInvalid, useForm, type FormApi } from '@/lib/use-form'
import { deliveryFormSchema } from '@/lib/validation'
import { clearCart, setChild, type CartClassItem } from '@/stores/cart'
import { useCart, type CartSnapshot } from '@/stores/use-cart'
import {
  buildCheckoutBody,
  checkoutErrorView,
  safeHttpsUrl,
  type CheckoutErrorView,
  type DeliveryData,
} from './checkout-model'
import type { DeliveryValues } from './checkout-steps'

export const SUMMARY_STEP = 0
export const DETAILS_STEP = 1
export const CONFIRM_STEP = 2

export interface CheckoutFlowOptions {
  onClose: () => void
  /** The key for this attempt (created on first use, reused on retries). */
  takeKey: () => string
  /** Forget the key once an order exists. */
  releaseKey: () => void
  onBusyChange: (busy: boolean) => void
}

export interface CheckoutFlow {
  cart: CartSnapshot
  step: number
  setStep: (step: number) => void
  form: FormApi<DeliveryValues>
  formRef: React.RefObject<HTMLFormElement>
  childList: AsyncState<Child[]>
  classLines: CartClassItem[]
  childErrors: Record<string, string>
  delivery: DeliveryData | null
  error: CheckoutErrorView | null
  result: CheckoutResult | null
  isSubmitting: boolean
  childName: (id: number | null) => string | null
  pickChild: (lineId: string, childId: number | null) => void
  goToConfirm: () => void
  submit: () => Promise<void>
}

function withoutKey(map: Record<string, string>, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(map).filter(([k]) => k !== key))
}

/** Class lines that still need a child → their error message. */
function missingChildren(lines: readonly CartClassItem[]): Record<string, string> {
  return Object.fromEntries(
    lines
      .filter((line) => line.child_id === null)
      .map((line) => [line.line_id, t('public.checkout.details.childRequired')]),
  )
}

export function useCheckoutFlow({
  onClose,
  takeKey,
  releaseKey,
  onBusyChange,
}: CheckoutFlowOptions): CheckoutFlow {
  const cart = useCart()
  const { user } = useAuth()
  const [step, setStep] = useState(SUMMARY_STEP)
  const [delivery, setDelivery] = useState<DeliveryData | null>(null)
  const [childErrors, setChildErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<CheckoutErrorView | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const form = useForm<DeliveryValues>({
    name: user?.full_name ?? '',
    phone_wa: user?.phone_wa ?? '',
    address: '',
    notes: '',
  })
  const childList = useAsync<Child[]>(
    () => (cart.hasClass ? api.listChildren() : Promise.resolve([])),
    [cart.hasClass],
  )
  const classLines = cart.items.filter((i): i is CartClassItem => i.type === 'CLASS')

  const childName = (id: number | null): string | null =>
    childList.data?.find((c) => c.id === id)?.name ?? null

  const pickChild = (lineId: string, childId: number | null) => {
    const isAccepted = setChild(lineId, childId)
    setChildErrors((prev) =>
      isAccepted
        ? withoutKey(prev, lineId)
        : { ...prev, [lineId]: t('public.checkout.details.childDuplicate') },
    )
  }

  const goToConfirm = () => {
    const parsed = form.validate(deliveryFormSchema(cart.hasKit))
    const missing = missingChildren(classLines)
    setChildErrors(missing)
    if (!parsed || Object.keys(missing).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    const { name, phone_wa, address, notes } = parsed
    setDelivery({ name, phone_wa, address: address ?? null, notes })
    setStep(CONFIRM_STEP)
  }

  const handleFailure = (err: unknown) => {
    if (isApiError(err) && err.code === 'unauthorized') {
      onBusyChange(false)
      onClose()
      return
    }
    const view = checkoutErrorView(err)
    setError(view)
    if (view.recovery === 'details' && Object.keys(view.fieldErrors).length > 0) {
      form.setErrors(view.fieldErrors)
      setStep(DETAILS_STEP)
    }
  }

  const submit = async () => {
    const body = delivery ? buildCheckoutBody(cart.items, delivery, takeKey()) : null
    if (!body) {
      setStep(DETAILS_STEP)
      return
    }
    setSubmitting(true)
    onBusyChange(true)
    setError(null)
    try {
      const created = await api.checkout(body)
      releaseKey()
      clearCart()
      setResult(created)
      const waUrl = safeHttpsUrl(created.wa_url)
      if (waUrl) window.open(waUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      handleFailure(err)
    } finally {
      setSubmitting(false)
      onBusyChange(false)
    }
  }

  return {
    cart,
    step,
    setStep,
    form,
    formRef,
    childList,
    classLines,
    childErrors,
    delivery,
    error,
    result,
    isSubmitting,
    childName,
    pickChild,
    goToConfirm,
    submit,
  }
}
