/**
 * Foundation smoke journeys over the built SPA + the §5 mock backend: the
 * public shell, /design-kit, the 404 page and the RequireRole bounces. Page
 * lanes add their own journey specs next to this one.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMockBackend } from './mock-backend'

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

test.describe('public shell', () => {
  test('home renders header, one h1, footer and Indonesian nav', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await installMockBackend(page)
    await page.goto('/')
    await expect(page).toHaveTitle('RUMI · Rumah Main Islami')
    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
    for (const label of [
      'Beranda',
      'Tentang Kami',
      'Pendekatan Kami',
      'Kelas Akhir Pekan',
      'Kit Edukasi',
    ]) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible()
    }
    await expect(nav.getByRole('link', { name: 'Beranda' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible()
    await expect(page.getByRole('contentinfo')).toContainText('Kunjungi RUMI')
    await expect(page.getByRole('img', { name: 'RUMI — Rumah Main Islami' }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the skip link is first in tab order and targets main', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Lewati ke konten utama' })
    await expect(skip).toBeFocused()
    await expect(skip).toHaveAttribute('href', '#main')
  })

  test('the header cart button opens the cart drawer', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Lihat keranjang, 0 item' }).click()
    const drawer = page.getByRole('dialog', { name: 'Keranjang' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { name: 'Keranjang masih kosong' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
  })

  test('a signed-in parent sees "Dasbor" in the header', async ({ page }) => {
    await installMockBackend(page, { as: 'PARENT' })
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Dasbor', exact: true })).toHaveAttribute(
      'href',
      '/parent/dashboard',
    )
  })

  test('unknown paths render the 404 page inside the public layout', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/halaman-yang-tidak-ada')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman tidak ditemukan' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Kembali ke Beranda' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('/design-kit', () => {
  test('shows every section and copies a swatch hex', async ({ page, context }) => {
    const errors = trackConsoleErrors(page)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await installMockBackend(page)
    await page.goto('/design-kit')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Perangkat tenang untuk momen yang bermakna.',
    )
    for (const title of [
      'Palet warna',
      'Skala huruf',
      'Tombol',
      'Badge & status',
      'Kontrol formulir',
      'Kartu & panel',
      'Peringatan, kosong & memuat',
      'Tab, segmen & langkah',
      'Dialog, laci & notifikasi',
      'Tabel & format',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    }
    await page.getByRole('button', { name: /^Salin warna Teal, / }).click()
    // The hex is computed from the --color-primary token at runtime. Either the
    // success toast or (when the async Clipboard API is unavailable, e.g. an
    // unfocused parallel worker) the manual-copy fallback toast shows it.
    const toasts = page.getByRole('region', { name: /^Notifikasi/ })
    await expect(toasts.getByText(/(Disalin|Salin manual): #2A9D8F$/).first()).toBeVisible()
    await expect(page.getByText('Rp 1.250.000')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('dialog, drawer and confirm overlays open and close', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/design-kit')
    await page.getByRole('button', { name: 'Buka dialog' }).click()
    await expect(page.getByRole('dialog', { name: 'Detail kelas' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Buka dialog' })).toBeFocused()

    await page.getByRole('button', { name: 'Buka laci' }).click()
    await expect(page.getByRole('dialog', { name: 'Laci contoh' })).toBeVisible()
    await page.getByRole('button', { name: 'Tutup' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: 'Buka konfirmasi' }).click()
    await page.getByRole('button', { name: 'Ya, batalkan' }).click()
    await expect(page.getByText('Pesanan contoh dibatalkan.').first()).toBeVisible()
  })
})

test.describe('RequireRole', () => {
  test('anonymous visitors are bounced to /login?next=', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/parent/dashboard?tab=orders')
    await expect(page).toHaveURL('/login?next=%2Fparent%2Fdashboard%3Ftab%3Dorders')
  })

  test('a parent is bounced off the admin dashboard', async ({ page }) => {
    await installMockBackend(page, { as: 'PARENT' })
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL('/parent/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nadia Rahman')
  })

  test('an admin reaches the admin dashboard and can log out', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'ADMIN' })
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: 'Dasbor Admin' })).toBeVisible()
    await page.getByRole('button', { name: 'Keluar' }).click()
    await expect(page).toHaveURL('/')
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === '/api/auth/logout')).toBe(true)
    await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible()
  })
})
