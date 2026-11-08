/**
 * Assessment logger (POST /api/admin/assessments, PRD §5.8.5 AssessmentCreate):
 * domain, level 1–4 with its rubric label, milestone 1–200, notes ≤ 1000,
 * observed_on ≤ today (WIB) and an optional class from the child's
 * CONFIRMED/ATTENDED enrollments held today or earlier
 * (`assessmentClassOptions`). Client rules mirror the server; server `fields`
 * errors land next to their control.
 */
import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { api } from '@/api/client'
import { DOMAIN_VALUES } from '@/api/enums'
import type { AssessmentLevel, Domain, StudentDetail } from '@/api/schemas'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { domainMeta, LEVELS } from '@/lib/domains'
import { parseDateStr, todayWib } from '@/lib/format'
import { optionalText, requiredText, validateForm, type FormErrors } from '@/lib/validation'
import { assessmentClassOptions } from './assessment-class-options'

const LEVEL_VALUES = LEVELS.map((l) => String(l.level))
const DOMAIN_SET: ReadonlySet<string> = new Set(DOMAIN_VALUES)

const assessmentFormSchema = z.object({
  domain: z
    .string()
    .refine((v): v is Domain => DOMAIN_SET.has(v), { message: t('admin.validation.option') }),
  level: z
    .string()
    .refine((v) => LEVEL_VALUES.includes(v), { message: t('admin.validation.option') })
    .transform((v) => Number(v) as AssessmentLevel),
  milestone: requiredText(1, 200),
  notes: optionalText(1000),
  observed_on: z
    .string()
    .refine((s) => parseDateStr(s) !== null, { message: t('common.validation.date') })
    .refine((s) => parseDateStr(s) === null || s <= todayWib(), {
      message: t('admin.validation.futureDate'),
    }),
  class_id: z.string().transform((v) => (v ? Number(v) : null)),
})

interface FormValues {
  domain: string
  level: string
  milestone: string
  notes: string
  observed_on: string
  class_id: string
}

const emptyValues = (): FormValues => ({
  domain: DOMAIN_VALUES[0],
  level: '',
  milestone: '',
  notes: '',
  observed_on: todayWib(),
  class_id: '',
})

export interface AssessmentFormProps {
  detail: StudentDetail
  onSaved: () => void
}

export function AssessmentForm({ detail, onSaved }: AssessmentFormProps) {
  const { toast } = useToast()
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(false)
  const name = detail.child.name

  const setValue = (key: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateForm(assessmentFormSchema, values)
    if (!result.success) {
      setErrors(result.errors)
      setFormError(t('admin.assessment.formError'))
      return
    }
    setBusy(true)
    try {
      await api.adminCreateAssessment({ child_id: detail.child.id, ...result.data })
      toast(t('admin.assessment.saved', { name }))
      setValues(emptyValues())
      onSaved()
    } catch (err) {
      setErrors(apiFieldErrors(err))
      setFormError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card variant="tint" tone="yellow" padding="standard" asChild>
      <section aria-labelledby="assessment-form-title">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface"
          >
            <ClipboardCheck size={20} />
          </span>
          <div>
            <h3 id="assessment-form-title" className="text-h4 text-ink">
              {t('admin.assessment.title')}
            </h3>
            <p className="mt-1 text-body-sm text-ink-secondary">
              {t('admin.assessment.description')}
            </p>
          </div>
        </div>
        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          {formError && <InlineAlert variant="danger">{formError}</InlineAlert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.assessment.domain')} required error={errors.domain}>
              {(control) => (
                <Select
                  {...control}
                  value={values.domain}
                  onChange={(e) => setValue('domain', e.target.value)}
                >
                  {DOMAIN_VALUES.map((d) => (
                    <option key={d} value={d}>
                      {t(domainMeta(d).labelKey)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('admin.assessment.level')} required error={errors.level}>
              {(control) => (
                <Select
                  {...control}
                  value={values.level}
                  onChange={(e) => setValue('level', e.target.value)}
                >
                  <option value="" disabled>
                    {t('admin.assessment.levelPlaceholder')}
                  </option>
                  {LEVELS.map((l) => (
                    <option key={l.level} value={l.level}>
                      {t('admin.assessment.levelOption', { level: l.level, label: t(l.labelKey) })}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t('admin.assessment.milestone')}
              required
              error={errors.milestone}
              className="sm:col-span-2"
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.milestone}
                  placeholder={t('admin.assessment.milestonePlaceholder')}
                  onChange={(e) => setValue('milestone', e.target.value)}
                />
              )}
            </Field>
            <Field label={t('admin.assessment.observedOn')} required error={errors.observed_on}>
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  max={todayWib()}
                  value={values.observed_on}
                  onChange={(e) => setValue('observed_on', e.target.value)}
                />
              )}
            </Field>
            <Field label={t('admin.assessment.class')} optional error={errors.class_id}>
              {(control) => (
                <Select
                  {...control}
                  value={values.class_id}
                  onChange={(e) => setValue('class_id', e.target.value)}
                >
                  <option value="">{t('admin.assessment.noClass')}</option>
                  {assessmentClassOptions(detail.enrollments).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t('admin.assessment.notes')}
              optional
              error={errors.notes}
              className="sm:col-span-2"
            >
              {(control) => (
                <Textarea
                  {...control}
                  value={values.notes}
                  onChange={(e) => setValue('notes', e.target.value)}
                />
              )}
            </Field>
          </div>
          <Button type="submit" loading={isBusy}>
            {t('admin.assessment.submit')}
          </Button>
        </form>
      </section>
    </Card>
  )
}
