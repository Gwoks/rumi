/**
 * `/login` (PRD §5.8.3 #8): email + password with zod validation. On success
 * the user goes to `?next=` (same-origin paths only) or their role's home;
 * `?cart=open` reopens the cart drawer so a parent can finish checking out.
 * `invalid_credentials` and `rate_limited` show Indonesian form-level alerts.
 */
import { useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { login } from '@/api/auth-store'
import { isApiError } from '@/api/errors'
import { useAuth } from '@/api/use-auth'
import { Button } from '@/components/ui/button'
import { InlineNote } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { homeForRole, ROUTES, safeNextPath } from '@/lib/navigation'
import { focusFirstInvalid, pickFieldErrors, useForm } from '@/lib/use-form'
import { loginFormSchema } from '@/lib/validation'
import { openCart } from '@/stores/ui'
import { AuthCard, AuthLink, FormAlert } from './auth-card'

function loginErrorMessage(err: unknown): string {
  if (isApiError(err) && err.code === 'invalid_credentials') return t('auth.login.invalid')
  if (isApiError(err) && err.code === 'validation_error') return t('auth.formError')
  return apiErrorMessage(err)
}

export function LoginScreen() {
  const { user, status } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')
  const shouldReopenCart = params.get('cart') === 'open'
  const form = useForm({ email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  if (status === 'ready' && user) {
    return <Navigate to={safeNextPath(next, homeForRole(user.role))} replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const data = form.validate(loginFormSchema)
    if (!data) {
      focusFirstInvalid(formRef.current)
      return
    }
    setSubmitting(true)
    try {
      const signedIn = await login(data)
      if (shouldReopenCart && signedIn.role === 'PARENT') openCart()
    } catch (err) {
      form.setErrors(pickFieldErrors(apiFieldErrors(err)))
      setFormError(loginErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      eyebrow={t('auth.login.eyebrow')}
      title={t('auth.login.title')}
      intro={t('auth.login.intro')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <AuthLink to={ROUTES.register}>{t('auth.login.register')}</AuthLink>
        </>
      }
    >
      {shouldReopenCart && <InlineNote className="mb-5">{t('auth.login.cartNote')}</InlineNote>}
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
        <Field label={t('auth.field.password')} error={form.errors.password} required>
          {(control) => (
            <Input
              {...control}
              {...form.bind('password')}
              type="password"
              autoComplete="current-password"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <AuthLink to={ROUTES.forgotPassword}>{t('auth.login.forgot')}</AuthLink>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthCard>
  )
}
