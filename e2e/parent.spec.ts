/**
 * Parent dashboard + printable report journeys (Phase 6) over the built SPA
 * and the §5 mock backend: child switcher (?child=), sections (?tab=),
 * progress chart and trends, attendance, orders with the WhatsApp resend
 * link, add / delete child, and the report's print button and print styles.
 */
import { expect, test } from '@playwright/test'
import {
  makeAssessment,
  makeChild,
  makeEnrollment,
  makeKitOrderItem,
  makeOrder,
} from '../src/test/factories'
import { installMockBackend } from './mock-backend'

const YUSUF = makeChild({ id: 7, name: 'Yusuf', dob: '2022-02-01', age_years: 4 })

const ASSESSMENTS = [
  makeAssessment({
    id: 1,
    domain: 'PRACTICAL_LIFE',
    level: 2,
    observed_on: '2026-01-17',
    milestone: 'Menuang air dari teko kecil dengan hati-hati',
    notes: null,
  }),
  makeAssessment({ id: 2 }),
  makeAssessment({
    id: 3,
    domain: 'SENSORIAL',
    level: 3,
    observed_on: '2026-10-24',
    milestone: 'Mengurutkan silinder dari yang terbesar ke terkecil',
    notes: null,
  }),
]

const ENROLLMENTS = [
  makeEnrollment({
    id: 1,
    status: 'ATTENDED',
    class_title: 'Mengenal Syukur',
    class_date: '2026-01-17',
    order_code: 'RUMI-2025-0001',
  }),
  // Far-future date so "Kelas berikutnya" stays upcoming whenever the suite runs.
  makeEnrollment({ id: 2, status: 'CONFIRMED', class_date: '2030-11-16' }),
]

const PAID_ORDER = makeOrder({
  id: 2,
  order_code: 'RUMI-2025-0001',
  status: 'PAID',
  expires_at: null,
  paid_at: '2025-12-29T02:00:00Z',
  items: [
    makeKitOrderItem({
      id: 3,
      name: 'Kartu Bulan Gurun',
      quantity: 1,
      unit_price_idr: 120000,
      line_total_idr: 120000,
    }),
  ],
})

const SEED = {
  as: 'PARENT' as const,
  children: [makeChild(), YUSUF],
  assessments: ASSESSMENTS,
  enrollments: ENROLLMENTS,
  orders: [makeOrder(), PAID_ORDER],
}

