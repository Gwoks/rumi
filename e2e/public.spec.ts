/**
 * Public page journeys over the §5 mock backend: Beranda sections, URL-synced
 * class filters and detail dialog, the kit category filter and stock cap, and
 * the CMS pages (Tentang Kami, Pendekatan Kami) incl. missing sections and
 * load failures.
 */
import { expect, test, type Page } from '@playwright/test'
import { makeClass, makeCmsPage, SEED_CLASSES } from '../src/test/factories'
import { installMockBackend } from './mock-backend'

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

test.describe('Beranda', () => {
  test('renders the CMS hero, Cara RUMI, next classes and latest kits', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await installMockBackend(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Ruang kecil untuk bertanya & bertumbuh.',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('img', { name: 'Material indah. Pertanyaan besar.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Cari kelas akhir pekan' })).toHaveAttribute(
      'href',
      '/weekend-classes',
    )
    await expect(page.getByRole('link', { name: 'Cara RUMI bekerja' })).toHaveAttribute(
      'href',
      '/our-approach',
    )
    await expect(page.getByRole('heading', { name: 'Kelas terdekat: Bulan & Gerak' })).toBeVisible()
    for (const title of ['Berakar pada adab', 'Tangan sebelum layar', 'Rasa takjub disambut']) {
      await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible()
    }
    const upcoming = page.getByRole('region', { name: 'Pop-up yang akan datang' })
    await expect(upcoming.getByRole('article')).toHaveCount(3)
    const kits = page.getByRole('region', { name: 'Kit edukasi untuk pembelajar cilik' })
    await expect(kits.getByRole('article')).toHaveCount(4)
    expect(errors).toEqual([])
  })

  test('quick booking adds the nearest class and opens the cart', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Pesan kursi sekarang' }).click()
    const drawer = page.getByRole('dialog', { name: 'Keranjang' })
    await expect(drawer.getByText('Bulan & Gerak')).toBeVisible()
  })

  test('a class load failure shows an alert with retry; a missing hero falls back', async ({
    page,
  }) => {
    const home = makeCmsPage('home')
    await installMockBackend(page, {
      cms: { home: { ...home, sections: home.sections.filter((s) => s.section_key !== 'hero') } },
      failures: {
        'GET /api/classes': { status: 503, code: 'unavailable', error: 'Layanan sedang sibuk.' },
      },
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Ruang kecil untuk bertanya & bertumbuh.',
    )
    const alert = page.getByRole('alert').filter({ hasText: 'Jadwal kelas gagal dimuat.' })
    await expect(alert).toContainText('Layanan sedang sibuk.')
    await expect(alert.getByRole('button', { name: 'Coba lagi' })).toBeVisible()
  })
})

