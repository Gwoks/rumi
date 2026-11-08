import { describe, expect, it } from 'vitest'
import {
  buildPayload,
  initialFormValues,
  isWideField,
  mapServerFieldErrors,
  parseBaseline,
  parseField,
  resolveOptions,
  validateFields,
  type FieldDef,
} from './field-defs'

const FIELDS: readonly FieldDef[] = [
  { name: 'name', label: 'Nama', type: 'text', required: true, minLength: 2, maxLength: 10 },
  { name: 'notes', label: 'Catatan', type: 'textarea', maxLength: 5 },
  { name: 'stock', label: 'Stok', type: 'number', required: true, min: 0, max: 100 },
  { name: 'price', label: 'Harga', type: 'money', required: true, min: 0, max: 1000000 },
  { name: 'date', label: 'Tanggal', type: 'date', required: true },
  { name: 'start', label: 'Mulai', type: 'time', required: true },
  {
    name: 'category',
    label: 'Kategori',
    type: 'select',
    required: true,
    options: [
      { value: 'MATH', label: 'Matematika' },
      { value: 'LANGUAGE', label: 'Bahasa' },
    ],
  },
  { name: 'active', label: 'Aktif', type: 'checkbox', defaultValue: true },
  { name: 'image', label: 'Gambar', type: 'url', maxLength: 500 },
  { name: 'body', label: 'Isi', type: 'json', required: true },
  { name: 'slug', label: 'Halaman', type: 'text', createOnly: true },
]

const field = (name: string): FieldDef => {
  const found = FIELDS.find((f) => f.name === name)
  if (!found) throw new Error(name)
  return found
}

describe('initialFormValues', () => {
  it('uses defaults for a new record', () => {
    const values = initialFormValues(FIELDS)
    expect(values.name).toBe('')
    expect(values.active).toBe(true)
  })

  it('stringifies a record for editing (numbers, null, JSON, booleans)', () => {
    const values = initialFormValues(FIELDS, {
      name: 'Kit',
      notes: null,
      stock: 3,
      body: { a: 1 },
      active: false,
    })
    expect(values).toMatchObject({ name: 'Kit', notes: '', stock: '3', active: false })
    expect(values.body).toBe('{\n  "a": 1\n}')
  })
})

