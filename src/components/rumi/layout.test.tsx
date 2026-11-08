import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { authStore } from '@/api/auth-store'
import { makeAdmin, makeKit, makeUser } from '@/test/factories'
import { renderWithRouter } from '@/test/render'
import { addKit, clearCart } from '@/stores/cart'
import { closeCart, uiStore } from '@/stores/ui'
import { PublicLayout } from './public-layout'

beforeEach(() => {
  clearCart()
  closeCart()
  authStore.setState({ user: null, status: 'ready', error: null })
})

describe('PublicLayout', () => {
  it('renders skip link, landmarks, nav and footer', () => {
    renderWithRouter(<PublicLayout>konten</PublicLayout>, { route: '/weekend-classes' })
    const skip = screen.getByRole('link', { name: 'Lewati ke konten utama' })
    expect(skip).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getByRole('main')).toHaveTextContent('konten')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Kunjungi RUMI')
    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' })
    expect(within(nav).getByRole('link', { name: 'Kelas Akhir Pekan' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Beranda' })).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('img', { name: 'RUMI — Rumah Main Islami' }).length).toBeGreaterThan(
      0,
    )
  })

  it('shows "Masuk" to visitors and the role dashboard to signed-in users', () => {
    const { unmount } = renderWithRouter(<PublicLayout />)
    expect(screen.getAllByRole('link', { name: 'Masuk' })[0]).toHaveAttribute('href', '/login')
    unmount()

    act(() => authStore.setState({ user: makeUser(), status: 'ready', error: null }))
    const parent = renderWithRouter(<PublicLayout />)
    expect(screen.getAllByRole('link', { name: 'Dasbor' })[0]).toHaveAttribute(
      'href',
      '/parent/dashboard',
    )
    parent.unmount()

    act(() => authStore.setState({ user: makeAdmin(), status: 'ready', error: null }))
    renderWithRouter(<PublicLayout />)
    expect(screen.getAllByRole('link', { name: 'Dasbor Admin' })[0]).toHaveAttribute(
      'href',
      '/admin/dashboard',
    )
  })

  it('toggles the mobile menu and closes it on navigation', async () => {
    renderWithRouter(<PublicLayout />)
    const toggle = screen.getByRole('button', { name: 'Buka menu navigasi' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Tutup menu navigasi' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const mobile = screen.getByRole('navigation', { name: 'Navigasi seluler' })
    await userEvent.click(within(mobile).getByRole('link', { name: 'Kit Edukasi' }))
    expect(screen.getByRole('button', { name: 'Buka menu navigasi' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('opens the cart drawer from the header with a live count', async () => {
    addKit(makeKit(), 2)
    renderWithRouter(<PublicLayout />)
    const button = screen.getByRole('button', { name: 'Lihat keranjang, 2 item' })
    expect(screen.getByText('Keranjang berisi 2 item')).toBeInTheDocument()
    await userEvent.click(button)
    expect(uiStore.getSnapshot().cartOpen).toBe(true)
  })
})
