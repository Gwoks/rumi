/** /design-kit 10: table, the formatRupiah demo and Indonesian date/time formats. */
import { useState } from 'react'
import type { OrderStatus } from '@/api/schemas'
import { Price } from '@/components/rumi/price'
import { OrderStatusBadge } from '@/components/rumi/status-badge'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowAction,
} from '@/components/ui/table'
import { t } from '@/lib/copy'
import { formatDate, formatDateLong, formatDateTime, formatRupiah } from '@/lib/format'
import { DemoLabel, KitSection } from './kit-section'

interface SampleOrder {
  code: string
  parent: string
  total: number
  status: OrderStatus
}

const SAMPLE_ORDERS: readonly SampleOrder[] = [
  { code: 'RUMI-2026-0003', parent: 'Nadia Rahman', total: 570000, status: 'PENDING_WA' },
  { code: 'RUMI-2026-0002', parent: 'Hana Karim', total: 185000, status: 'PAID' },
  { code: 'RUMI-2026-0001', parent: 'Mariam Yusuf', total: 150000, status: 'CANCELLED' },
]

const SAMPLE_DATE = '2026-11-14'
const SAMPLE_TIMESTAMP = '2026-11-08T03:15:00Z'

function RupiahDemo() {
  const [raw, setRaw] = useState('1250000')
  const amount = Number.parseInt(raw, 10)
  return (
    <Card padding="standard">
      <DemoLabel>{t('designKit.rupiah.title')}</DemoLabel>
      <Field label={t('designKit.rupiah.label')} hint={t('designKit.rupiah.hint')}>
        {(control) => (
          <Input
            {...control}
            inputMode="numeric"
            value={raw}
            onChange={(event) => setRaw(event.target.value.replace(/[^\d-]/g, ''))}
          />
        )}
      </Field>
      <p className="mt-4 text-body-sm text-ink-secondary">
        {t('designKit.rupiah.output')}:{' '}
        <output className="text-h3 text-ink" aria-live="polite">
          {Number.isFinite(amount) ? formatRupiah(amount) : '—'}
        </output>
      </p>
    </Card>
  )
}

function DatesDemo() {
  const rows = [
    { label: t('designKit.dates.short'), value: formatDate(SAMPLE_DATE) },
    { label: t('designKit.dates.long'), value: formatDateLong(SAMPLE_DATE) },
    { label: t('designKit.dates.timestamp'), value: formatDateTime(SAMPLE_TIMESTAMP) },
  ]
  return (
    <Card padding="standard">
      <DemoLabel>{t('designKit.dates.title')}</DemoLabel>
      <dl className="space-y-3 text-body-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-ink-secondary">{row.label}</dt>
            <dd className="font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function DataSection() {
  return (
    <KitSection
      id="data"
      eyebrow={t('designKit.data.eyebrow')}
      title={t('designKit.data.title')}
      intro={t('designKit.data.intro')}
    >
      <Card padding="standard">
        <Table caption={t('designKit.table.caption')}>
          <TableHead>
            <tr>
              <TableHeaderCell>{t('designKit.table.code')}</TableHeaderCell>
              <TableHeaderCell>{t('designKit.table.parent')}</TableHeaderCell>
              <TableHeaderCell>{t('designKit.table.total')}</TableHeaderCell>
              <TableHeaderCell>{t('designKit.table.status')}</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">{t('designKit.table.action')}</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {SAMPLE_ORDERS.map((order) => (
              <TableRow key={order.code}>
                <TableCell className="font-semibold">{order.code}</TableCell>
                <TableCell>{order.parent}</TableCell>
                <TableCell>
                  <Price amount={order.total} />
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right">
                  <TableRowAction>{t('designKit.table.view')}</TableRowAction>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <RupiahDemo />
        <DatesDemo />
      </div>
    </KitSection>
  )
}
