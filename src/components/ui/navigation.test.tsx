import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Segmented } from './segmented'
import { Stepper } from './stepper'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowAction,
} from './table'

function SegmentedDemo() {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a')
  return (
    <Segmented
      aria-label="Rentang"
      value={value}
      onChange={setValue}
      options={[
        { value: 'a', label: 'Minggu' },
        { value: 'b', label: 'Bulan' },
        { value: 'c', label: 'Semua' },
      ]}
    />
  )
}

describe('Segmented', () => {
  it('is a radiogroup with click and arrow-key selection', async () => {
    render(<SegmentedDemo />)
    expect(screen.getByRole('radiogroup', { name: 'Rentang' })).toBeInTheDocument()
    const first = screen.getByRole('radio', { name: 'Minggu' })
    expect(first).toHaveAttribute('aria-checked', 'true')
    expect(first).toHaveAttribute('tabindex', '0')
    await userEvent.click(screen.getByRole('radio', { name: 'Bulan' }))
    expect(screen.getByRole('radio', { name: 'Bulan' })).toHaveAttribute('data-state', 'on')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Semua' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Minggu' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Semua' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('{ArrowUp}')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('a')
    expect(screen.getByRole('radio', { name: 'Semua' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Stepper', () => {
  it('is an ordered list with aria-current on the current step', () => {
    render(<Stepper steps={['Ringkasan', 'Detail', 'Konfirmasi']} current={1} />)
    const list = screen.getByRole('list', { name: 'Langkah' })
    expect(list.tagName).toBe('OL')
    expect(screen.getByText('Detail').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('(selesai)', { exact: false })).toHaveClass('sr-only')
  })
})

describe('Table', () => {
  it('renders a captioned table with column headers and row actions', () => {
    render(
      <Table caption="Pesanan" hideCaption={false}>
        <TableHead>
          <tr>
            <TableHeaderCell>Kode</TableHeaderCell>
            <TableHeaderCell>Aksi</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>RUMI-2026-0001</TableCell>
            <TableCell>
              <TableRowAction>Lihat</TableRowAction>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(screen.getByRole('table', { name: 'Pesanan' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Kode' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('button', { name: 'Lihat' })).toHaveAttribute('type', 'button')
  })
})
