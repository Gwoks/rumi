/**
 * `/forgot-password` (PRD §5.8.3 #11): the server answers 200 whether or not
 * the email exists, so the UI always shows the same neutral "check your
 * email" message — it never reveals which addresses have an account.
 */
import { MailCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'
import { focusFirstInvalid, pickFieldErrors, useForm } from '@/lib/use-form'
import { forgotPasswordFormSchema } from '@/lib/validation'
import { AuthCard, AuthLink, FormAlert } from './auth-card'

export function ForgotPasswordScreen() {
  const form = useForm({ email: '' })
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const data = form.validate(forgotPasswordFormSchema)
    if (!data) {
      focusFirstInvalid(formRef.current)
      return
    }
    setSubmitting(true)
    try {
      await api.forgotPassword(data)
      setSentTo(data.email)
    } catch (err) {
      const fields = pickFieldErrors(apiFieldErrors(err))
      form.setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const footer = <AuthLink to={ROUTES.login}>{t('auth.forgot.back')}</AuthLink>

  if (sentTo) {
    return (
      <AuthCard title={t('auth.forgot.title')} footer={footer}>
        <div role="status" className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary-strong"
          >
            <MailCheck size={26} />
          </span>
          <h2 className="mt-5 text-h3 text-ink">{t('auth.forgot.sent.title')}</h2>
          <p className="mt-2 text-body-sm text-ink-secondary">
            {t('auth.forgot.sent.body', { email: sentTo })}
          </p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('auth.forgot.title')} intro={t('auth.forgot.intro')} footer={footer}>
      <FormAlert message={formError} />
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
        <Field label={t('auth.field.email')} error={form.errors.email} required>
          {(control) => (
            <Input
              {...control}
              {...form.bind('email')}
              type="email"
              autoComplete="email"
              placeholder={t('auth.field.emailPlaceholder')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {t('auth.forgot.submit')}
        </Button>
      </form>
    </AuthCard>
  )
}
