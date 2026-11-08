import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Package } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './empty-state'
import { InlineAlert } from './inline-alert'
import { Progress } from './progress'
import { QuantityStepper } from './quantity-stepper'
import { Skeleton, SkeletonText } from './skeleton'
import { Spinner } from './spinner'

describe('InlineAlert', () => {
  it('uses status for info/attention and alert for danger', () => {
    render(
      <>
        <InlineAlert title="Info">a</InlineAlert>
        <InlineAlert variant="attention">b</InlineAlert>
        <InlineAlert
          variant="danger"
          title="Gagal"
          action={<button type="button">Coba lagi</button>}
        >
          c
        </InlineAlert>
      </>,
    )
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('Gagalc')
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders title, body, icon and action at the chosen heading level', () => {
    render(
      <EmptyState
        icon={Package}
        title="Belum ada pesanan"
        body="Isi"
        action={<a href="/x">Lihat</a>}
        headingLevel="h2"
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Belum ada pesanan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lihat' })).toBeInTheDocument()
  })

  it('works with defaults', () => {
    render(<EmptyState title="Kosong" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Kosong' })).toBeInTheDocument()
  })
})

describe('Skeleton & Spinner', () => {
  it('hides skeletons from assistive tech and pulses only motion-safe', () => {
    const { container } = render(
      <>
        <Skeleton className="h-8" />
        <SkeletonText lines={2} />
      </>,
    )
    const blocks = container.querySelectorAll('.motion-safe\\:animate-pulse')
    expect(blocks).toHaveLength(3)
    container
      .querySelectorAll('div')
      .forEach((el) => expect(el.closest('[aria-hidden="true"]')).not.toBeNull())
  })

  it('announces a spinner label', () => {
    render(<Spinner label="Memeriksa sesi…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Memeriksa sesi…')
  })
})

describe('Progress', () => {
  it('exposes value and grows to the percentage', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    render(<Progress value={3} max={4} label="Sensorial: Berlatih Mandiri (3/4)" tone="orange" />)
    const bar = screen.getByRole('progressbar', { name: 'Sensorial: Berlatih Mandiri (3/4)' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.style.width).toBe('0%')
    await act(async () => {
      vi.advanceTimersToNextFrame()
    })
    expect(fill.style.width).toBe('75%')
    expect(fill.className).toContain('bg-accent')
    vi.useRealTimers()
  })

  it('clamps and handles max 0', () => {
    render(<Progress value={5} max={0} label="kosong" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
  })
})

describe('QuantityStepper', () => {
  it('steps within bounds with Indonesian labels', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<QuantityStepper value={1} onChange={onChange} max={2} />)
    expect(screen.getByRole('group', { name: 'Jumlah' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kurangi jumlah' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Tambah jumlah' }))
    expect(onChange).toHaveBeenLastCalledWith(2)
    rerender(<QuantityStepper value={2} onChange={onChange} max={2} label="Jumlah kit" />)
    expect(screen.getByRole('button', { name: 'Tambah jumlah' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah' }))
    expect(onChange).toHaveBeenLastCalledWith(1)
  })
})
