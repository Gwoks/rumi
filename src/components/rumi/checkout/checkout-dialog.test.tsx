import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAuthUser } from '@/api/auth-store'
import { api } from '@/api/client'
import { ApiError } from '@/api/errors'
import { UUID_RE } from '@/api/enums'
import type { CheckoutBody } from '@/api/schemas'
import { addClass, addKit, cartStore, clearCart } from '@/stores/cart'
import {
  makeCheckoutResult,
  makeChild,
  makeClass,
  makeKit,
  makeOrder,
  makeUser,
} from '@/test/factories'
import { useToast } from '@/components/ui/toast'
import { renderWithRouter } from '@/test/render'
import { CheckoutDialog } from './checkout-dialog'

const WA_URL = 'https://wa.me/6281234567890?text=RUMI-2026-0007%20Total%3A%20Rp%20570.000'

const CART_TOAST = 'Nampan Tangan Kecil ×2 masuk keranjang.'

function Harness({ onEditCart = () => {} }: { onEditCart?: () => void }) {
  const [open, setOpen] = useState(true)
  const { toast } = useToast()
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        buka
      </button>
      <button type="button" onClick={() => toast(CART_TOAST)}>
        toast keranjang
      </button>
      <CheckoutDialog open={open} onOpenChange={setOpen} onEditCart={onEditCart} />
    </>
  )
}

function setup(onEditCart?: () => void) {
  const user = userEvent.setup()
  renderWithRouter(<Harness onEditCart={onEditCart} />)
  return user
}

async function goToConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Lanjut' }))
  await user.selectOptions(await screen.findByLabelText(/Anak untuk Bulan & Gerak/), '1')
  await user.type(screen.getByLabelText(/Alamat pengiriman/), 'Jl. Kemang Raya 12')
  await user.click(screen.getByRole('button', { name: 'Lanjut' }))
  await screen.findByRole('button', { name: 'Pesan via WhatsApp' })
}

const checkoutBody = (spy: { mock: { calls: unknown[][] } }, call = 0) =>
  spy.mock.calls[call][0] as CheckoutBody

let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  clearCart()
  setAuthUser(makeUser())
  addClass(makeClass())
  addKit(makeKit(), 2)
  vi.spyOn(api, 'listChildren').mockResolvedValue([makeChild()])
  openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
})

afterEach(() => {
  setAuthUser(null)
})

