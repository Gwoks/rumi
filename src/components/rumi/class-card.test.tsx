import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeClass } from '@/test/factories'
import {
  ClassAvailabilityBadge,
  ClassCard,
  classAvailability,
  DateTile,
  unavailableLabel,
} from './class-card'

describe('classAvailability', () => {
  it('is bookable only while OPEN, upcoming and not full', () => {
    expect(classAvailability(makeClass())).toBe('bookable')
    expect(classAvailability(makeClass({ seats_booked: 12 }))).toBe('full')
    expect(classAvailability(makeClass({ status: 'CLOSED' }))).toBe('closed')
    expect(classAvailability(makeClass({ is_upcoming: false }))).toBe('closed')
  })

  it('labels the unavailable states', () => {
    expect(unavailableLabel('full')).toBe('Kelas penuh')
    expect(unavailableLabel('closed')).toBe('Pendaftaran ditutup')
  })
})

describe('DateTile', () => {
  it('exposes the full Indonesian date as its accessible name', () => {
    render(<DateTile date="2026-11-14" />)
    const tile = screen.getByRole('img', { name: 'Sabtu, 14 November 2026' })
    expect(tile).toHaveTextContent('14')
    expect(tile).toHaveTextContent('NOV')
  })
})

describe('ClassAvailabilityBadge', () => {
  it('shows seats, few seats, full and closed as text', () => {
    const { rerender } = render(<ClassAvailabilityBadge cls={makeClass()} />)
    expect(screen.getByText('12 kursi tersedia')).toBeInTheDocument()
    rerender(<ClassAvailabilityBadge cls={makeClass({ seats_booked: 10 })} />)
    expect(screen.getByText('Sisa 2 kursi')).toBeInTheDocument()
    rerender(<ClassAvailabilityBadge cls={makeClass({ seats_booked: 12 })} />)
    expect(screen.getByText('Penuh')).toBeInTheDocument()
    rerender(<ClassAvailabilityBadge cls={makeClass({ status: 'CANCELLED' })} />)
    expect(screen.getByText('Pendaftaran ditutup')).toBeInTheDocument()
  })
})

describe('ClassCard', () => {
  it('renders the date tile, meta rows, Rupiah fee and books a seat', async () => {
    const cls = makeClass()
    const onBook = vi.fn()
    const onDetails = vi.fn()
    render(<ClassCard cls={cls} onBook={onBook} onDetails={onDetails} />)
    expect(screen.getByRole('article')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /Bulan & Gerak/ })).toBeInTheDocument()
    expect(screen.getByText('Rumah Teduh, Kemang (Jakarta Selatan)')).toBeInTheDocument()
    expect(screen.getByText('09:30–11:30 WIB')).toBeInTheDocument()
    expect(screen.getByText('Usia 3–6 tahun')).toBeInTheDocument()
    expect(screen.getByText('Rp 200.000')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Pesan kursi untuk Bulan & Gerak' }))
    expect(onBook).toHaveBeenCalledWith(cls)
    await userEvent.click(screen.getByRole('button', { name: 'Lihat detail Bulan & Gerak' }))
    expect(onDetails).toHaveBeenCalledWith(cls)
  })

  it('disables booking when the class is full', () => {
    render(<ClassCard cls={makeClass({ seats_booked: 12 })} onBook={vi.fn()} headingLevel="h2" />)
    expect(screen.getByRole('button', { name: 'Kelas penuh' })).toBeDisabled()
    expect(screen.getByRole('heading', { level: 2, name: 'Bulan & Gerak' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lihat detail/ })).toBeNull()
  })
})