describe('parseField', () => {
  const parse = (name: string, raw: string | boolean) => parseField(field(name), raw, {})

  it('trims text, enforces bounds and turns empty optional text into null', () => {
    expect(parse('name', '  Kit  ')).toEqual({ ok: true, value: 'Kit' })
    expect(parse('name', '')).toEqual({ ok: false, error: 'Wajib diisi.' })
    expect(parse('name', 'K')).toEqual({ ok: false, error: 'Minimal 2 karakter.' })
    expect(parse('name', 'Kit yang terlalu panjang')).toEqual({
      ok: false,
      error: 'Maksimal 10 karakter.',
    })
    expect(parse('notes', '   ')).toEqual({ ok: true, value: null })
  })

  it('parses integers and money (dots, spaces and an Rp prefix allowed)', () => {
    expect(parse('stock', '12')).toEqual({ ok: true, value: 12 })
    expect(parse('stock', '1.5')).toMatchObject({ ok: false, error: 'Masukkan bilangan bulat.' })
    expect(parse('stock', '-1')).toMatchObject({ error: 'Minimal 0.' })
    expect(parse('stock', '101')).toMatchObject({ error: 'Maksimal 100.' })
    expect(parse('price', 'Rp 150.000')).toEqual({ ok: true, value: 150000 })
    expect(parse('price', '12,5')).toMatchObject({ error: expect.stringContaining('Rupiah') })
    expect(parse('price', '2000000')).toMatchObject({ error: 'Maksimal Rp 1.000.000.' })
    expect(parse('price', '')).toMatchObject({ error: 'Wajib diisi.' })
  })

  it('checks real dates and HH:MM times', () => {
    expect(parse('date', '2026-11-14')).toEqual({ ok: true, value: '2026-11-14' })
    expect(parse('date', '2026-02-30')).toMatchObject({ ok: false })
    expect(parse('date', '')).toMatchObject({ error: 'Wajib diisi.' })
    expect(parse('start', '09:30')).toEqual({ ok: true, value: '09:30' })
    expect(parse('start', '25:00')).toMatchObject({ ok: false })
    expect(parse('start', '')).toMatchObject({ error: 'Wajib diisi.' })
  })

  it('accepts only listed select options', () => {
    expect(parse('category', 'MATH')).toEqual({ ok: true, value: 'MATH' })
    expect(parse('category', 'NOPE')).toMatchObject({ error: 'Pilih salah satu opsi.' })
    expect(parse('category', '')).toMatchObject({ error: 'Wajib diisi.' })
  })

  it('reads checkboxes as booleans', () => {
    expect(parse('active', true)).toEqual({ ok: true, value: true })
    expect(parse('active', false)).toEqual({ ok: true, value: false })
  })

  it('accepts https:// or same-origin paths for urls, never //host', () => {
    expect(parse('image', 'https://example.com/a.jpg')).toMatchObject({ ok: true })
    expect(parse('image', '/brand/a.jpg')).toMatchObject({ ok: true })
    expect(parse('image', '//evil.example/a.jpg')).toMatchObject({ ok: false })
    expect(parse('image', 'javascript:alert(1)')).toMatchObject({ ok: false })
    expect(parse('image', '')).toEqual({ ok: true, value: null })
  })

  it('parses JSON objects only', () => {
    expect(parse('body', '{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
    expect(parse('body', '{oops')).toMatchObject({ error: 'Format JSON tidak valid.' })
    expect(parse('body', '[1]')).toMatchObject({ error: 'Isi harus berupa objek JSON.' })
    expect(parse('body', '')).toMatchObject({ error: 'Wajib diisi.' })
    expect(parseField({ ...field('body'), required: false }, '', {})).toEqual({
      ok: true,
      value: null,
    })
  })
})

describe('validateFields', () => {
  const RANGE: readonly FieldDef[] = [
    { name: 'min', label: 'Min', type: 'number', required: true },
    {
      name: 'max',
      label: 'Max',
      type: 'number',
      required: true,
      validation: (value, values) =>
        typeof value === 'number' && typeof values.min === 'number' && value < values.min
          ? 'Terlalu kecil'
          : null,
    },
  ]

  it('returns parsed data when everything passes', () => {
    expect(validateFields(RANGE, { min: '3', max: '6' })).toEqual({
      success: true,
      data: { min: 3, max: 6 },
    })
  })

  it('collects type errors and cross-field rule errors', () => {
    expect(validateFields(RANGE, { min: '6', max: '3' })).toEqual({
      success: false,
      errors: { max: 'Terlalu kecil' },
    })
    expect(validateFields(RANGE, { min: 'x', max: '' })).toEqual({
      success: false,
      errors: { min: 'Masukkan bilangan bulat.', max: 'Wajib diisi.' },
    })
  })
})

describe('buildPayload', () => {
  const data = { name: 'Kit', stock: 3, slug: 'home', notes: null }

  it('sends every field on create', () => {
    const fields = FIELDS.filter((f) => f.name in data)
    expect(buildPayload(fields, data, 'create')).toEqual(data)
  })

  it('sends only changed, editable fields on edit', () => {
    const fields = FIELDS.filter((f) => f.name in data)
    const baseline = parseBaseline(fields, {
      name: 'Kit',
      stock: '1',
      slug: 'who-we-are',
      notes: '',
    })
    expect(buildPayload(fields, data, 'edit', baseline)).toEqual({ stock: 3 })
    expect(buildPayload(fields, { ...data, stock: 1 }, 'edit', baseline)).toEqual({})
  })
})

describe('mapServerFieldErrors', () => {
  it('maps exact and nested paths, and returns the rest as unmatched', () => {
    expect(
      mapServerFieldErrors(FIELDS, {
        name: 'Nama sudah dipakai.',
        'body.cards.0.title': 'Wajib diisi.',
        'body.intro': 'Terlalu panjang.',
        page: 'Tidak dikenal.',
      }),
    ).toEqual({
      errors: {
        name: 'Nama sudah dipakai.',
        body: 'cards.0.title: Wajib diisi. intro: Terlalu panjang.',
      },
      unmatched: ['Tidak dikenal.'],
    })
  })
})

describe('field helpers', () => {
  it('resolves static and dependent options', () => {
    expect(resolveOptions(field('category'), {})).toHaveLength(2)
    expect(resolveOptions(field('name'), {})).toEqual([])
    const dependent: FieldDef = {
      name: 'section',
      label: 'Bagian',
      type: 'select',
      options: (values) => [{ value: String(values.page), label: 'x' }],
    }
    expect(resolveOptions(dependent, { page: 'home' })).toEqual([{ value: 'home', label: 'x' }])
  })

  it('spans textareas, JSON editors and checkboxes across the form', () => {
    expect(isWideField(field('notes'))).toBe(true)
    expect(isWideField(field('body'))).toBe(true)
    expect(isWideField(field('active'))).toBe(true)
    expect(isWideField(field('name'))).toBe(false)
  })
})
