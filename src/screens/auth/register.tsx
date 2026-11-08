/**
 * `/register` (PRD §5.8.3 #7): three steps with a Stepper — 1 parent,
 * 2 first child, 3 review → one atomic API call that creates both and signs
 * the parent in → "Ahlan wa sahlan" success + welcome toast + dashboard CTA.
 * `email_taken` and field errors are routed back to the step that owns them.
 */
import { PartyPopper } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { register } from '@/api/auth-store'
import type { RegisterResult } from '@/api/schemas'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import { useToast } from '@/components/ui/toast'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'
import { focusFirstInvalid, useForm } from '@/lib/use-form'
import { AuthCard, AuthLink, FormAlert } from './auth-card'
import {
  buildRegisterBody,
  CHILD_STEP,
  childStepSchema,
  CONFIRM_STEP,
  PARENT_STEP,
  parentStepSchema,
  registerErrorView,
  type ChildData,
  type ChildValues,
  type ParentData,
  type ParentValues,
} from './register/register-model'
import { ChildStep, ParentStep, ReviewStep } from './register/register-steps'

const STEPS = [
  t('auth.register.steps.parent'),
  t('auth.register.steps.child'),
  t('auth.register.steps.confirm'),
] as const

function RegisterSuccess({ result }: { result: RegisterResult }) {
  return (
    <div role="status" className="text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-highlight-soft text-ink"
      >
        <PartyPopper size={28} />
      </span>
      <p className="mt-5 text-body text-ink-secondary">
        {t('auth.register.success.body', { child: result.child.name })}
      </p>
      <div className="mt-7 flex flex-col gap-3">
        <Button asChild size="lg">
          <Link to={ROUTES.parentDashboard}>{t('auth.register.success.cta')}</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to={ROUTES.weekendClasses}>{t('auth.register.success.classes')}</Link>
        </Button>
      </div>
    </div>
  )
}

export function RegisterScreen() {
  const { toast } = useToast()
  const [step, setStep] = useState(PARENT_STEP)
  const parentForm = useForm<ParentValues>({
    full_name: '',
    email: '',
    phone_wa: '',
    password: '',
    password_confirm: '',
  })
  const childForm = useForm<ChildValues>({ name: '', dob: '', notes: '' })
  const [parent, setParent] = useState<ParentData | null>(null)
  const [child, setChild] = useState<ChildData | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  if (result) {
    return (
      <AuthCard
        title={t('auth.register.success.title', { name: result.user.full_name })}
        size="wide"
      >
        <RegisterSuccess result={result} />
      </AuthCard>
    )
  }

  const goTo = (next: number) => {
    setFormError(null)
    setStep(next)
  }

  const submitAccount = async (parentData: ParentData, childData: ChildData) => {
    setSubmitting(true)
    try {
      const created = await register(buildRegisterBody(parentData, childData))
      toast(t('auth.register.toast'))
      setResult(created)
    } catch (err) {
      const view = registerErrorView(err)
      parentForm.setErrors(view.parentErrors)
      childForm.setErrors(view.childErrors)
      setFormError(view.message)
      setStep(view.step)
      focusFirstInvalid(formRef.current)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (step === PARENT_STEP) {
      const data = parentForm.validate(parentStepSchema)
      if (!data) return focusFirstInvalid(formRef.current)
      setParent(data)
      setStep(CHILD_STEP)
    } else if (step === CHILD_STEP) {
      const data = childForm.validate(childStepSchema)
      if (!data) return focusFirstInvalid(formRef.current)
      setChild(data)
      setStep(CONFIRM_STEP)
    } else if (parent && child) {
      void submitAccount(parent, child)
    }
  }

  return (
    <AuthCard
      eyebrow={t('auth.register.eyebrow')}
      title={t('auth.register.title')}
      intro={t('auth.register.intro')}
      size="wide"
      footer={
        <>
          {t('auth.register.haveAccount')}{' '}
          <AuthLink to={ROUTES.login}>{t('auth.register.login')}</AuthLink>
        </>
      }
    >
      <Stepper steps={STEPS} current={step} className="mb-8" />
      <FormAlert message={formError} />
      <form ref={formRef} noValidate onSubmit={handleSubmit}>
        {step === PARENT_STEP && <ParentStep form={parentForm} />}
        {step === CHILD_STEP && <ChildStep form={childForm} />}
        {step === CONFIRM_STEP && parent && child && (
          <ReviewStep
            parent={parent}
            child={child}
            onEditParent={() => goTo(PARENT_STEP)}
            onEditChild={() => goTo(CHILD_STEP)}
          />
        )}
        <div className="mt-8 flex flex-wrap justify-between gap-3">
          {step > PARENT_STEP ? (
            <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={isSubmitting}>
              {t('common.back')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={isSubmitting}>
            {step === CONFIRM_STEP ? t('auth.register.submit') : t('common.next')}
          </Button>
        </div>
      </form>
    </AuthCard>
  )
}
