/**
 * Checkout journeys (PRD §5.8.4 #21, §5.9): browse → filter classes via the
 * URL → add a class seat and a kit → anonymous checkout bounces to login →
 * the cart reopens → pick the child → POST /api/orders with ids only → the
 * success state shows the order code and a wa.me link with the Rp total.
 */
import { expect, test, type Page } from '@playwright/test'
import { makeOrder } from '../src/test/factories'
import { installMockBackend, MAX_PENDING_ORDERS, PARENT_PASSWORD } from './mock-backend'

/** Record window.open instead of leaving the app for wa.me. */
async function stubWindowOpen(page: Page) {
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.assign(window, { __opened: opened })
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
  })
}

const opened = (page: Page) =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)

test.beforeEach(async ({ page }) => {
  await stubWindowOpen(page)
})

test('anonymous visitor books a class + kit, logs in and orders via WhatsApp', async ({ page }) => {
  const mock = await installMockBackend(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ruang kecil untuk')

  // Classes, filtered through the URL.
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('link', { name: 'Kelas Akhir Pekan' })
    .click()
  await expect(page.getByText('4 kelas ditemukan')).toBeVisible()
  await page.getByLabel('Lokasi').selectOption('Ruang Kenari, Bintaro (Tangerang Selatan)')
  await expect(page).toHaveURL(/\/weekend-classes\?location=Ruang\+Kenari/)
  await expect(page.getByText('1 kelas ditemukan')).toBeVisible()
  expect(
    mock.calls.some(
      (c) =>
        c.path === '/api/classes' &&
        c.query.location === 'Ruang Kenari, Bintaro (Tangerang Selatan)',
    ),
  ).toBe(true)

  await page.getByRole('button', { name: 'Pesan kursi untuk Tukang Kebun Cilik' }).click()
  const drawer = page.getByRole('dialog', { name: 'Keranjang' })
  await expect(drawer.getByText('Tukang Kebun Cilik')).toBeVisible()
  await expect(drawer.getByText('Anak dipilih saat checkout')).toBeVisible()
  await page.keyboard.press('Escape')

  // A kit.
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('link', { name: 'Kit Edukasi' })
    .click()
  await page.getByRole('button', { name: 'Tambah Taman Berhitung ke keranjang' }).click()
  await expect(page.getByText('Taman Berhitung ×1 masuk keranjang.').first()).toBeVisible()

  // Anonymous checkout → login with next + cart=open.
  await page.getByRole('button', { name: 'Lihat keranjang, 2 item' }).click()
  await drawer.getByRole('link', { name: 'Lanjut ke Pembayaran' }).click()
  await expect(page).toHaveURL('/login?next=%2Fplay-kits&cart=open')
  await page.getByLabel('Email').fill('nadia@example.com')
  await page.getByLabel('Kata sandi').fill(PARENT_PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()

  // Back where we were, with the cart reopened.
  await expect(page).toHaveURL('/play-kits')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Lanjut ke Pembayaran' }).click()

  const checkout = page.getByRole('dialog', { name: 'Selesaikan pesanan' })
  await expect(checkout.getByText('Rp 325.000')).toBeVisible()
  await checkout.getByRole('button', { name: 'Lanjut' }).click()
  await checkout
    .getByLabel(/Anak untuk Tukang Kebun Cilik/)
    .selectOption({ label: 'Amina (6 tahun)' })
  await checkout.getByLabel(/Alamat pengiriman/).fill('Jl. Kemang Raya 12, Jakarta Selatan')
  await checkout.getByRole('button', { name: 'Lanjut' }).click()
  await expect(checkout.getByText('Untuk Amina', { exact: false })).toBeVisible()
  await checkout.getByRole('button', { name: 'Pesan via WhatsApp' }).click()

  // Success: order code + WhatsApp link with the Rp total.
  const success = page.getByRole('dialog', { name: 'Pesanan dibuat' })
  await expect(success.getByText('RUMI-2026-0001')).toBeVisible()
  await expect(success.getByText('Rp 325.000')).toBeVisible()
  const link = success.getByRole('link', { name: /Buka WhatsApp/ })
  const href = (await link.getAttribute('href')) ?? ''
  expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
  const text = decodeURIComponent(new URL(href).searchParams.get('text') ?? '')
  expect(text).toContain('RUMI-2026-0001')
  expect(text).toContain('Rp 325.000')
  await expect(link).toHaveAttribute('target', '_blank')
  expect(await opened(page)).toEqual([href])

  // The request carried ids and quantities only.
  const order = mock.calls.find((c) => c.method === 'POST' && c.path === '/api/orders')
  const body = order?.body as Record<string, unknown>
  expect(body.items).toEqual([
    { type: 'CLASS', class_id: 2, child_id: 1 },
    { type: 'KIT', kit_id: 4, quantity: 1 },
  ])
  expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/)
  expect(JSON.stringify(body)).not.toMatch(/price|total|fee|amount/)

  // The cart is empty afterwards.
  await success.getByRole('button', { name: 'Selesai' }).click()
  await expect(page.getByRole('button', { name: 'Lihat keranjang, 0 item' })).toBeVisible()
})

test('an out_of_stock rejection explains the problem and leads back to the cart', async ({
  page,
}) => {
  await installMockBackend(page, {
    as: 'PARENT',
    failures: {
      'POST /api/orders': {
        status: 409,
        code: 'out_of_stock',
        error: 'Stok Taman Berhitung tidak mencukupi (tersisa 0).',
      },
    },
  })
  await page.goto('/play-kits')
  await page.getByRole('button', { name: 'Tambah Taman Berhitung ke keranjang' }).click()
  await page.getByRole('button', { name: 'Lihat keranjang, 1 item' }).click()
  await page.getByRole('button', { name: 'Lanjut ke Pembayaran' }).click()
  const checkout = page.getByRole('dialog', { name: 'Selesaikan pesanan' })
  await checkout.getByRole('button', { name: 'Lanjut' }).click()
  await checkout.getByLabel(/Alamat pengiriman/).fill('Jl. Kemang Raya 12')
  await checkout.getByRole('button', { name: 'Lanjut' }).click()
  await checkout.getByRole('button', { name: 'Pesan via WhatsApp' }).click()
  const alert = checkout.getByRole('alert')
  await expect(alert).toContainText('Stok tidak mencukupi')
  await expect(alert).toContainText('(tersisa 0)')
  await alert.getByRole('button', { name: 'Ubah keranjang' }).click()
  await expect(page.getByRole('dialog', { name: 'Keranjang' })).toBeVisible()
})

/** As a signed-in parent: add one kit and walk the dialog up to the submit. */
async function checkoutOneKit(page: Page) {
  await page.goto('/play-kits')
  await page.getByRole('button', { name: 'Tambah Taman Berhitung ke keranjang' }).click()
  await expect(page.getByText('Taman Berhitung ×1 masuk keranjang.').first()).toBeVisible()
  await page.getByRole('button', { name: 'Lihat keranjang, 1 item' }).click()
  await page.getByRole('button', { name: 'Lanjut ke Pembayaran' }).click()
  const checkout = page.getByRole('dialog', { name: 'Selesaikan pesanan' })
  await checkout.getByRole('button', { name: 'Lanjut' }).click()
  await checkout.getByLabel(/Alamat pengiriman/).fill('Jl. Kemang Raya 12')
  await checkout.getByRole('button', { name: 'Lanjut' }).click()
  await checkout.getByRole('button', { name: 'Pesan via WhatsApp' }).click()
  return checkout
}

test('a placed order clears the stale "masuk keranjang" toast', async ({ page }) => {
  await installMockBackend(page, { as: 'PARENT' })
  await checkoutOneKit(page)
  const success = page.getByRole('dialog', { name: 'Pesanan dibuat' })
  await expect(success.getByText('RUMI-2026-0001')).toBeVisible()
  await expect(page.getByText('Taman Berhitung ×1 masuk keranjang.')).toHaveCount(0)
})

test('too many pending orders point the parent to the Pesanan tab', async ({ page }) => {
  const pending = Array.from({ length: MAX_PENDING_ORDERS }, (_, i) =>
    makeOrder({ id: 50 + i, order_code: `RUMI-2026-000${i + 1}` }),
  )
  const mock = await installMockBackend(page, { as: 'PARENT', orders: pending })
  const checkout = await checkoutOneKit(page)
  const alert = checkout.getByRole('alert')
  await expect(alert).toContainText('Masih ada pesanan yang menunggu')
  await expect(alert).toContainText(`Anda masih memiliki ${MAX_PENDING_ORDERS} pesanan`)
  expect(mock.state.orders).toHaveLength(MAX_PENDING_ORDERS)
  await alert.getByRole('link', { name: 'Lihat pesanan saya' }).click()
  await expect(page).toHaveURL('/parent/dashboard?tab=orders')
  await expect(page.getByRole('heading', { level: 2, name: 'Pesanan saya' })).toBeVisible()
  // The cart is kept, so the parent can come back once an order is settled.
  await expect(page.getByRole('button', { name: 'Lihat keranjang, 1 item' })).toBeVisible()
})

test('an admin cannot check out', async ({ page }) => {
  await installMockBackend(page, { as: 'ADMIN' })
  await page.goto('/play-kits')
  await page.getByRole('button', { name: 'Tambah Taman Berhitung ke keranjang' }).click()
  await page.getByRole('button', { name: 'Lihat keranjang, 1 item' }).click()
  const drawer = page.getByRole('dialog', { name: 'Keranjang' })
  await expect(drawer.getByText('Checkout hanya tersedia untuk akun orang tua.')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Lanjut ke Pembayaran' })).toBeDisabled()
})
