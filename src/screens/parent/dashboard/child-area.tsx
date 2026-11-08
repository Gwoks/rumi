/**
 * The child-scoped part of the parent dashboard: loads the parent's children
 * (`api.listChildren`), resolves the selected one from `?child=`, loads its
 * ChildReport once (latest levels, assessments, attendance, enrollments) and
 * renders the active section. Also owns the add / edit / delete child dialogs.
 */
import { Plus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Child, ChildReport } from '@/api/schemas'
import { useUpdateSearchParams } from '@/components/rumi/dashboard-hooks'
import { LoadError, LoadingBlock } from '@/components/rumi/load-state'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { t } from '@/lib/copy'
import { useAsync, type AsyncState } from '@/lib/use-async'
import { AttendanceSection } from './attendance'
import { ChildFormDialog, DeleteChildDialog } from './child-dialogs'
import { ChildHeader } from './child-header'
import { OverviewSection } from './overview'
import { ProgressSection } from './progress'
import { CHILD_PARAM, pickChild, type ChildTab } from './tabs'

type DialogState = 'add' | 'edit' | 'delete' | null

export interface ChildAreaProps {
  tab: ChildTab
  onNavigate: (tab: string) => void
}

function loadReport(child: Child | null): Promise<ChildReport | null> {
  return child ? api.getChildReport(child.id) : Promise.resolve(null)
}

interface SectionProps {
  tab: ChildTab
  child: Child
  report: AsyncState<ChildReport | null>
  onNavigate: (tab: string) => void
}

function ChildSection({ tab, child, report, onNavigate }: SectionProps) {
  // While switching children the previous report is still in `data`: only
  // render a report that belongs to the selected child.
  const data = report.data?.child.id === child.id ? report.data : null
  if (report.status === 'error' && !data) {
    return (
      <LoadError
        className="mt-8"
        title={t('parent.dashboard.reportError')}
        error={report.error}
        onRetry={report.reload}
      />
    )
  }
  if (!data) return <LoadingBlock className="mt-8" label={t('parent.dashboard.reportLoading')} />
  if (tab === 'attendance') return <AttendanceSection child={child} report={data} />
  if (tab === 'progress') return <ProgressSection child={child} report={data} />
  return <OverviewSection child={child} report={data} onNavigate={onNavigate} />
}

export function ChildArea({ tab, onNavigate }: ChildAreaProps) {
  const [params] = useSearchParams()
  const updateParams = useUpdateSearchParams()
  const children = useAsync(() => api.listChildren(), [])
  const selected = pickChild(children.data ?? [], params.get(CHILD_PARAM))
  const report = useAsync(() => loadReport(selected), [selected?.id])
  const [dialog, setDialog] = useState<DialogState>(null)

  const selectChild = (childId: number) => updateParams({ [CHILD_PARAM]: String(childId) })
  const closeDialog = (open: boolean) => !open && setDialog(null)

  const handleSaved = (child: Child, isNew: boolean) => {
    setDialog(null)
    children.reload()
    if (isNew) selectChild(child.id)
    else report.reload()
  }

  const handleDeleted = () => {
    updateParams({ [CHILD_PARAM]: null }, { replace: true })
    children.reload()
  }

  if (children.status === 'error' && !children.data) {
    return (
      <LoadError
        title={t('parent.dashboard.loadError')}
        error={children.error}
        onRetry={children.reload}
      />
    )
  }
  if (!children.data) return <LoadingBlock label={t('parent.dashboard.loading')} />

  const addDialog = (
    <ChildFormDialog
      open={dialog === 'add'}
      onOpenChange={closeDialog}
      child={null}
      onSaved={(child) => handleSaved(child, true)}
    />
  )

  if (!selected) {
    return (
      <>
        <EmptyState
          icon={UserRound}
          headingLevel="h2"
          title={t('parent.empty.noChildTitle')}
          body={t('parent.empty.noChildBody')}
          action={
            <Button onClick={() => setDialog('add')}>
              <Plus aria-hidden="true" size={16} />
              {t('parent.child.add')}
            </Button>
          }
        />
        {addDialog}
      </>
    )
  }

  return (
    <>
      <ChildHeader
        child={selected}
        items={children.data}
        onSelect={selectChild}
        onAdd={() => setDialog('add')}
        onEdit={() => setDialog('edit')}
        onDelete={() => setDialog('delete')}
      />
      <ChildSection tab={tab} child={selected} report={report} onNavigate={onNavigate} />
      {addDialog}
      <ChildFormDialog
        open={dialog === 'edit'}
        onOpenChange={closeDialog}
        child={selected}
        onSaved={(child) => handleSaved(child, false)}
      />
      <DeleteChildDialog
        open={dialog === 'delete'}
        onOpenChange={closeDialog}
        child={selected}
        onDeleted={handleDeleted}
      />
    </>
  )
}
