import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { CardGridSkeleton, LoadError } from './async-states'

describe('LoadError', () => {
  it('shows the title, the API message and a retry action', async () => {
    const onRetry = vi.fn()
    render(
      <LoadError
        title="Jadwal kelas gagal dimuat."
        error={new ApiError('network_error', 'x', 0)}
        onRetry={onRetry}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Jadwal kelas gagal dimuat.')
    expect(alert).toHaveTextContent('Tidak dapat terhubung ke server')
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('CardGridSkeleton', () => {
  it('renders hidden placeholder cards', () => {
    const { container } = render(<CardGridSkeleton count={3} className="md:grid-cols-3" />)
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveAttribute('aria-hidden', 'true')
    expect(grid).toHaveClass('md:grid-cols-3')
    expect(grid.children).toHaveLength(3)
  })
})
