/**
 * `/reset-password?token=` (PRD §5.8.3 #12): a new password + confirmation.
 * The server revokes every session on success and does not sign the user in,
 * so the local auth state is cleared and the user is pointed to /login. An
 * `invalid_token` (unknown, expired or used) offers a fresh reset link.
 */
import { CheckCircle2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clearAuth } from '@/api/auth-store'
import { api } from '@/api/client'
import { isApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/ui/inline-alert'
import { Field, Input } from '@/components/ui/input'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'
import { focusFirstInvalid, pickFieldErrors, useForm } from '@/lib/use-form'
import { resetPasswordFormSchema } from '@/lib/validation'
import { AuthCard, FormAlert } from './auth-card'

const MAX_TOKEN_LENGTH = 200

type Outcome = 'form' | 'done' | 'invalid'

function InvalidToken() {
  return (
    <InlineAlert
      variant="danger"
      title={t('auth.reset.invalid.title')}
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to={ROUTES.forgotPassword}>{t('auth.reset.invalid.request')}</Link>
        </Button>
      }
    >
      {t('auth.reset.invalid.body')}
    </InlineAlert>
  )
}

function ResetDone() {
  return (
    <div role="status" className="text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary-strong"
      >
        <CheckCircle2 size={26} />
      </span>
      <h2 className="mt-5 text-h3 text-ink">{t('auth.reset.success.title')}</h2>
      <p className="mt-2 text-body-sm text-ink-secondary">{t('auth.reset.success.body')}</p>
      <Button asChild size="lg" className="mt-6 w-full">
        <Link to={ROUTES.login}>{t('auth.reset.success.login')}</Link>
      </Button>
    </div>
  )
}

export function ResetPasswordScreen() {
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() ?? ''
  const isTokenUsable = token.length > 0 && token.length <= MAX_TOKEN_LENGTH
  const form = useForm({ password: '', password_confirm: '' })
  const [outcome, setOutcome] = useState<Outcome>(isTokenUsable ? 'form' : 'invalid')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const data = form.validate(resetPasswordFormSchema)
    if (!data) {
      focusFirstInvalid(formRef.current)
      return
    }
    setSubmitting(true)
    try {
      await api.resetPassword({ token, password: data.password })
      clearAuth()
      setOutcome('done')
    } catch (err) {
      if (isApiError(err) && err.code === 'invalid_token') {
        setOutcome('invalid')
      } else {
        const fields = pickFieldErrors(apiFieldErrors(err))
        form.setErrors(fields)
        if (Object.keys(fields).length === 0) setFormError(apiErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title={t('auth.reset.title')}
      intro={outcome === 'form' ? t('auth.reset.intro') : undefined}
    >
      {outcome === 'invalid' && <InvalidToken />}
      {outcome === 'done' && <ResetDone />}
      {outcome === 'form' && (
        <>
          <FormAlert message={formError} />
          <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
            <Field
              label={t('auth.reset.password')}
              hint={t('auth.field.passwordHint')}
              error={form.errors.password}
              required
            >
              {(control) => (
                <Input
                  {...control}
                  {...form.bind('password')}
                  type="password"
                  autoComplete="new-password"
                />
              )}
            </Field>
            <Field
              label={t('auth.field.passwordConfirm')}
              error={form.errors.password_confirm}
              required
            >
              {(control) => (
                <Input
                  {...control}
                  {...form.bind('password_confirm')}
                  type="password"
                  autoComplete="new-password"
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {t('auth.reset.submit')}
            </Button>
          </form>
        </>
      )}
    </AuthCard>
  )
}
