import { describe, expect, it } from 'vitest'
import {
  charLength,
  childEditFormSchema,
  childFormSchema,
  deliveryFormSchema,
  forgotPasswordFormSchema,
  loginFormSchema,
  normalizePhoneWa,
  optionalText,
  parentFormSchema,
  requiredText,
  resetPasswordFormSchema,
  validateForm,
} from './validation'
import { todayWib } from './format'

describe('normalizePhoneWa (PRD §5.4.6)', () => {
  it.each([
    ['0812-3456-7890', '6281234567890'],
    ['+62 812 3456 7890', '6281234567890'],
    ['812345678', '62812345678'],
    ['(0812) 3456.7890', '6281234567890'],
    ['6281211112222', '6281211112222'],
  ])('normalizes %s → %s', (raw, normalized) => {
    expect(normalizePhoneWa(raw)).toBe(normalized)
  })

  it.each(['', 'abc', '+1 555 0100', '0812', '6208123456789', '62812345678901234', '7812345678'])(
    'rejects %s',
    (raw) => {
      expect(normalizePhoneWa(raw)).toBeNull()
    },
  )
})

describe('text fields', () => {
  it('counts Unicode scalar values', () => {
    expect(charLength('أدب')).toBe(3)
    expect(charLength('👍🏽')).toBe(2)
  })

  it('trims and bounds required text', () => {
    const schema = requiredText(2, 5)
    expect(schema.safeParse('  ab  ').data).toBe('ab')
    expect(schema.safeParse('   ').error?.issues[0].message).toBe('Wajib diisi.')
    expect(schema.safeParse('a').error?.issues[0].message).toBe('Minimal 2 karakter.')
    expect(schema.safeParse('abcdef').error?.issues[0].message).toBe('Maksimal 5 karakter.')
  })

  it('turns empty optional text into null', () => {
    expect(optionalText(3).parse('  ')).toBeNull()
    expect(optionalText(3).parse(' ab ')).toBe('ab')
    expect(optionalText(3).safeParse('abcd').success).toBe(false)
  })
})

describe('form schemas', () => {
  it('validates login', () => {
    expect(validateForm(loginFormSchema, { email: ' Nadia@Example.com ', password: 'x' })).toEqual({
      success: true,
      data: { email: 'nadia@example.com', password: 'x' },
    })
    expect(validateForm(loginFormSchema, { email: 'nope', password: '' })).toEqual({
      success: false,
      errors: { email: 'Masukkan alamat email yang valid.', password: 'Wajib diisi.' },
    })
  })

  it('validates the parent step and normalizes the phone', () => {
    const result = validateForm(parentFormSchema, {
      full_name: 'Nadia Rahman',
      email: 'nadia@example.com',
      phone_wa: '0812-1111-2222',
      password: 'rahasia123',
    })
    expect(result).toEqual({
      success: true,
      data: {
        full_name: 'Nadia Rahman',
        email: 'nadia@example.com',
        phone_wa: '6281211112222',
        password: 'rahasia123',
      },
    })
    const bad = validateForm(parentFormSchema, {
      full_name: 'N',
      email: '',
      phone_wa: '123',
      password: 'short',
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(Object.keys(bad.errors).sort()).toEqual(['email', 'full_name', 'password', 'phone_wa'])
      expect(bad.errors.password).toBe('Kata sandi minimal 8 karakter.')
    }
  })

  it('validates the child step (dob ≤ today WIB, age ≤ 12)', () => {
    expect(childFormSchema.safeParse({ name: 'Amina', dob: '2020-04-15', notes: '' }).data).toEqual(
      {
        name: 'Amina',
        dob: '2020-04-15',
        notes: null,
      },
    )
    const future = childFormSchema.safeParse({ name: 'A', dob: '2999-01-01', notes: '' })
    expect(future.error?.issues[0].message).toBe('Tanggal lahir tidak boleh di masa depan.')
    const old = childFormSchema.safeParse({ name: 'A', dob: '2000-01-01', notes: '' })
    expect(old.error?.issues[0].message).toBe('Usia anak maksimal 12 tahun.')
    const invalid = childFormSchema.safeParse({ name: 'A', dob: '2020-02-30', notes: '' })
    expect(invalid.error?.issues[0].message).toBe('Masukkan tanggal yang valid.')
    expect(childFormSchema.safeParse({ name: 'A', dob: todayWib(), notes: '' }).success).toBe(true)
  })

  it('does not re-check the age rule for an unchanged dob when editing', () => {
    const edit = childEditFormSchema('2010-01-01')
    expect(edit.safeParse({ name: 'Kakak', dob: '2010-01-01', notes: '' }).success).toBe(true)
    const older = edit.safeParse({ name: 'Kakak', dob: '2000-01-01', notes: '' })
    expect(older.error?.issues[0].message).toBe('Usia anak maksimal 12 tahun.')
    const future = edit.safeParse({ name: 'Kakak', dob: '2999-01-01', notes: '' })
    expect(future.error?.issues[0].message).toBe('Tanggal lahir tidak boleh di masa depan.')
    expect(edit.safeParse({ name: 'Kakak', dob: '2020-04-15', notes: '' }).success).toBe(true)
    expect(edit.safeParse({ name: '', dob: '2010-01-01', notes: '' }).success).toBe(false)
  })

  it('requires the delivery address only with a kit', () => {
    const base = { name: 'Nadia', phone_wa: '081211112222', notes: '' }
    expect(deliveryFormSchema(true).safeParse({ ...base, address: ' ' }).success).toBe(false)
    expect(deliveryFormSchema(false).parse({ ...base, address: '' })).toEqual({
      name: 'Nadia',
      phone_wa: '6281211112222',
      address: null,
      notes: null,
    })
  })

  it('checks forgot + reset password', () => {
    expect(forgotPasswordFormSchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
    const mismatch = validateForm(resetPasswordFormSchema, {
      password: 'rahasia123',
      password_confirm: 'rahasia124',
    })
    expect(mismatch).toEqual({
      success: false,
      errors: { password_confirm: 'Konfirmasi kata sandi tidak sama.' },
    })
    expect(
      resetPasswordFormSchema.safeParse({
        password: 'x'.repeat(129),
        password_confirm: 'x'.repeat(129),
      }).success,
    ).toBe(false)
  })
})
