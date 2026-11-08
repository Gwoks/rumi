/**
 * Checkout success state: the server's order code and total (never the cart
 * estimate) and a "Buka WhatsApp" link to the server-built `wa_url`, which
 * also auto-opens once in a new tab (the link is the fallback when a popup
 * blocker stops it).
 */
import { Check, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CheckoutResult } from '@/api/schemas'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'
import { Price } from '../price'
import { safeHttpsUrl } from './checkout-model'

export interface CheckoutSuccessProps {
  result: CheckoutResult
  onDone: () => void
}

export function CheckoutSuccess({ result, onDone }: CheckoutSuccessProps) {
  const { order } = result
  const waUrl = safeHttpsUrl(result.wa_url)
  return (
    <div className="text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary-strong"
      >
        <Check size={30} />
      </span>
      <dl className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3 rounded-2xl bg-highlight-soft p-4 text-left">
        <div>
          <dt className="text-caption text-ink-secondary">{t('public.checkout.success.code')}</dt>
          <dd className="mt-1 font-semibold text-ink">{order.order_code}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-secondary">{t('public.checkout.success.total')}</dt>
          <dd className="mt-1 font-semibold text-ink">
            <Price amount={order.total_amount_idr} />
          </dd>
        </div>
      </dl>
      <p className="mx-auto mt-5 max-w-sm text-body-sm text-ink-secondary">
        {t('public.checkout.success.body')}
      </p>
      <div className="mt-7 space-y-3">
        {waUrl && (
          <Button asChild variant="accent" size="lg" className="w-full">
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              {t('public.checkout.success.openWa')}
              <ExternalLink aria-hidden="true" size={16} />
              <span className="sr-only"> {t('public.checkout.success.newTab')}</span>
            </a>
          </Button>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link to={ROUTES.parentDashboard} onClick={onDone}>
              {t('public.checkout.success.orders')}
            </Link>
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('public.checkout.success.done')}
          </Button>
        </div>
      </div>
    </div>
  )
}
