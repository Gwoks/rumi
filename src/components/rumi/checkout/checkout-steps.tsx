/**
 * The three checkout steps (DESIGN.md "Stepper"): 1 Ringkasan (itemized IDR),
 * 2 Detail (child per class line + delivery), 3 Konfirmasi. Presentational:
 * the dialog owns state and passes it in.
 */
import { Link } from 'react-router-dom'
import type { Child } from '@/api/schemas'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { InlineAlert } from '@/components/ui/inline-alert'
import { InlineNote } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatDate, formatDateLong } from '@/lib/format'
import { ROUTES } from '@/lib/navigation'
import { FOCUS } from '@/lib/styles'
import type { FormApi } from '@/lib/use-form'
import { lineTotal, type CartClassItem, type CartItem } from '@/stores/cart'
import { LoadError } from '../async-states'
import { Price } from '../price'
import type { DeliveryData } from './checkout-model'

export type DeliveryValues = { name: string; phone_wa: string; address: string; notes: string }

function lineLabel(item: CartItem): string {
  return item.type === 'KIT'
    ? t('public.checkout.summary.kitLine', { name: item.name, n: item.quantity })
    : item.title
}

function ItemRows({
  items,
  childName,
}: {
  items: readonly CartItem[]
  childName?: (id: number | null) => string | null
}) {
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => {
        const child = item.type === 'CLASS' ? childName?.(item.child_id) : null
        return (
          <li key={item.line_id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-ink">{lineLabel(item)}</p>
              {item.type === 'CLASS' && (
                <p className="text-caption text-ink-secondary">
                  {formatDateLong(item.date)} · {t('common.time.wib', { time: item.time_slot })}
                  {child && ` · ${t('public.cart.class.child', { name: child })}`}
                </p>
              )}
            </div>
            <Price amount={lineTotal(item)} className="text-body-sm font-semibold text-ink" />
          </li>
        )
      })}
    </ul>
  )
}

function TotalRow({ amount }: { amount: number }) {
  return (
    <p className="mt-2 flex items-center justify-between border-t border-border pt-4 text-body font-semibold text-ink">
      <span>{t('public.checkout.summary.total')}</span>
      <Price amount={amount} />
    </p>
  )
}

export function SummaryStep({ items, totalIdr }: { items: readonly CartItem[]; totalIdr: number }) {
  return (
    <div>
      <ItemRows items={items} />
      <TotalRow amount={totalIdr} />
      <InlineNote className="mt-4">{t('public.checkout.summary.note')}</InlineNote>
    </div>
  )
}

export interface ChildrenState {
  status: 'loading' | 'success' | 'error'
  data: Child[] | undefined
  error: unknown
  reload: () => void
}

interface ChildPickersProps {
  lines: readonly CartClassItem[]
  childList: ChildrenState
  errors: Record<string, string>
  onPick: (lineId: string, childId: number | null) => void
}

function ChildPickers({ lines, childList, errors, onPick }: ChildPickersProps) {
  if (childList.status === 'loading' && !childList.data) {
    return (
      <div aria-busy="true" className="space-y-3">
        <Skeleton className="h-11" />
      </div>
    )
  }
  if (childList.status === 'error') {
    return (
      <LoadError
        title={t('public.checkout.details.childrenError')}
        error={childList.error}
        onRetry={childList.reload}
      />
    )
  }
  const list = childList.data ?? []
  if (list.length === 0) {
    return (
      <InlineAlert variant="attention" title={t('public.checkout.details.noChildren')}>
        <Link
          to={ROUTES.parentDashboard}
          className={cn('font-semibold text-accent-strong underline', FOCUS)}
        >
          {t('public.checkout.details.addChild')}
        </Link>
      </InlineAlert>
    )
  }
  return (
    <div className="space-y-4">
      {lines.map((line) => (
        <Field
          key={line.line_id}
          label={t('public.checkout.details.childFor', {
            title: line.title,
            date: formatDate(line.date),
          })}
          error={errors[line.line_id]}
          required
        >
          {(control) => (
            <Select
              {...control}
              value={line.child_id === null ? '' : String(line.child_id)}
              onChange={(event) =>
                onPick(line.line_id, event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">{t('public.checkout.details.childPlaceholder')}</option>
              {list.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} ({t('common.age.years', { n: child.age_years })})
                </option>
              ))}
            </Select>
          )}
        </Field>
      ))}
    </div>
  )
}

