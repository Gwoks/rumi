import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeKit } from '@/test/factories'
import { KitCard, KitTile } from './kit-card'

describe('KitTile', () => {
  it('renders the image with the kit name as alt when image_url is set', () => {
    render(<KitTile kit={makeKit({ image_url: 'https://example.com/kit.jpg' })} />)
    expect(screen.getByRole('img', { name: 'Nampan Tangan Kecil' })).toHaveAttribute(
      'src',
      'https://example.com/kit.jpg',
    )
  })

  it('falls back to a tinted domain tile with a decorative icon', () => {
    const { container } = render(<KitTile kit={makeKit()} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.firstChild).toHaveClass('bg-primary-soft')
  })
})

describe('KitCard', () => {
  it('shows category, name, price, stock badge and promo tag; adds and opens details', async () => {
    const kit = makeKit()
    const onAdd = vi.fn()
    const onDetails = vi.fn()
    render(<KitCard kit={kit} onAdd={onAdd} onDetails={onDetails} />)
    expect(screen.getByText('Kehidupan Praktis')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Nampan Tangan Kecil' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Rp 185.000')).toBeInTheDocument()
    expect(screen.getByText('Stok tersedia')).toBeInTheDocument()
    expect(screen.getByText('Favorit')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Tambah Nampan Tangan Kecil ke keranjang' }),
    )
    expect(onAdd).toHaveBeenCalledWith(kit)
    await userEvent.click(screen.getByRole('button', { name: 'Lihat detail Nampan Tangan Kecil' }))
    expect(onDetails).toHaveBeenCalledWith(kit)
  })

  it('shows low stock as text', () => {
    render(<KitCard kit={makeKit({ stock: 4, badge_tag: null })} onAdd={vi.fn()} />)
    expect(screen.getByText('Sisa 4')).toBeInTheDocument()
    expect(screen.queryByText('Favorit')).toBeNull()
  })

  it('disables adding when out of stock', () => {
    render(<KitCard kit={makeKit({ stock: 0 })} onAdd={vi.fn()} headingLevel="h2" />)
    const button = screen.getByRole('button', { name: 'Stok habis' })
    expect(button).toBeDisabled()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nampan Tangan Kecil')
  })
})