describe('CheckoutDialog', () => {
  it('step 1 itemizes the cart in Rupiah with an estimated total', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Selesaikan pesanan' })
    expect(within(dialog).getByRole('list', { name: 'Langkah' })).toBeInTheDocument()
    expect(within(dialog).getByText('Bulan & Gerak')).toBeInTheDocument()
    expect(within(dialog).getByText('Nampan Tangan Kecil ×2')).toBeInTheDocument()
    expect(within(dialog).getByText('Rp 370.000')).toBeInTheDocument()
    expect(within(dialog).getByText('Rp 570.000')).toBeInTheDocument()
  })

  it('step 2 requires a child per class and an address when there is a kit', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    expect(await screen.findByLabelText(/Nama penerima/)).toHaveValue('Nadia Rahman')
    expect(screen.getByLabelText(/Nomor WhatsApp/)).toHaveValue('6281211112222')
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    expect(await screen.findByText('Pilih anak untuk kelas ini.')).toBeInTheDocument()
    expect(screen.getByText('Wajib diisi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeInTheDocument()
  })

  it('posts ids only with a UUID key, then shows the order code and opens WhatsApp', async () => {
    const order = makeOrder({ order_code: 'RUMI-2026-0007', wa_url: WA_URL })
    const checkout = vi.spyOn(api, 'checkout').mockResolvedValue(makeCheckoutResult(order))
    const user = setup()
    await goToConfirm(user)
    expect(screen.getByText('Untuk Amina', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))

    expect(await screen.findByText('RUMI-2026-0007')).toBeInTheDocument()
    const body = checkoutBody(checkout)
    expect(body.idempotency_key).toMatch(UUID_RE)
    expect(body.items).toEqual([
      { type: 'CLASS', class_id: 1, child_id: 1 },
      { type: 'KIT', kit_id: 1, quantity: 2 },
    ])
    expect(body.delivery).toEqual({
      name: 'Nadia Rahman',
      phone_wa: '6281211112222',
      address: 'Jl. Kemang Raya 12',
    })
    expect(JSON.stringify(body)).not.toMatch(/price|total|fee/)
    const link = screen.getByRole('link', { name: /Buka WhatsApp/ })
    expect(link).toHaveAttribute('href', WA_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(openSpy).toHaveBeenCalledWith(WA_URL, '_blank', 'noopener,noreferrer')
    expect(cartStore.getSnapshot().items).toEqual([])
  })

  it('reuses the idempotency key on retry, and starts a new one after success', async () => {
    const checkout = vi
      .spyOn(api, 'checkout')
      .mockRejectedValueOnce(new ApiError('network_error', 'x', 0))
      .mockResolvedValue(makeCheckoutResult(makeOrder({ wa_url: WA_URL })))
    const user = setup()
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Pesanan belum terkirim')
    expect(alert).toHaveTextContent('tidak akan tercatat dua kali')
    await user.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByText('RUMI-2026-0001')).toBeInTheDocument()
    expect(checkoutBody(checkout, 1).idempotency_key).toBe(
      checkoutBody(checkout, 0).idempotency_key,
    )

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    addKit(makeKit(), 1)
    await user.click(screen.getByRole('button', { name: 'buka' }))
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    await user.type(await screen.findByLabelText(/Alamat pengiriman/), 'Jl. Damai 1')
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    await user.click(await screen.findByRole('button', { name: 'Pesan via WhatsApp' }))
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(3))
    expect(checkoutBody(checkout, 2).idempotency_key).not.toBe(
      checkoutBody(checkout, 0).idempotency_key,
    )
  })

  it('starts a new idempotency key when the order changed after a failed attempt', async () => {
    const checkout = vi
      .spyOn(api, 'checkout')
      .mockRejectedValueOnce(new ApiError('network_error', 'x', 0))
      .mockResolvedValue(makeCheckoutResult(makeOrder({ wa_url: WA_URL })))
    const user = setup()
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    await screen.findByRole('alert')

    // Back to the details, change the address, confirm again.
    await user.click(screen.getByRole('button', { name: 'Kembali' }))
    const address = await screen.findByLabelText(/Alamat pengiriman/)
    await user.clear(address)
    await user.type(address, 'Jl. Damai 1')
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    await user.click(await screen.findByRole('button', { name: 'Pesan via WhatsApp' }))
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2))
    expect(checkoutBody(checkout, 1).delivery.address).toBe('Jl. Damai 1')
    expect(checkoutBody(checkout, 1).idempotency_key).not.toBe(
      checkoutBody(checkout, 0).idempotency_key,
    )
  })

  it('points to the orders tab when too many orders are pending', async () => {
    vi.spyOn(api, 'checkout').mockRejectedValue(
      new ApiError(
        'too_many_pending_orders',
        'Anda masih memiliki 3 pesanan yang menunggu konfirmasi.',
        409,
      ),
    )
    const user = setup()
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Masih ada pesanan yang menunggu')
    expect(alert).toHaveTextContent('Anda masih memiliki 3 pesanan')
    const link = within(alert).getByRole('link', { name: 'Lihat pesanan saya' })
    expect(link).toHaveAttribute('href', '/parent/dashboard?tab=orders')
    await user.click(link)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(cartStore.getSnapshot().items).toHaveLength(2)
  })

  it('clears stale toasts once the order is placed', async () => {
    vi.spyOn(api, 'checkout').mockResolvedValue(makeCheckoutResult(makeOrder({ wa_url: WA_URL })))
    const user = setup()
    // The modal makes the page inert, so fire the click directly.
    fireEvent.click(screen.getByRole('button', { name: 'toast keranjang', hidden: true }))
    expect((await screen.findAllByText(CART_TOAST)).length).toBeGreaterThan(0)
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    await screen.findByText('RUMI-2026-0001')
    await waitFor(() => expect(screen.queryByText(CART_TOAST)).toBeNull())
  })

  it('maps out_of_stock to a cart fix with the server message', async () => {
    vi.spyOn(api, 'checkout').mockRejectedValue(
      new ApiError('out_of_stock', 'Stok Nampan Tangan Kecil tidak mencukupi (tersisa 1).', 409),
    )
    const onEditCart = vi.fn()
    const user = setup(onEditCart)
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Stok tidak mencukupi')
    expect(alert).toHaveTextContent('(tersisa 1)')
    await user.click(within(alert).getByRole('button', { name: 'Ubah keranjang' }))
    expect(onEditCart).toHaveBeenCalledOnce()
    expect(cartStore.getSnapshot().items).toHaveLength(2)
  })

  it('maps a delivery validation_error back to the details step with field errors', async () => {
    vi.spyOn(api, 'checkout').mockRejectedValue(
      new ApiError('validation_error', 'Data tidak valid.', 422, {
        fields: { 'delivery.phone_wa': 'Nomor WhatsApp tidak valid.' },
      }),
    )
    const user = setup()
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    expect(await screen.findByText('Nomor WhatsApp tidak valid.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nomor WhatsApp/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Periksa kembali data pesanan')
  })

  it('maps already_enrolled to the details step', async () => {
    vi.spyOn(api, 'checkout').mockRejectedValue(
      new ApiError('already_enrolled', 'Amina sudah terdaftar di kelas Bulan & Gerak.', 409),
    )
    const user = setup()
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Anak sudah terdaftar')
    await user.click(within(alert).getByRole('button', { name: 'Ubah detail' }))
    expect(await screen.findByLabelText(/Anak untuk Bulan & Gerak/)).toBeInTheDocument()
  })

  it('closes on unauthorized (the global handler redirects to login)', async () => {
    vi.spyOn(api, 'checkout').mockRejectedValue(new ApiError('unauthorized', 'x', 401))
    const user = setup()
    await goToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Pesan via WhatsApp' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('refuses the same child twice in one class', async () => {
    addClass(makeClass())
    const lines = cartStore.getSnapshot().items.filter((i) => i.type === 'CLASS')
    expect(lines).toHaveLength(1)
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    await user.selectOptions(await screen.findByLabelText(/Anak untuk Bulan & Gerak/), '1')
    act(() => {
      addClass(makeClass())
    })
    const pickers = await screen.findAllByLabelText(/Anak untuk Bulan & Gerak/)
    expect(pickers).toHaveLength(2)
    await user.selectOptions(pickers[1], '1')
    expect(
      await screen.findByText('Anak ini sudah dipilih untuk kelas yang sama.'),
    ).toBeInTheDocument()
  })

  it('links to the dashboard when the parent has no children', async () => {
    vi.spyOn(api, 'listChildren').mockResolvedValue([])
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    expect(await screen.findByText('Belum ada data anak di akun Anda.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tambah data anak di dasbor' })).toHaveAttribute(
      'href',
      '/parent/dashboard',
    )
  })

  it('offers a retry when the children fail to load', async () => {
    const list = vi
      .spyOn(api, 'listChildren')
      .mockRejectedValueOnce(new ApiError('internal', 'Terjadi kesalahan pada server.', 500))
      .mockResolvedValue([makeChild()])
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Data anak gagal dimuat.')
    await user.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByLabelText(/Anak untuk Bulan & Gerak/)).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('goes back a step and back to the cart', async () => {
    const onEditCart = vi.fn()
    const user = setup(onEditCart)
    await user.click(screen.getByRole('button', { name: 'Lanjut' }))
    await user.click(await screen.findByRole('button', { name: 'Kembali' }))
    await user.click(screen.getByRole('button', { name: 'Ubah keranjang' }))
    expect(onEditCart).toHaveBeenCalledOnce()
  })

  it('shows an empty state when the cart is empty', () => {
    clearCart()
    setup()
    expect(screen.getByRole('heading', { name: 'Keranjang kosong' })).toBeInTheDocument()
  })
})
