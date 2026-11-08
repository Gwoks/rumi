/**
 * "Pesanan" (GET /api/admin/orders, Paginated): status filter + search
 * (order code, parent name, email) + pagination. Rows expand to show items
 * and delivery details. "Tandai Lunas" (PENDING_WA → PAID) and "Batalkan"
 * (PENDING_WA | PAID → CANCELLED) go through a ConfirmDialog to PATCH
 * /api/admin/orders/{id}/status (PRD §5.9.4). A `409 invalid_transition`
 * (the order changed meanwhile, e.g. the sweep auto-cancelled it) closes the
 * dialog with an error toast and reloads the list; other errors stay in the
 * dialog.
 */
import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import { ORDER_STATUS_VALUES } from '@/api/enums'
import { isApiError } from '@/api/errors'
import type { Order, OrderStatus } from '@/api/schemas'
import { Pagination } from '@/components/admin/pagination'
import { ConfirmDialog } from '@/components/rumi/confirm-dialog'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Field, SearchInput } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Table, TableBody, TableHead, TableHeaderCell } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { formatRupiah } from '@/lib/format'
import { useAsync } from '@/lib/use-async'
import { OrderRow, type OrderAction } from './order-row'
import { PER_PAGE, useListQuery } from './use-list-query'

type StatusFilter = OrderStatus | 'ALL'

const FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: t('admin.orders.filter.all') },
  ...ORDER_STATUS_VALUES.map((s) => ({ value: s, label: t(`common.orderStatus.${s}`) })),
]

/** Codes that mean "the order is no longer in the state you saw". */
const STALE_CODES = new Set(['invalid_transition', 'not_found'])

function confirmCopy(action: OrderAction) {
  const { order, to } = action
  const vars = {
    code: order.order_code,
    amount: formatRupiah(order.total_amount_idr),
    name: order.parent_name,
  }
  return to === 'PAID'
    ? {
        title: t('admin.orders.markPaidTitle', vars),
        body: t('admin.orders.markPaidBody', vars),
        confirm: t('admin.orders.markPaidConfirm'),
        done: t('admin.orders.paid', vars),
        tone: 'primary' as const,
      }
    : {
        title: t('admin.orders.cancelTitle', vars),
        body: t('admin.orders.cancelBody', vars),
        confirm: t('admin.orders.cancelConfirm'),
        done: t('admin.orders.cancelled', vars),
        tone: 'danger' as const,
      }
}

export function AdminOrders() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const query = useListQuery(filter)
  const orders = useAsync(
    () =>
      api.adminListOrders({
        status: filter === 'ALL' ? undefined : filter,
        q: query.q || undefined,
        page: query.page,
        per_page: PER_PAGE,
      }),
    [filter, query.q, query.page],
  )
  const [action, setAction] = useState<OrderAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const data = orders.data
  const copy = action ? confirmCopy(action) : null

  const openAction = (next: OrderAction) => {
    setActionError(null)
    setAction(next)
  }

  const applyAction = async () => {
    if (!action || !copy) return
    setActionError(null)
    try {
      await api.adminUpdateOrderStatus(action.order.id, { status: action.to })
      toast(copy.done)
    } catch (err) {
      if (isApiError(err) && STALE_CODES.has(err.code)) {
        toast(apiErrorMessage(err), 'error')
      } else {
        setActionError(apiErrorMessage(err))
        throw err
      }
    } finally {
      orders.reload()
    }
  }

  const renderBody = () => {
    if (orders.status === 'error' && !data) {
      return (
        <LoadError
          title={t('admin.orders.loadError')}
          error={orders.error}
          onRetry={orders.reload}
        />
      )
    }
    if (!data) return <LoadingBlock label={t('admin.orders.loading')} />
    if (data.items.length === 0) {
      const isFiltered = filter !== 'ALL' || query.q !== ''
      return (
        <EmptyState
          icon={ShoppingBag}
          title={t('admin.orders.emptyTitle')}
          body={t(isFiltered ? 'admin.orders.emptyFilteredBody' : 'admin.orders.emptyBody')}
        />
      )
    }
    return (
      <Table caption={t('admin.orders.caption')} className="min-w-[760px]">
        <TableHead>
          <tr>
            <TableHeaderCell>{t('admin.orders.col.order')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.orders.col.parent')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.orders.col.total')}</TableHeaderCell>
            <TableHeaderCell>{t('admin.orders.col.status')}</TableHeaderCell>
            <TableHeaderCell className="text-right">
              {t('admin.orders.col.actions')}
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {data.items.map((order: Order) => (
            <OrderRow key={order.id} order={order} onAction={openAction} />
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <section aria-labelledby="orders-title">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 id="orders-title" className="text-h2 text-ink">
            {t('admin.orders.title')}
          </h2>
          <p className="mt-2 text-body-sm text-ink-secondary">
            {data ? t('admin.orders.total', { n: data.meta.total }) : t('admin.orders.description')}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Segmented
            aria-label={t('admin.orders.filterLabel')}
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
            className="flex-wrap"
          />
          <Field label={t('admin.orders.search')} className="w-full sm:w-72">
            {(control) => (
              <SearchInput
                {...control}
                value={query.search}
                placeholder={t('admin.orders.searchPlaceholder')}
                onChange={(e) => query.setSearch(e.target.value)}
              />
            )}
          </Field>
        </div>
      </div>
      <Card
        padding="standard"
        className={cn('mt-6', orders.status === 'loading' && data && 'opacity-70')}
        aria-busy={orders.status === 'loading' || undefined}
      >
        {renderBody()}
        {data && (
          <Pagination
            className="mt-6"
            page={data.meta.page}
            perPage={data.meta.per_page}
            total={data.meta.total}
            onPageChange={query.setPage}
            label={t('admin.orders.paginationLabel')}
          />
        )}
      </Card>
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={copy?.title ?? ''}
        body={copy?.body ?? ''}
        confirmLabel={copy?.confirm ?? ''}
        tone={copy?.tone ?? 'primary'}
        onConfirm={applyAction}
      >
        {actionError && <InlineAlert variant="danger">{actionError}</InlineAlert>}
      </ConfirmDialog>
    </section>
  )
}
