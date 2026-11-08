import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Checkbox, Field, Input, Label, SearchInput, Select, Textarea } from './input'

describe('Field', () => {
  it('wires label, hint and error to the control', () => {
    render(
      <Field
        label="Email"
        hint="Kami tidak akan membagikan email Anda."
        error="Email tidak valid."
        required
      >
        {(control) => <Input {...control} type="email" />}
      </Field>,
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription(
      'Kami tidak akan membagikan email Anda. Email tidak valid.',
    )
    expect(screen.getByText('(wajib)', { exact: false })).toHaveClass('sr-only')
  })

  it('omits aria-invalid and describedby when clean', () => {
    render(
      <Field label="Nama" optional>
        {(control) => <Input {...control} />}
      </Field>,
    )
    const input = screen.getByLabelText(/Nama/)
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(screen.getByText('(opsional)')).toBeInTheDocument()
  })

  it('respects a fixed id', () => {
    render(
      <Field label="Kota" id="kota">
        {(control) => <Input {...control} />}
      </Field>,
    )
    expect(screen.getByLabelText('Kota')).toHaveAttribute('id', 'kota')
  })
})

describe('controls', () => {
  it('marks invalid inputs, textareas and selects', () => {
    render(
      <>
        <Input aria-label="a" invalid />
        <Textarea aria-label="b" invalid />
        <Select aria-label="c" invalid>
          <option>x</option>
        </Select>
      </>,
    )
    for (const name of ['a', 'b', 'c'])
      expect(screen.getByLabelText(name)).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders a search input with type=search', async () => {
    render(<SearchInput aria-label="Cari" />)
    const input = screen.getByRole('searchbox', { name: 'Cari' })
    await userEvent.type(input, 'Amina')
    expect(input).toHaveValue('Amina')
  })

  it('toggles a checkbox through its label row', async () => {
    render(<Checkbox label="Pengingat" description="Sehari sebelumnya." />)
    const box = screen.getByRole('checkbox', { name: /Pengingat/ })
    await userEvent.click(screen.getByText('Pengingat'))
    expect(box).toBeChecked()
  })

  it('renders a plain label', () => {
    render(<Label htmlFor="x">Label</Label>)
    expect(screen.getByText('Label').tagName).toBe('LABEL')
  })
})
