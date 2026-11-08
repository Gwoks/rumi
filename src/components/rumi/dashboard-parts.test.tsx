import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Users } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { makeClassOrderItem, makeKitOrderItem } from '@/test/factories'
import { LoadError, LoadingBlock } from './load-state'
import { OrderItemsList } from './order-items'
import { StatCard } from './stat-card'

describe('StatCard', () => {
  it('shows label, value, a decorative icon chip and the footnote', () => {
    const { container } = render(
      <StatCard label="Siswa terdaftar" value="12" icon={Users} tone="orange" footnote="Real" />,
    )
    const group = screen.getByRole('group', { name: 'Siswa terdaftar' })
    expect(group).toHaveTextContent('12')
    expect(screen.getByText('Real')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-accent-soft')
  })

  it('omits the footnote when absent', () => {
    const { container } = render(<StatCard label="Pesanan" value="0" icon={Users} />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })
})

describe('LoadingBlock / LoadError', () => {
  it('marks the region busy and names it for screen readers', () => {
    const { container } = render(<LoadingBlock label="Memuat pesanan…" rows={2} />)
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Memuat pesanan…')
  })

  it('shows the server message and retries', async () => {
    const onRetry = vi.fn()
    render(
      <LoadError
        title="Daftar pesanan belum bisa dimuat."
        error={new ApiError('unavailable', 'Layanan sedang sibuk.', 503)}
        onRetry={onRetry}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Daftar pesanan belum bisa dimuat.')
    expect(alert).toHaveTextContent('Layanan sedang sibuk.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('works without a retry and maps unknown errors to generic copy', () => {
    render(<LoadError title="Gagal" error={new Error('x')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('OrderItemsList', () => {
  it('renders kit and class lines with meta, enrollment status and line totals', () => {
    render(
      <OrderItemsList
        label="Isi pesanan RUMI-2026-0001"
        items={[makeClassOrderItem({ id: 1 }), makeKitOrderItem({ id: 2 })]}
      />,
    )
    const list = screen.getByRole('list', { name: 'Isi pesanan RUMI-2026-0001' })
    const [cls, kit] = within(list).getAllByRole('listitem')
    expect(cls).toHaveTextContent('Kelas Bulan & Gerak (Amina)')
    expect(cls).toHaveTextContent(
      'Sabtu, 14 November 2026 · 09:30–11:30 WIB · Rumah Teduh, Kemang (Jakarta Selatan)',
    )
    expect(cls).toHaveTextContent('Dipesan')
    expect(cls).toHaveTextContent('Rp 200.000')
    expect(kit).toHaveTextContent('Kit Nampan Tangan Kecil ×2')
    expect(kit).toHaveTextContent('Rp 370.000')
  })
})