test.describe('Kelas Akhir Pekan', () => {
  test('filters are read from and written to the URL', async ({ page }) => {
    const mock = await installMockBackend(page)
    await page.goto('/weekend-classes?age=7')
    await expect(page.getByLabel('Usia anak')).toHaveValue('7')
    await expect(page.getByRole('heading', { name: 'Belum ada kelas yang cocok' })).toBeVisible()
    expect(mock.calls.some((c) => c.path === '/api/classes' && c.query.age === '7')).toBe(true)

    await page.getByRole('button', { name: 'Hapus filter' }).last().click()
    await expect(page).toHaveURL('/weekend-classes')
    await expect(page.getByText('4 kelas ditemukan')).toBeVisible()

    await page.getByLabel('Dari tanggal').fill('2026-11-20')
    await expect(page).toHaveURL('/weekend-classes?from=2026-11-20')
    await expect(page.getByText('3 kelas ditemukan')).toBeVisible()
    await page.getByLabel('Sampai tanggal').fill('2026-11-10')
    await expect(
      page.getByText('Tanggal akhir harus sama dengan atau setelah tanggal awal.'),
    ).toBeVisible()
  })

  test('the detail dialog shows the full schedule and books a seat', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/weekend-classes')
    await page.getByRole('button', { name: 'Lihat detail Suara & Pasir' }).click()
    const dialog = page.getByRole('dialog', { name: 'Suara & Pasir' })
    await expect(dialog.getByText('Sabtu, 5 Desember 2026')).toBeVisible()
    await expect(dialog.getByText('09:30–11:30 WIB')).toBeVisible()
    await expect(dialog.getByText('Rp 250.000')).toBeVisible()
    await dialog.getByRole('button', { name: 'Pesan kursi untuk Suara & Pasir' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Keranjang' }).getByText('Suara & Pasir'),
    ).toBeVisible()
  })

  test('a full class cannot be booked and few seats are flagged', async ({ page }) => {
    await installMockBackend(page, {
      classes: [
        makeClass({ seats_booked: 12 }),
        { ...SEED_CLASSES[1], seats_booked: 10, seats_left: 2 },
      ],
    })
    await page.goto('/weekend-classes')
    await expect(page.getByText('Penuh', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kelas penuh' })).toBeDisabled()
    await expect(page.getByText('Sisa 2 kursi')).toBeVisible()
  })
})

test.describe('Kit Edukasi', () => {
  test('category filter is synced to the URL', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/play-kits')
    await expect(page.getByRole('article')).toHaveCount(4)
    await page.getByRole('radio', { name: 'Sensorial' }).click()
    await expect(page).toHaveURL('/play-kits?category=SENSORIAL')
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Set Suara & Pasir' })).toBeVisible()
    await expect(page.getByText('Baru')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('radio', { name: 'Sensorial' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('the quantity stepper is capped by stock in the dialog and in the cart', async ({
    page,
  }) => {
    await installMockBackend(page)
    await page.goto('/play-kits')
    await expect(page.getByText('Sisa 4')).toBeVisible()
    await page.getByRole('button', { name: 'Lihat detail Set Suara & Pasir' }).click()
    const dialog = page.getByRole('dialog', { name: 'Set Suara & Pasir' })
    const plus = dialog.getByRole('button', { name: 'Tambah jumlah' })
    for (let i = 0; i < 3; i += 1) await plus.click()
    await expect(dialog.getByRole('group', { name: 'Jumlah Set Suara & Pasir' })).toContainText('4')
    await expect(plus).toBeDisabled()
    await dialog.getByRole('button', { name: 'Tambah Set Suara & Pasir ke keranjang' }).click()
    await expect(page.getByText('Set Suara & Pasir ×4 masuk keranjang.').first()).toBeVisible()

    await page.getByRole('button', { name: 'Lihat keranjang, 4 item' }).click()
    const drawer = page.getByRole('dialog', { name: 'Keranjang' })
    await expect(drawer.getByText('Rp 900.000').first()).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Tambah jumlah' })).toBeDisabled()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Lihat detail Set Suara & Pasir' }).click()
    await expect(
      dialog.getByText('Jumlah maksimal untuk kit ini sudah ada di keranjang.'),
    ).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Tambah ke Keranjang' })).toBeDisabled()
  })
})

test.describe('CMS pages', () => {
  test('Tentang Kami renders founder, philosophy, mission and educators', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/who-we-are')
    await expect(page.getByRole('heading', { level: 1, name: 'Tentang Kami' })).toBeVisible()
    for (const heading of [
      'Tangan-tangan kecil, didampingi kampung yang peduli.',
      'Ikuti anak, rawat fitrahnya.',
      'Menumbuhkan anak yang mandiri, penuh takjub, dan beradab.',
      'Para pendamping kami',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible()
    }
    for (const name of ['Nadia Rahman', 'Ustazah Mariam Yusuf', 'Hana Karim']) {
      await expect(page.getByRole('heading', { level: 3, name })).toBeVisible()
    }
  })

  test('a missing CMS section is skipped without breaking the page', async ({ page }) => {
    const page1 = makeCmsPage('who-we-are')
    await installMockBackend(page, {
      cms: {
        'who-we-are': {
          ...page1,
          sections: page1.sections.filter((s) => s.section_key !== 'educators'),
        },
      },
    })
    await page.goto('/who-we-are')
    await expect(page.getByRole('heading', { name: 'Ikuti anak, rawat fitrahnya.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Para pendamping kami' })).toHaveCount(0)
  })

  test('a CMS failure shows an alert', async ({ page }) => {
    await installMockBackend(page, {
      failures: { 'GET /api/cms/our-approach': { status: 500, code: 'internal' } },
    })
    await page.goto('/our-approach')
    await expect(page.getByRole('heading', { level: 1, name: 'Pendekatan Kami' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Konten halaman ini gagal dimuat.')
  })

  test('Pendekatan Kami: domain tabs and Islamic value cards', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/our-approach')
    const tabs = page.getByRole('tablist', { name: 'Ranah belajar' })
    await expect(tabs.getByRole('tab')).toHaveCount(5)
    await expect(page.getByText('Menuang air dan biji-bijian')).toBeVisible()
    await tabs.getByRole('tab', { name: 'Matematika' }).click()
    await expect(tabs.getByRole('tab', { name: 'Matematika' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByText('Menghitung dengan tangga manik-manik')).toBeVisible()
    await expect(page.getByText('أدب')).toHaveAttribute('lang', 'ar')
    await expect(page.getByText('أدب')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 3, name: 'Syukur' })).toBeVisible()
  })
})
