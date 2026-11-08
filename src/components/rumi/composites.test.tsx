import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render'
import { ConfirmDialog } from './confirm-dialog'
import { Logo, LogoLink } from './logo'
import { Price } from './price'
import { ScreenPlaceholder } from './screen-placeholder'
import { Container, Eyebrow, PageHeader, Section, SectionHeading } from './section'
import {
  ClassStatusBadge,
  EnrollmentStatusBadge,
  OrderStatusBadge,
  SeatBadge,
  StockBadge,
} from './status-badge'

describe('Logo', () => {
  it('uses the vendored SVG with the brand alt and an aria-hidden wordmark', () => {
    render(<Logo />)
    const img = screen.getByRole('img', { name: 'RUMI — Rumah Main Islami' })
    expect(img).toHaveAttribute('src', '/brand/rumi-logo.svg')
    expect(screen.getByText('RUMI').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('links home, optionally without the wordmark', () => {
    renderWithRouter(<LogoLink withWordmark={false} />)
    expect(screen.getByRole('link', { name: 'RUMI — Rumah Main Islami' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.queryByText('RUMI')).toBeNull()
  })
})

describe('Price', () => {
  it('formats Rupiah', () => {
    render(<Price amount={1250000} />)
    expect(screen.getByText('Rp 1.250.000')).toBeInTheDocument()
  })
})

describe('status badges', () => {
  it('render PRD labels', () => {
    render(
      <>
        <OrderStatusBadge status="PENDING_WA" />
        <ClassStatusBadge status="DRAFT" />
        <ClassStatusBadge status="OPEN" isFull />
        <ClassStatusBadge status="CLOSED" isFull />
        <EnrollmentStatusBadge status="CONFIRMED" />
        <SeatBadge seatsLeft={2} isFull={false} />
        <StockBadge stock={0} />
      </>,
    )
    for (const label of [
      'Menunggu Konfirmasi',
      'Draf',
      'Penuh',
      'Ditutup',
      'Terkonfirmasi',
      'Sisa 2 kursi',
      'Stok habis',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})

describe('section helpers', () => {
  it('render eyebrow, headings and intro', () => {
    render(
      <>
        <PageHeader eyebrow="Pendekatan kami" title="Judul halaman" intro="Pengantar" />
        <Section tone="surface" aria-labelledby="s">
          <SectionHeading
            id="s"
            title="Bagian"
            align="center"
            intro="Isi"
            eyebrowTone="primary"
            eyebrow="Cara RUMI"
          />
        </Section>
        <Container>c</Container>
        <Eyebrow>e</Eyebrow>
      </>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Judul halaman' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Bagian' }).className).toContain('bg-surface')
    expect(screen.getByText('Cara RUMI').className).toContain('text-primary-strong')
    expect(screen.getByText('e').className).toContain('text-accent-strong')
  })

  it('renders the screen placeholder with one h1', () => {
    render(<ScreenPlaceholder title="Kit Edukasi" />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Halaman ini sedang disiapkan.')
  })
})

function ConfirmDemo({ onConfirm }: { onConfirm: () => Promise<void> | void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <p>{open ? 'terbuka' : 'tertutup'}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Batalkan pesanan?"
        body="Stok akan dikembalikan."
        confirmLabel="Ya, batalkan"
        tone="danger"
        onConfirm={onConfirm}
      />
    </>
  )
}

describe('ConfirmDialog', () => {
  it('confirms and closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<ConfirmDemo onConfirm={onConfirm} />)
    expect(screen.getByRole('dialog', { name: 'Batalkan pesanan?' })).toHaveAccessibleDescription(
      'Stok akan dikembalikan.',
    )
    const confirm = screen.getByRole('button', { name: 'Ya, batalkan' })
    expect(confirm.className).toContain('bg-danger')
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.getByText('tertutup')).toBeInTheDocument()
  })

  it('stays open when the action fails, and cancels', async () => {
    render(<ConfirmDemo onConfirm={() => Promise.reject(new Error('gagal'))} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ya, batalkan' }))
    expect(screen.getByText('terbuka')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(screen.getByText('tertutup')).toBeInTheDocument()
  })
})