test.describe('parent dashboard', () => {
  test('child switcher, sections and the overview', async ({ page }) => {
    await installMockBackend(page, SEED)
    await page.goto('/parent/dashboard')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Selamat datang, Nadia Rahman' }),
    ).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Menu dasbor' })
    for (const label of ['Ringkasan', 'Kehadiran', 'Perkembangan', 'Pesanan']) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible()
    }
    await expect(nav.getByRole('button', { name: 'Ringkasan' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('button', { name: /Lihat keranjang/ })).toBeVisible()

    const switcher = page.getByRole('combobox', { name: 'Pilih anak' })
    await expect(switcher).toHaveValue('1')
    await expect(page.getByRole('heading', { name: 'Perjalanan Amina di RUMI' })).toBeVisible()
    await expect(
      page.getByText('“Konsentrasinya makin tumbuh — ia memilih kegiatan yang sama tiga kali.”'),
    ).toBeVisible()
    await expect(page.getByRole('group', { name: 'Tingkat kehadiran' })).toContainText('100%')
    await expect(page.getByRole('group', { name: 'Ranah dinilai' })).toContainText('2/5')
    await expect(page.getByText('Bulan & Gerak')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Sabtu, 16 November 2030' })).toBeVisible()

    await switcher.selectOption({ label: 'Yusuf (4 tahun)' })
    await expect(page).toHaveURL(/[?&]child=7/)
    await expect(page.getByRole('heading', { name: 'Perjalanan Yusuf di RUMI' })).toBeVisible()
    await expect(page.getByText(/Belum ada catatan dari pendamping/)).toBeVisible()
    await expect(page.getByText('Belum ada kelas terjadwal untuk Yusuf.')).toBeVisible()
  })

  test('progress chart, milestones and per-domain trends', async ({ page }) => {
    await installMockBackend(page, SEED)
    await page.goto('/parent/dashboard')
    await page
      .getByRole('navigation', { name: 'Menu dasbor' })
      .getByRole('button', { name: 'Perkembangan' })
      .click()
    await expect(page).toHaveURL(/[?&]tab=progress/)
    const chart = page.getByRole('list', { name: 'Tingkat terbaru per ranah' })
    await expect(chart.getByRole('listitem')).toHaveCount(5)
    await expect(chart.getByRole('listitem').nth(0)).toContainText('Kehidupan Praktis')
    await expect(chart.getByRole('listitem').nth(0)).toContainText('Berlatih Mandiri (3/4)')
    await expect(chart.getByRole('listitem').nth(1)).toContainText('Sensorial')
    await expect(chart.getByRole('listitem').nth(2)).toContainText('Belum ada catatan')
    await expect(
      page.getByRole('progressbar', { name: 'Kehidupan Praktis: Berlatih Mandiri (3/4)' }),
    ).toHaveAttribute('aria-valuenow', '3')
    await expect(page.getByText('Menuang air dari teko kecil dengan hati-hati')).toBeVisible()
    await expect(page.getByText('Terakhir: Berlatih Mandiri (3/4)').first()).toBeVisible()
    await expect(page.locator('figure polyline')).toHaveCount(1)
    await expect(
      page.getByRole('list', { name: 'Riwayat tingkat Kehidupan Praktis' }).getByRole('listitem'),
    ).toHaveText(['17 Jan 2026: Berkembang (2/4)', '24 Okt 2026: Berlatih Mandiri (3/4)'])
  })

  test('attendance lists every class with its status', async ({ page }) => {
    await installMockBackend(page, SEED)
    await page.goto('/parent/dashboard?tab=attendance')
    const table = page.getByRole('table', { name: 'Daftar kelas Amina' })
    await expect(table.getByRole('row', { name: /Mengenal Syukur/ })).toContainText('Hadir')
    await expect(table.getByRole('row', { name: /Bulan & Gerak/ })).toContainText('Terkonfirmasi')
  })

  test('orders show items, totals, status and the WhatsApp resend link', async ({ page }) => {
    await installMockBackend(page, SEED)
    await page.goto('/parent/dashboard')
    await page
      .getByRole('navigation', { name: 'Menu dasbor' })
      .getByRole('button', { name: 'Pesanan' })
      .click()
    await expect(page.getByRole('heading', { level: 2, name: 'Pesanan saya' })).toBeVisible()
    const pending = page.getByRole('article', { name: 'RUMI-2026-0001' })
    await expect(pending).toContainText('Menunggu Konfirmasi')
    await expect(pending).toContainText('Kelas Bulan & Gerak (Amina)')
    await expect(pending).toContainText('Kit Nampan Tangan Kecil ×2')
    await expect(pending).toContainText('Rp 570.000')
    await expect(pending).toContainText(/Konfirmasi sebelum/)
    const resend = pending.getByRole('link', { name: /Kirim ulang ke WhatsApp/ })
    await expect(resend).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/)
    await expect(resend).toHaveAttribute('target', '_blank')
    await expect(resend).toHaveAttribute('rel', /noopener/)

    const paid = page.getByRole('article', { name: 'RUMI-2025-0001' })
    await expect(paid).toContainText('Lunas')
    await expect(paid).toContainText('Rp 120.000')
    await expect(paid.getByRole('link', { name: /Kirim ulang/ })).toHaveCount(0)
  })

  test('adds a child and selects it', async ({ page }) => {
    const mock = await installMockBackend(page, SEED)
    await page.goto('/parent/dashboard')
    await page.getByRole('button', { name: 'Tambah anak' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tambah data anak' })
    await dialog.getByRole('button', { name: 'Simpan data anak' }).click()
    await expect(dialog.getByLabel('Nama anak')).toHaveAttribute('aria-invalid', 'true')

    await dialog.getByLabel('Nama anak').fill('Zahra')
    await dialog.getByLabel('Tanggal lahir').fill('2022-05-01')
    await dialog.getByRole('button', { name: 'Simpan data anak' }).click()
    await expect(page.getByText('Data Zahra berhasil ditambahkan.').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Perjalanan Zahra di RUMI' })).toBeVisible()
    expect(
      mock.calls.find((c) => c.method === 'POST' && c.path === '/api/me/children')?.body,
    ).toEqual({ name: 'Zahra', dob: '2022-05-01', notes: null })
  })

  test('a blocked delete (409) stays in the confirm dialog', async ({ page }) => {
    await installMockBackend(page, {
      ...SEED,
      failures: {
        'DELETE /api/me/children/1': {
          status: 409,
          code: 'conflict',
          error: 'Anak masih memiliki kelas aktif.',
        },
      },
    })
    await page.goto('/parent/dashboard')
    await page.getByRole('button', { name: 'Hapus data Amina' }).click()
    const dialog = page.getByRole('dialog', { name: 'Hapus data Amina?' })
    await dialog.getByRole('button', { name: 'Ya, hapus' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Anak masih memiliki kelas aktif.')
    await expect(dialog).toBeVisible()
  })
})

test.describe('printable report', () => {
  test('renders the report and prints it', async ({ page }) => {
    await installMockBackend(page, SEED)
    await page.goto('/parent/dashboard')
    await page.getByRole('link', { name: 'Unduh Laporan' }).click()
    await expect(page).toHaveURL('/parent/report/1')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Laporan Perkembangan Amina' }),
    ).toBeVisible()
    await expect(page.getByRole('img', { name: 'RUMI — Rumah Main Islami' })).toBeVisible()
    await expect(page.getByText('6 tahun')).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Tingkat terbaru per ranah untuk Amina' }),
    ).toContainText('Berlatih Mandiri (3/4)')
    await expect(page.getByRole('table', { name: 'Riwayat penilaian Amina' })).toContainText(
      'Mengurutkan silinder dari yang terbesar ke terkecil',
    )
    await expect(page.getByRole('table', { name: 'Kelas yang diikuti Amina' })).toContainText(
      'Mengenal Syukur',
    )
    await expect(page.getByText('Rubrik tingkat')).toBeVisible()
    await expect(
      page.getByText('Konsentrasinya makin tumbuh — ia memilih kegiatan yang sama tiga kali.'),
    ).toBeVisible()

    await page.evaluate(() => {
      const w = window as Window & { printCalls?: number }
      w.printCalls = 0
      w.print = () => {
        w.printCalls = (w.printCalls ?? 0) + 1
      }
    })
    const printButton = page.getByRole('button', { name: 'Unduh PDF' })
    await printButton.click()
    expect(await page.evaluate(() => (window as Window & { printCalls?: number }).printCalls)).toBe(
      1,
    )

    await page.emulateMedia({ media: 'print' })
    await expect(printButton).toBeHidden()
    await expect(page.getByRole('link', { name: 'Kembali ke dasbor' })).toBeHidden()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Laporan Perkembangan Amina' }),
    ).toBeVisible()

    await page.emulateMedia({ media: 'screen' })
    await page.getByRole('link', { name: 'Kembali ke dasbor' }).click()
    await expect(page).toHaveURL('/parent/dashboard?child=1')
  })

  test('another family’s child shows "Laporan tidak ditemukan"', async ({ page }) => {
    await installMockBackend(page, SEED)
    await page.goto('/parent/report/99')
    await expect(page.getByRole('heading', { name: 'Laporan tidak ditemukan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unduh PDF' })).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })
})
