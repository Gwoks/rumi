/**
 * "Konten" — ResourceManager configured for CMS sections (PRD §5.7 registry,
 * §5.8.5 #23–#26). page_slug + section_key are a fixed registry pair, chosen
 * on create and immutable after; `body` is edited as JSON and checked against
 * the pair's strict zod shape (cms-schemas.ts) before the request — the server
 * validates the same shape and its `fields` errors (e.g. `body.cards.0.title`)
 * land under the JSON editor. A duplicate live pair is a 409 shown in the form.
 */
import type { z } from 'zod'
import { api } from '@/api/client'
import {
  cmsBodySchemaFor,
  cmsSectionKeys,
  pageSlugSchema,
  type CmsCreate,
  type CmsPatch,
  type CmsSection,
  type PageSlug,
} from '@/api/schemas'
import type { FieldDef, FormValues, ParsedValue, ParsedValues } from '@/components/admin/field-defs'
import { ResourceManager, type ResourceColumn } from '@/components/admin/resource-manager'
import { isCopyKey, t, type CopyKey } from '@/lib/copy'
import { ActiveBadge, IMAGE_URL_MAX } from './shared'

const SORT_ORDER_LIMIT = 1000

const PAGE_LABEL_KEYS: Record<PageSlug, CopyKey> = {
  home: 'common.nav.home',
  'who-we-are': 'common.nav.whoWeAre',
  'our-approach': 'common.nav.ourApproach',
}

const pageLabel = (slug: string): string => {
  const parsed = pageSlugSchema.safeParse(slug)
  return parsed.success ? t(PAGE_LABEL_KEYS[parsed.data]) : slug
}

const sectionLabel = (key: string): string => {
  const copyKey = `admin.content.section.${key}`
  return isCopyKey(copyKey) ? t(copyKey) : key
}

const PAGE_OPTIONS = pageSlugSchema.options.map((slug) => ({ value: slug, label: pageLabel(slug) }))

function sectionOptions(values: FormValues) {
  const page = pageSlugSchema.safeParse(values.page_slug)
  if (!page.success) return []
  return cmsSectionKeys(page.data).map((key) => ({ value: key, label: sectionLabel(key) }))
}

const pairRule = (value: ParsedValue, values: ParsedValues): string | null =>
  typeof value === 'string' &&
  typeof values.page_slug === 'string' &&
  !cmsBodySchemaFor(values.page_slug, value)
    ? t('admin.validation.cmsPair')
    : null

/** First zod issue of a CMS body as an Indonesian message with its JSON path. */
function cmsIssueMessage(issue: z.ZodIssue): string {
  const path = issue.path.join('.') || t('admin.validation.cmsRoot')
  if (issue.code === 'unrecognized_keys') {
    return t('admin.validation.cmsUnknown', { path, keys: issue.keys.join(', ') })
  }
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return t('admin.validation.cmsMissing', { path })
  }
  return t('admin.validation.cmsBody', { path })
}

const bodyRule = (value: ParsedValue, values: ParsedValues): string | null => {
  if (typeof values.page_slug !== 'string' || typeof values.section_key !== 'string') return null
  const schema = cmsBodySchemaFor(values.page_slug, values.section_key)
  if (!schema) return null
  const parsed = schema.safeParse(value)
  return parsed.success ? null : cmsIssueMessage(parsed.error.issues[0])
}

const CMS_FIELDS: readonly FieldDef[] = [
  {
    name: 'page_slug',
    label: t('admin.content.field.page'),
    type: 'select',
    required: true,
    createOnly: true,
    options: PAGE_OPTIONS,
  },
  {
    name: 'section_key',
    label: t('admin.content.field.section'),
    type: 'select',
    required: true,
    createOnly: true,
    options: sectionOptions,
    validation: pairRule,
  },
  {
    name: 'title',
    label: t('admin.content.field.title'),
    type: 'text',
    maxLength: 120,
    hint: t('admin.content.field.titleHint'),
  },
  {
    name: 'sort_order',
    label: t('admin.content.field.sortOrder'),
    type: 'number',
    required: true,
    min: -SORT_ORDER_LIMIT,
    max: SORT_ORDER_LIMIT,
    defaultValue: '0',
    hint: t('admin.content.field.sortOrderHint'),
  },
  {
    name: 'body',
    label: t('admin.content.field.body'),
    type: 'json',
    required: true,
    hint: t('admin.content.field.bodyHint'),
    validation: bodyRule,
  },
  {
    name: 'image_url',
    label: t('admin.content.field.image'),
    type: 'url',
    maxLength: IMAGE_URL_MAX,
    hint: t('admin.content.field.imageHint'),
  },
  {
    name: 'is_active',
    label: t('admin.content.field.active'),
    type: 'checkbox',
    defaultValue: true,
  },
]

const CMS_COLUMNS: readonly ResourceColumn<CmsSection>[] = [
  {
    key: 'section',
    header: t('admin.content.col.section'),
    render: (s) => (
      <>
        <span className="block font-semibold">{s.title ?? sectionLabel(s.section_key)}</span>
        <span className="block text-caption text-ink-secondary">{s.section_key}</span>
      </>
    ),
  },
  {
    key: 'page',
    header: t('admin.content.col.page'),
    className: 'text-ink-secondary',
    render: (s) => pageLabel(s.page_slug),
  },
  {
    key: 'order',
    header: t('admin.content.col.order'),
    className: 'tabular-nums',
    render: (s) => s.sort_order,
  },
  {
    key: 'status',
    header: t('admin.content.col.status'),
    render: (s) => <ActiveBadge isActive={s.is_active} />,
  },
]

export function ContentManager() {
  return (
    <ResourceManager<CmsSection>
      title={t('admin.content.title')}
      description={t('admin.content.description')}
      singular={t('admin.content.singular')}
      columns={CMS_COLUMNS}
      fields={CMS_FIELDS}
      itemLabel={(s) => s.title ?? sectionLabel(s.section_key)}
      load={() => api.adminListCms()}
      create={(payload) => api.adminCreateCms(payload as CmsCreate)}
      update={(id, payload) => api.adminUpdateCms(id, payload as CmsPatch)}
      remove={(id) => api.adminDeleteCms(id)}
    />
  )
}
