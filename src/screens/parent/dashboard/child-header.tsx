/**
 * Dashboard header for the selected child: "Perjalanan {name} di RUMI", the
 * ChildSwitcher, child actions (tambah / ubah / hapus) and "Unduh Laporan".
 */
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Child } from '@/api/schemas'
import { ChildSwitcher } from '@/components/rumi/child-switcher'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/copy'
import { parentReportPath } from '@/lib/navigation'

export interface ChildHeaderProps {
  child: Child
  items: readonly Child[]
  onSelect: (childId: number) => void
  onAdd: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ChildHeader({ child, items, onSelect, onAdd, onEdit, onDelete }: ChildHeaderProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-body-sm text-ink-tertiary">{t('parent.dashboard.eyebrow')}</p>
        <h2 className="mt-1 text-h2 text-ink">
          {t('parent.dashboard.journey', { name: child.name })}
        </h2>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <ChildSwitcher
            items={items}
            value={child.id}
            onChange={onSelect}
            className="w-full sm:w-auto sm:min-w-72"
          />
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12"
            aria-label={t('parent.child.editAria', { name: child.name })}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" size={17} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 text-danger"
            aria-label={t('parent.child.deleteAria', { name: child.name })}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" size={17} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" className="h-12" onClick={onAdd}>
            <Plus aria-hidden="true" size={16} />
            {t('parent.child.add')}
          </Button>
          <Button asChild variant="primary" className="h-12">
            <Link to={parentReportPath(child.id)}>
              <FileText aria-hidden="true" size={16} />
              {t('parent.dashboard.downloadReport')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
