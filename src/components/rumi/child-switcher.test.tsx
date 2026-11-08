import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChildSwitcher } from './child-switcher'

const CHILDREN = [
  { id: 1, name: 'Amina', age_years: 6 },
  { id: 7, name: 'Yusuf Karim', age_years: 4 },
]

describe('ChildSwitcher', () => {
  it('lists every child with age and reflects the selected one', () => {
    render(<ChildSwitcher items={CHILDREN} value={7} onChange={() => {}} />)
    const select = screen.getByRole('combobox', { name: 'Pilih anak' })
    expect(select).toHaveValue('7')
    expect(screen.getByRole('option', { name: 'Amina (6 tahun)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Yusuf Karim (4 tahun)' })).toBeInTheDocument()
    expect(screen.getByText('YK')).toHaveAttribute('aria-hidden', 'true')
  })

  it('falls back to the first child when the value is unknown', () => {
    render(<ChildSwitcher items={CHILDREN} value={99} onChange={() => {}} />)
    expect(screen.getByRole('combobox', { name: 'Pilih anak' })).toHaveValue('1')
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('reports the chosen child id as a number', async () => {
    const onChange = vi.fn()
    render(<ChildSwitcher items={CHILDREN} value={1} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pilih anak' }), '7')
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('is disabled without children', () => {
    render(<ChildSwitcher items={[]} value={null} onChange={() => {}} />)
    expect(screen.getByRole('combobox', { name: 'Pilih anak' })).toBeDisabled()
  })
})
