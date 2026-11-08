/**
 * Register form model (PRD §5.8.3 #7): step schemas, the RegisterBody
 * builder, and the mapping of server errors back to the step that owns the
 * field (`email_taken` and `parent.*` → step 1, `child.*` → step 2).
 */
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import type { RegisterBody } from '@/api/schemas'
import { apiErrorMessage, apiFieldErrors } from '@/lib/api-errors'
import { t } from '@/lib/copy'
import { pickFieldErrors } from '@/lib/use-form'
import { childFormSchema, parentFormSchema, type FormErrors } from '@/lib/validation'

export const PARENT_STEP = 0
export const CHILD_STEP = 1
export const CONFIRM_STEP = 2

export type ParentValues = {
  full_name: string
  email: string
  phone_wa: string
  password: string
  password_confirm: string
}
export type ChildValues = { name: string; dob: string; notes: string }

export const parentStepSchema = parentFormSchema
  .extend({ password_confirm: z.string() })
  .refine((v) => v.password === v.password_confirm, {
    message: t('common.validation.passwordMismatch'),
    path: ['password_confirm'],
  })

export const childStepSchema = childFormSchema

export type ParentData = z.output<typeof parentStepSchema>
export type ChildData = z.output<typeof childStepSchema>

export function buildRegisterBody(parent: ParentData, child: ChildData): RegisterBody {
  return {
    parent: {
      full_name: parent.full_name,
      email: parent.email,
      phone_wa: parent.phone_wa,
      password: parent.password,
    },
    child: { name: child.name, dob: child.dob, notes: child.notes },
  }
}

export interface RegisterErrorView {
  step: number
  message: string
  parentErrors: FormErrors
  childErrors: FormErrors
}

/** Route a failed register back to the step that can fix it. */
export function registerErrorView(err: unknown): RegisterErrorView {
  if (isApiError(err) && err.code === 'email_taken') {
    return {
      step: PARENT_STEP,
      message: err.message,
      parentErrors: { email: err.message },
      childErrors: {},
    }
  }
  const fields = apiFieldErrors(err)
  const parentErrors = pickFieldErrors(fields, 'parent')
  const childErrors = pickFieldErrors(fields, 'child')
  const step =
    Object.keys(parentErrors).length > 0
      ? PARENT_STEP
      : Object.keys(childErrors).length > 0
        ? CHILD_STEP
        : CONFIRM_STEP
  const message = step === CONFIRM_STEP ? apiErrorMessage(err) : t('auth.formError')
  return { step, message, parentErrors, childErrors }
}
