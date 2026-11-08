/**
 * Add / edit child (POST /api/me/children, PATCH /api/me/children/{id}) and
 * delete child (DELETE, soft; `409 conflict` while the child still has an
 * active class — shown inside the open confirm dialog).
 */
import { useState } from 'react'
import { api } from '@/api/client'
import type { Child, ChildPatch } from '@/api/schemas'
import { ConfirmDialog } from '@/components/rumi/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Field, Input, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { todayWib } from '@/lib/format'
import {
  childEditFormSchema,
  childFormSchema,
  validateForm,
  type FormErrors,
} from '@/lib/validation'

interface ChildFormValues {
  name: string
  dob: string
  notes: string
}

function initialValues(child: Child | null): ChildFormValues {
  return { name: child?.name ?? '', dob: child?.dob ?? '', notes: child?.notes ?? '' }
}

/** PATCH semantics (PRD §5.4.9): send only what changed. */
function changedFields(child: Child, data: ChildPatch): ChildPatch {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => child[key as keyof Child] !== value),
  )
}

interface ChildFormProps {
  child: Child | null
  onSaved: (child: Child) => void
  onCancel: () => void
}

function ChildForm({ child, onSaved, onCancel }: ChildFormProps) {
  const { toast } = useToast()
  const [values, setValues] = useState<ChildFormValues>(() => initialValues(child))
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(false)

  const setValue = (name: keyof ChildFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name)))
  }

  const save = async (data: ChildPatch & { name: string; dob: string }) => {
    if (!child) {
      const created = await api.createChild(data)
      toast(t('parent.child.created', { name: created.name }))
      return created
    }
    const patch = changedFields(child, data)
    if (Object.keys(patch).length === 0) return null
    const updated = await api.updateChild(child.id, patch)
    toast(t('parent.child.updated', { name: updated.name }))
    return updated
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    // Editing re-checks the dob only if it changed (PATCH sends only changes).
    const schema = child ? childEditFormSchema(child.dob) : childFormSchema
    const result = validateForm(schema, values)
    if (!result.success) {
      setErrors(result.errors)
      setFormError(t('parent.child.formError'))
      return
    }
    setBusy(true)
    try {
      const saved = await save(result.data)
      if (saved) onSaved(saved)
      else setFormError(t('parent.child.noChanges'))
    } catch (err) {
      setErrors(apiFieldErrors(err))
      setFormError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {formError && <InlineAlert variant="danger">{formError}</InlineAlert>}
      <Field label={t('parent.child.field.name')} required error={errors.name}>
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            value={values.name}
            onChange={(e) => setValue('name', e.target.value)}
          />
        )}
      </Field>
      <Field label={t('parent.child.field.dob')} required error={errors.dob}>
        {(control) => (
          <Input
            {...control}
            type="date"
            max={todayWib()}
            value={values.dob}
            onChange={(e) => setValue('dob', e.target.value)}
          />
        )}
      </Field>
      <Field
        label={t('parent.child.field.notes')}
        optional
        hint={t('parent.child.field.notesHint')}
        error={errors.notes}
      >
        {(control) => (
          <Textarea
            {...control}
            value={values.notes}
            onChange={(e) => setValue('notes', e.target.value)}
          />
        )}
      </Field>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isBusy}>
          {t('parent.child.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export interface ChildFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = add a new child. */
  child: Child | null
  onSaved: (child: Child) => void
}

export function ChildFormDialog({ open, onOpenChange, child, onSaved }: ChildFormDialogProps) {
  const title = child
    ? t('parent.child.dialog.editTitle', { name: child.name })
    : t('parent.child.dialog.addTitle')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={title} description={t('parent.child.dialog.description')} />
        <ChildForm child={child} onSaved={onSaved} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

export interface DeleteChildDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  child: Child
  onDeleted: () => void
}

export function DeleteChildDialog({
  open,
  onOpenChange,
  child,
  onDeleted,
}: DeleteChildDialogProps) {
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await api.deleteChild(child.id)
    } catch (err) {
      setError(apiErrorMessage(err))
      throw err
    }
    toast(t('parent.child.deleted', { name: child.name }))
    onDeleted()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
      title={t('parent.child.deleteTitle', { name: child.name })}
      body={t('parent.child.deleteBody', { name: child.name })}
      confirmLabel={t('parent.child.deleteConfirm')}
      tone="danger"
      onConfirm={handleConfirm}
    >
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
    </ConfirmDialog>
  )
}
