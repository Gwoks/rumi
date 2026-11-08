/** Register steps: 1 parent, 2 child, 3 review (DESIGN.md "Forms" a11y rules). */
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { t } from '@/lib/copy'
import { ageFromDob, formatDateLong, todayWib } from '@/lib/format'
import type { FormApi } from '@/lib/use-form'
import type { ChildData, ChildValues, ParentData, ParentValues } from './register-model'

export function ParentStep({ form }: { form: FormApi<ParentValues> }) {
  const { errors, bind } = form
  return (
    <fieldset className="space-y-5">
      <legend className="mb-5 text-h4 text-ink">{t('auth.register.parent.title')}</legend>
      <Field label={t('auth.field.fullName')} error={errors.full_name} required>
        {(control) => <Input {...control} {...bind('full_name')} autoComplete="name" />}
      </Field>
      <Field label={t('auth.field.email')} error={errors.email} required>
        {(control) => (
          <Input
            {...control}
            {...bind('email')}
            type="email"
            autoComplete="email"
            placeholder={t('auth.field.emailPlaceholder')}
          />
        )}
      </Field>
      <Field
        label={t('auth.field.phone')}
        hint={t('auth.field.phoneHint')}
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
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t('auth.field.password')}
          hint={t('auth.field.passwordHint')}
          error={errors.password}
          required
        >
          {(control) => (
            <Input {...control} {...bind('password')} type="password" autoComplete="new-password" />
          )}
        </Field>
        <Field label={t('auth.field.passwordConfirm')} error={errors.password_confirm} required>
          {(control) => (
            <Input
              {...control}
              {...bind('password_confirm')}
              type="password"
              autoComplete="new-password"
            />
          )}
        </Field>
      </div>
    </fieldset>
  )
}

export function ChildStep({ form }: { form: FormApi<ChildValues> }) {
  const { errors, bind } = form
  return (
    <fieldset className="space-y-5">
      <legend className="mb-5 text-h4 text-ink">{t('auth.register.child.title')}</legend>
      <Field label={t('auth.register.child.name')} error={errors.name} required>
        {(control) => <Input {...control} {...bind('name')} autoComplete="off" />}
      </Field>
      <Field label={t('auth.register.child.dob')} error={errors.dob} required>
        {(control) => <Input {...control} {...bind('dob')} type="date" max={todayWib()} />}
      </Field>
      <Field
        label={t('auth.register.child.notes')}
        hint={t('auth.register.child.notesHint')}
        error={errors.notes}
        optional
      >
        {(control) => <Textarea {...control} {...bind('notes')} className="min-h-24" />}
      </Field>
    </fieldset>
  )
}

function ReviewBlock({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string
  editLabel: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border-subtle p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-h4 text-ink">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label={editLabel}>
          {t('auth.register.confirm.edit')}
        </Button>
      </div>
      <dl className="mt-3 space-y-1 text-body-sm text-ink-secondary">{children}</dl>
    </section>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-ink-tertiary">{label}:</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}

export interface ReviewStepProps {
  parent: ParentData
  child: ChildData
  onEditParent: () => void
  onEditChild: () => void
}

export function ReviewStep({ parent, child, onEditParent, onEditChild }: ReviewStepProps) {
  const age = ageFromDob(child.dob)
  return (
    <div className="space-y-4">
      <h2 className="text-h4 text-ink">{t('auth.register.confirm.title')}</h2>
      <ReviewBlock
        title={t('auth.register.confirm.parent')}
        editLabel={t('auth.register.confirm.editParent')}
        onEdit={onEditParent}
      >
        <Item label={t('auth.field.fullName')} value={parent.full_name} />
        <Item label={t('auth.field.email')} value={parent.email} />
        <Item label={t('auth.field.phone')} value={parent.phone_wa} />
      </ReviewBlock>
      <ReviewBlock
        title={t('auth.register.confirm.child')}
        editLabel={t('auth.register.confirm.editChild')}
        onEdit={onEditChild}
      >
        <Item label={t('auth.register.child.name')} value={child.name} />
        <Item
          label={t('auth.register.child.dob')}
          value={
            age === null
              ? formatDateLong(child.dob)
              : `${formatDateLong(child.dob)} (${t('auth.register.confirm.age', { n: age })})`
          }
        />
        {child.notes && <Item label={t('auth.register.child.notes')} value={child.notes} />}
      </ReviewBlock>
    </div>
  )
}
