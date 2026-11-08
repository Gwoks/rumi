import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authStore, setAuthUser } from '@/api/auth-store'
import { api } from '@/api/client'
import { addClass, addKit, cartStore, clearCart, setChild } from '@/stores/cart'
import { closeCart, openCart, uiStore } from '@/stores/ui'
import { makeAdmin, makeChild, makeClass, makeKit, makeUser } from '@/test/factories'
import { renderWithRouter } from '@/test/render'
import { AppRoot } from './app-root'
import { checkoutLoginPath } from './cart-drawer'

function renderDrawer(route = '/weekend-classes?age=4') {
  renderWithRouter(<AppRoot />, { route })
  act(() => openCart())
  return screen.getByRole('dialog', { name: 'Keranjang' })
}

beforeEach(() => {
  clearCart()
  closeCart()
  setAuthUser(null)
})

afterEach(() => setAuthUser(null))

describe('checkoutLoginPath', () => {
  it('sends the current path as next and asks to reopen the cart', () => {
    expect(checkoutLoginPath('/weekend-classes?age=4')).toBe(
      '/login?next=%2Fweekend-classes%3Fage%3D4&cart=open',
    )
  })

  it('never loops back to an auth page', () => {
    expect(checkoutLoginPath('/login?next=%2F')).toBe('/login?next=%2F&cart=open')
    expect(checkoutLoginPath('/register')).toBe('/login?next=%2F&cart=open')
  })
})

describe('CartDrawer', () => {
  it('shows the empty state with links that close the drawer', async () => {
    const drawer = renderDrawer()
    expect(
      within(drawer).getByRole('heading', { name: 'Keranjang masih kosong' }),
    ).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('link', { name: 'Lihat kit' }))
    expect(uiStore.getSnapshot().cartOpen).toBe(false)
  })

  it('lists kit and class lines with Rupiah totals, steps quantity and removes lines', async () => {
    addKit(makeKit({ stock: 3 }), 2)
    addClass(makeClass())
    const drawer = renderDrawer()
    expect(within(drawer).getByText('3 item di keranjang')).toBeInTheDocument()
    expect(within(drawer).getByText('Rp 185.000 per kit')).toBeInTheDocument()
    expect(within(drawer).getByText('Rp 370.000')).toBeInTheDocument()
    expect(within(drawer).getByText('Anak dipilih saat checkout')).toBeInTheDocument()
    expect(
      within(drawer).getByText('Sabtu, 14 November 2026 · 09:30–11:30 WIB'),
    ).toBeInTheDocument()
    expect(within(drawer).getByText('Rp 570.000')).toBeInTheDocument()

    const stepper = within(drawer).getByRole('group', { name: 'Jumlah Nampan Tangan Kecil' })
    await userEvent.click(within(stepper).getByRole('button', { name: 'Tambah jumlah' }))
    expect(within(stepper).getByText('3')).toBeInTheDocument()
    expect(within(stepper).getByRole('button', { name: 'Tambah jumlah' })).toBeDisabled()

    await userEvent.click(
      within(drawer).getByRole('button', { name: 'Hapus Bulan & Gerak dari keranjang' }),
    )
    expect(cartStore.getSnapshot().items).toHaveLength(1)
  })

  it('sends an anonymous visitor to login with next and cart=open', async () => {
    addKit(makeKit())
    const drawer = renderDrawer()
    const link = within(drawer).getByRole('link', { name: 'Lanjut ke Pembayaran' })
    expect(link).toHaveAttribute('href', '/login?next=%2Fweekend-classes%3Fage%3D4&cart=open')
    expect(within(drawer).getByText(/Anda akan diminta masuk/)).toBeInTheDocument()
    await userEvent.click(link)
    expect(uiStore.getSnapshot().cartOpen).toBe(false)
  })

  it('disables checkout while the session is being checked', () => {
    authStore.setState({ user: null, status: 'loading', error: null })
    addKit(makeKit())
    const drawer = renderDrawer()
    expect(within(drawer).getByRole('button', { name: /Lanjut ke Pembayaran/ })).toBeDisabled()
  })

  it('blocks checkout for an admin', () => {
    setAuthUser(makeAdmin())
    addKit(makeKit())
    const drawer = renderDrawer()
    expect(
      within(drawer).getByText('Checkout hanya tersedia untuk akun orang tua.'),
    ).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Lanjut ke Pembayaran' })).toBeDisabled()
  })

  it('opens the checkout dialog for a parent and shows picked children', async () => {
    setAuthUser(makeUser())
    vi.spyOn(api, 'listChildren').mockResolvedValue([makeChild()])
    addClass(makeClass())
    const lineId = cartStore.getSnapshot().items[0].line_id
    setChild(lineId, 1)
    const drawer = renderDrawer()
    expect(await within(drawer).findByText('Untuk Amina')).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Lanjut ke Pembayaran' }))
    expect(await screen.findByRole('dialog', { name: 'Selesaikan pesanan' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keranjang' })).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Ubah keranjang' }))
    expect(await screen.findByRole('dialog', { name: 'Keranjang' })).toBeInTheDocument()
  })
})
