/**
 * "Kit" — ResourceManager configured for play kits (PRD §5.8.5 #31–#34,
 * KitCreate / KitPatch rules): name 2–120, category = Domain, description
 * 1–2000, image_url, price 0–100.000.000, stock 0–100.000, badge ≤ 24, active.
 */
import { api } from '@/api/client'
import type { KitCreate, KitPatch, PlayKit } from '@/api/schemas'
import type { FieldDef } from '@/components/admin/field-defs'
import { ResourceManager, type ResourceColumn } from '@/components/admin/resource-manager'
import { Price } from '@/components/rumi/price'
import { StockBadge } from '@/components/rumi/status-badge'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/copy'
import { DOMAINS, domainMeta } from '@/lib/domains'
import { ActiveBadge, IMAGE_URL_MAX, MAX_IDR } from './shared'

const MAX_STOCK = 100_000

const DOMAIN_OPTIONS = DOMAINS.map((d) => ({ value: d.key, label: t(d.labelKey) }))

const KIT_FIELDS: readonly FieldDef[] = [
  {
    name: 'name',
    label: t('admin.kits.field.name'),
    type: 'text',
    required: true,
    minLength: 2,
    maxLength: 120,
  },
  {
    name: 'category',
    label: t('admin.kits.field.category'),
    type: 'select',
    required: true,
    options: DOMAIN_OPTIONS,
  },
  {
    name: 'price_idr',
    label: t('admin.kits.field.price'),
    type: 'money',
    required: true,
    min: 0,
    max: MAX_IDR,
  },
  {
    name: 'stock',
    label: t('admin.kits.field.stock'),
    type: 'number',
    required: true,
    min: 0,
    max: MAX_STOCK,
  },
  {
    name: 'description',
    label: t('admin.kits.field.description'),
    type: 'textarea',
    required: true,
    maxLength: 2000,
  },
  {
    name: 'badge_tag',
    label: t('admin.kits.field.badge'),
    type: 'text',
    maxLength: 24,
    hint: t('admin.kits.field.badgeHint'),
  },
  {
    name: 'image_url',
    label: t('admin.kits.field.image'),
    type: 'url',
    maxLength: IMAGE_URL_MAX,
  },
  { name: 'is_active', label: t('admin.kits.field.active'), type: 'checkbox', defaultValue: true },
]

const KIT_COLUMNS: readonly ResourceColumn<PlayKit>[] = [
  {
    key: 'kit',
    header: t('admin.kits.col.kit'),
    render: (kit) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{kit.name}</span>
        {kit.badge_tag && <Badge variant="attention">{kit.badge_tag}</Badge>}
      </span>
    ),
  },
  {
    key: 'category',
    header: t('admin.kits.col.category'),
    className: 'text-ink-secondary',
    render: (kit) => t(domainMeta(kit.category).labelKey),
  },
  {
    key: 'price',
    header: t('admin.kits.col.price'),
    render: (kit) => <Price amount={kit.price_idr} />,
  },
  {
    key: 'stock',
    header: t('admin.kits.col.stock'),
    render: (kit) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums">{t('admin.kits.stockCount', { n: kit.stock })}</span>
        <StockBadge stock={kit.stock} />
      </span>
    ),
  },
  {
    key: 'status',
    header: t('admin.kits.col.status'),
    render: (kit) => <ActiveBadge isActive={kit.is_active} />,
  },
]

export function KitsManager() {
  return (
    <ResourceManager<PlayKit>
      title={t('admin.kits.title')}
      description={t('admin.kits.description')}
      singular={t('admin.kits.singular')}
      columns={KIT_COLUMNS}
      fields={KIT_FIELDS}
      itemLabel={(kit) => kit.name}
      load={() => api.adminListKits()}
      create={(payload) => api.adminCreateKit(payload as KitCreate)}
      update={(id, payload) => api.adminUpdateKit(id, payload as KitPatch)}
      remove={(id) => api.adminDeleteKit(id)}
    />
  )
}
