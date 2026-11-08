import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { pageCount, Pagination } from './pagination'

describe('Pagination', () => {
  it('counts pages', () => {
    expect(pageCount(0, 20)).toBe(1)
    expect(pageCount(41, 20)).toBe(3)
    expect(pageCount(5, 0)).toBe(5)
  })

  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination page={1} perPage={20} total={3} onPageChange={() => {}} label="daftar siswa" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('moves between pages and disables the ends', async () => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <Pagination
        page={1}
        perPage={10}
        total={25}
        onPageChange={onPageChange}
        label="daftar siswa"
      />,
    )
    expect(screen.getByRole('navigation', { name: 'Halaman daftar siswa' })).toBeInTheDocument()
    expect(screen.getByText('Halaman 1 dari 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Berikutnya' }))
    expect(onPageChange).toHaveBeenCalledWith(2)

    rerender(
      <Pagination
        page={3}
        perPage={10}
        total={25}
        onPageChange={onPageChange}
        label="daftar siswa"
      />,
    )
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Sebelumnya' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
  })
})
