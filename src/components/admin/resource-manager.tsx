/**
 * ResourceManager (plan: "Admin CRUD — one config-driven ResourceManager"):
 * a table listing plus a create/edit dialog form generated from `FieldDef[]`,
 * and a soft delete behind a ConfirmDialog. Configured three times by the
 * admin dashboard (CMS sections, classes, kits). It never imports the API
 * client: the screen passes `load` / `create` / `update` / `remove`.
 *
 * Errors: field errors from a server `validation_error` land next to their
 * control; a 409 (`conflict`, e.g. a duplicate CMS pair or a delete blocked by
 * active enrollments) is shown in the open dialog, which stays open.
 */
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/rumi/confirm-dialog'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineAlert } from '@/components/ui/inline-alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowAction,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { useAsync } from '@/lib/use-async'
import type { FieldDef } from './field-defs'
import { ResourceFormDialog, type ResourcePayload } from './resource-form'

export type { ResourcePayload } from './resource-form'

export interface ResourceColumn<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  className?: string
}

export interface ResourceManagerProps<T extends { id: number }> {
  /** Section heading (h2), e.g. "Kit edukasi". */
  title: string
  description?: string
  /** Lowercase singular noun used in copy: "kit", "kelas", "bagian konten". */
  singular: string
  columns: readonly ResourceColumn<T>[]
  fields: readonly FieldDef[]
  /** Human name of a row (toasts, dialog titles, aria labels). */
  itemLabel: (item: T) => string
  load: () => Promise<readonly T[]>
  create: (payload: ResourcePayload) => Promise<T>
  update: (id: number, payload: ResourcePayload) => Promise<T>
  remove: (id: number) => Promise<unknown>
  /** The record the edit form starts from (defaults to the item itself). */
  toRecord?: (item: T) => Readonly<Record<string, unknown>>
}

type Editing<T> = { mode: 'create' } | { mode: 'edit'; item: T } | null

export function ResourceManager<T extends { id: number }>({
  title,
  description,
  singular,
  columns,
  fields,
  itemLabel,
  load,
  create,
  update,
  remove,
  toRecord,
}: ResourceManagerProps<T>) {
  const list = useAsync(load, [])
  const { toast } = useToast()
  const [editing, setEditing] = useState<Editing<T>>(null)
  const [deleting, setDeleting] = useState<T | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const items = list.data ?? []

  const handleSubmit = async (payload: ResourcePayload) => {
    if (!editing) return
    if (editing.mode === 'create') {
      const created = await create(payload)
      toast(t('admin.resource.created', { name: itemLabel(created) }))
    } else {
      const updated = await update(editing.item.id, payload)
      toast(t('admin.resource.updated', { name: itemLabel(updated) }))
    }
    setEditing(null)
    list.reload()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await remove(deleting.id)
    } catch (err) {
      setDeleteError(apiErrorMessage(err))
      throw err
    }
    toast(t('admin.resource.deleted', { name: itemLabel(deleting) }))
    list.reload()
  }

  const openDelete = (item: T) => {
    setDeleteError(null)
    setDeleting(item)
  }

  const record = editing?.mode === 'edit' ? (toRecord?.(editing.item) ?? editing.item) : null
  const formTitle =
    editing?.mode === 'edit'
      ? t('admin.resource.editTitle', { name: itemLabel(editing.item) })
      : t('admin.resource.createTitle', { label: singular })

  const renderBody = () => {
    if (list.status === 'error' && !list.data) {
      return (
        <LoadError
          title={t('admin.resource.loadError', { label: singular })}
          error={list.error}
          onRetry={list.reload}
        />
      )
    }
    if (!list.data) return <LoadingBlock label={t('admin.resource.loading', { label: singular })} />
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('admin.resource.emptyTitle', { label: singular })}
          body={t('admin.resource.emptyBody', { label: singular })}
        />
      )
    }
    return (
      <Table caption={t('admin.resource.caption', { label: singular })}>
        <TableHead>
          <tr>
            {columns.map((column) => (
              <TableHeaderCell key={column.key} className={column.className}>
                {column.header}
              </TableHeaderCell>
            ))}
            <TableHeaderCell className="text-right">{t('admin.resource.actions')}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render(item)}
                </TableCell>
              ))}
              <TableCell className="whitespace-nowrap text-right">
                <TableRowAction
                  aria-label={t('admin.resource.editAria', { name: itemLabel(item) })}
                  onClick={() => setEditing({ mode: 'edit', item })}
                >
                  <Pencil aria-hidden="true" size={14} className="mr-1 inline" />
                  {t('admin.resource.edit')}
                </TableRowAction>
                <TableRowAction
                  aria-label={t('admin.resource.deleteAria', { name: itemLabel(item) })}
                  onClick={() => openDelete(item)}
                  className="text-danger hover:bg-danger-soft"
                >
                  <Trash2 aria-hidden="true" size={14} className="mr-1 inline" />
                  {t('admin.resource.delete')}
                </TableRowAction>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <section aria-labelledby="resource-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="resource-title" className="text-h2 text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-2 max-w-2xl text-body-sm text-ink-secondary">{description}</p>
          )}
        </div>
        <Button onClick={() => setEditing({ mode: 'create' })} className="shrink-0">
          <Plus aria-hidden="true" size={16} />
          {t('admin.resource.add', { label: singular })}
        </Button>
      </div>
      <Card
        padding="standard"
        className={cn('mt-6', list.status === 'loading' && list.data && 'opacity-70')}
        aria-busy={list.status === 'loading' || undefined}
      >
        {renderBody()}
      </Card>
      <ResourceFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={formTitle}
        fields={fields}
        mode={editing?.mode ?? 'create'}
        record={record}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('admin.resource.deleteTitle', { name: deleting ? itemLabel(deleting) : '' })}
        body={t('admin.resource.deleteBody', { name: deleting ? itemLabel(deleting) : '' })}
        confirmLabel={t('admin.resource.deleteConfirm')}
        tone="danger"
        onConfirm={handleDelete}
      >
        {deleteError && <InlineAlert variant="danger">{deleteError}</InlineAlert>}
      </ConfirmDialog>
    </section>
  )
}