export interface DetailsStepProps {
  classLines: readonly CartClassItem[]
  hasKit: boolean
  form: FormApi<DeliveryValues>
  childList: ChildrenState
  childErrors: Record<string, string>
  onPickChild: (lineId: string, childId: number | null) => void
}

export function DetailsStep({
  classLines,
  hasKit,
  form,
  childList,
  childErrors,
  onPickChild,
}: DetailsStepProps) {
  const { errors, bind } = form
  return (
    <div className="space-y-8">
      {classLines.length > 0 && (
        <fieldset>
          <legend className="mb-4 text-h4 text-ink">{t('public.checkout.details.children')}</legend>
          <ChildPickers
            lines={classLines}
            childList={childList}
            errors={childErrors}
            onPick={onPickChild}
          />
        </fieldset>
      )}
      <fieldset className="space-y-4">
        <legend className="text-h4 text-ink">{t('public.checkout.details.contact')}</legend>
        <Field label={t('public.checkout.details.name')} error={errors.name} required>
          {(control) => <Input {...control} {...bind('name')} autoComplete="name" />}
        </Field>
        <Field
          label={t('public.checkout.details.phone')}
          hint={t('public.checkout.details.phoneHint')}
          error={errors.phone_wa}
          required
        >
          {(control) => (
            <Input
              {...control}
              {...bind('phone_wa')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('auth.field.phonePlaceholder')}
            />
          )}
        </Field>
        {hasKit && (
          <Field
            label={t('public.checkout.details.address')}
            hint={t('public.checkout.details.addressHint')}
            error={errors.address}
            required
          >
            {(control) => (
              <Textarea
                {...control}
                {...bind('address')}
                autoComplete="street-address"
                className="min-h-24"
              />
            )}
          </Field>
        )}
        <Field label={t('public.checkout.details.notes')} error={errors.notes} optional>
          {(control) => <Textarea {...control} {...bind('notes')} className="min-h-20" />}
        </Field>
      </fieldset>
    </div>
  )
}

export interface ConfirmStepProps {
  items: readonly CartItem[]
  totalIdr: number
  delivery: DeliveryData
  childName: (id: number | null) => string | null
}

export function ConfirmStep({ items, totalIdr, delivery, childName }: ConfirmStepProps) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="checkout-confirm-items">
        <h3 id="checkout-confirm-items" className="text-h4 text-ink">
          {t('public.checkout.confirm.items')}
        </h3>
        <ItemRows items={items} childName={childName} />
        <TotalRow amount={totalIdr} />
      </section>
      <section aria-labelledby="checkout-confirm-recipient">
        <h3 id="checkout-confirm-recipient" className="text-h4 text-ink">
          {t('public.checkout.confirm.recipient')}
        </h3>
        <dl className="mt-2 space-y-1 text-body-sm text-ink-secondary">
          <div className="flex gap-2">
            <dt className="sr-only">{t('public.checkout.details.name')}</dt>
            <dd className="font-semibold text-ink">{delivery.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">{t('public.checkout.details.phone')}</dt>
            <dd>{delivery.phone_wa}</dd>
          </div>
          {delivery.address && (
            <div className="flex gap-2">
              <dt className="sr-only">{t('public.checkout.details.address')}</dt>
              <dd>{delivery.address}</dd>
            </div>
          )}
          {delivery.notes && (
            <div className="flex gap-2">
              <dt className="sr-only">{t('public.checkout.details.notes')}</dt>
              <dd>{delivery.notes}</dd>
            </div>
          )}
        </dl>
      </section>
      <InlineNote>{t('public.checkout.confirm.intro')}</InlineNote>
    </div>
  )
}
