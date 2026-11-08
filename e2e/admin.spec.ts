/**
 * Admin dashboard journeys (Phase 7) over the built SPA and the §5 mock
 * backend: metrics, marking a PENDING_WA order PAID (badge + metrics
 * refresh), kit create / edit / delete through the ResourceManager, a 409 on
 * delete, CMS JSON validation, attendance marking and the assessment logger.
 */
import { expect, test, type Page } from '@playwright/test'
import { makeEnrollment, makeOrder } from '../src/test/factories'
import { installMockBackend } from './mock-backend'

function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Menu dasbor' })
}

/** Today in WIB as YYYY-MM-DD (what the assessment form defaults to). */
function todayWib(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

test.describe('admin dashboard', () => {
  test('marks a PENDING_WA order PAID and the metrics refresh', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'ADMIN', orders: [makeOrder()] })
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: 'Dasbor Admin' })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Ringkasan operasional' }),
    ).toBeVisible()
    await expect(page.getByRole('group', { name: 'Total pendapatan' })).toContainText('Rp 0')
    await expect(page.getByRole('group', { name: 'Pesanan menunggu' })).toContainText('1')
    await expect(page.getByRole('group', { name: 'Pesanan menunggu' })).toContainText(
      'Rp 570.000 menunggu konfirmasi',
    )
    await expect(page.getByRole('list', { name: 'Pendapatan lunas per bulan' })).toBeVisible()
    await expect(page.getByText('Set Suara & Pasir')).toBeVisible()

    await nav(page).getByRole('button', { name: 'Pesanan' }).click()
    await expect(page).toHaveURL(/[?&]tab=orders/)
    const toggle = page.getByRole('button', { name: 'Detail pesanan RUMI-2026-0001' })
    const row = page.getByRole('row').filter({ has: toggle })
    await expect(row).toContainText('Menunggu Konfirmasi')
    await expect(row).toContainText('Rp 570.000')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Kit Nampan Tangan Kecil ×2')).toBeVisible()
    await expect(page.getByText('Jl. Kemang Raya 12, Jakarta Selatan')).toBeVisible()

    await page.getByRole('button', { name: 'Tandai Lunas pesanan RUMI-2026-0001' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tandai RUMI-2026-0001 lunas?' })
    await expect(dialog).toContainText('Rp 570.000')
    await dialog.getByRole('button', { name: 'Ya, tandai lunas' }).click()
    await expect(page.getByText('Pesanan RUMI-2026-0001 ditandai lunas.').first()).toBeVisible()
    await expect(row).toContainText('Lunas')
    await expect(page.getByRole('button', { name: /Tandai Lunas pesanan/ })).toHaveCount(0)
    expect(
      mock.calls.find((c) => c.method === 'PATCH' && c.path === '/api/admin/orders/1/status')?.body,
    ).toEqual({ status: 'PAID' })

    await nav(page).getByRole('button', { name: 'Ringkasan' }).click()
    await expect(page.getByRole('group', { name: 'Total pendapatan' })).toContainText('Rp 570.000')
    await expect(page.getByRole('group', { name: 'Pesanan lunas' })).toContainText('1')
    await expect(page.getByRole('group', { name: 'Pesanan menunggu' })).toContainText('Rp 0')
  })

  test('an order that changed meanwhile (409 invalid_transition) reloads with a toast', async ({
    page,
  }) => {
    await installMockBackend(page, {
      as: 'ADMIN',
      orders: [makeOrder()],
      failures: {
        'PATCH /api/admin/orders/1/status': {
          status: 409,
          code: 'invalid_transition',
          error: 'Status tidak dapat diubah dari CANCELLED ke PAID.',
        },
      },
    })
    await page.goto('/admin/dashboard?tab=orders')
    await page.getByRole('button', { name: 'Tandai Lunas pesanan RUMI-2026-0001' }).click()
    await page.getByRole('button', { name: 'Ya, tandai lunas' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(
      page.getByText('Status tidak dapat diubah dari CANCELLED ke PAID.').first(),
    ).toBeVisible()
  })

  test('creates, edits and deletes a kit through the ResourceManager', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'ADMIN' })
    await page.goto('/admin/dashboard')
    await nav(page).getByRole('button', { name: 'Kit' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Kit edukasi' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Daftar kit' })).toContainText('Taman Berhitung')

    await page.getByRole('button', { name: 'Tambah kit' }).click()
    const create = page.getByRole('dialog', { name: 'Tambah kit' })
    await create.getByRole('button', { name: 'Simpan' }).click()
    await expect(create.getByRole('alert')).toContainText('Periksa kembali isian yang ditandai.')
    await create.getByLabel('Nama kit').fill('Kit Uji')
    await create.getByLabel('Kategori (ranah)').selectOption({ label: 'Bahasa' })
    await create.getByLabel('Harga (Rp)').fill('99.000')
    await expect(create.getByText('Tampil sebagai Rp 99.000')).toBeVisible()
    await create.getByLabel('Stok').fill('3')
    await create.getByLabel('Deskripsi').fill('Kartu huruf untuk uji coba.')
    await create.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('Kit Uji berhasil ditambahkan.').first()).toBeVisible()
    const table = page.getByRole('table', { name: 'Daftar kit' })
    await expect(table.getByRole('row', { name: /Kit Uji/ })).toContainText('3 unit')
    expect(
      mock.calls.find((c) => c.method === 'POST' && c.path === '/api/admin/kits')?.body,
    ).toEqual({
      name: 'Kit Uji',
      category: 'LANGUAGE',
      price_idr: 99000,
      stock: 3,
      description: 'Kartu huruf untuk uji coba.',
      badge_tag: null,
      image_url: null,
      is_active: true,
    })

    await page.getByRole('button', { name: 'Ubah Kit Uji' }).click()
    const edit = page.getByRole('dialog', { name: 'Ubah Kit Uji' })
    await expect(edit.getByLabel('Nama kit')).toHaveValue('Kit Uji')
    await edit.getByLabel('Stok').fill('9')
    await edit.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('Kit Uji berhasil diperbarui.').first()).toBeVisible()
    await expect(table.getByRole('row', { name: /Kit Uji/ })).toContainText('9 unit')
    const patch = mock.calls.find(
      (c) => c.method === 'PATCH' && c.path.startsWith('/api/admin/kits/'),
    )
    expect(patch?.body).toEqual({ stock: 9 })

    await page.getByRole('button', { name: 'Hapus Kit Uji' }).click()
    await page
      .getByRole('dialog', { name: 'Hapus Kit Uji?' })
      .getByRole('button', { name: 'Ya, hapus' })
      .click()
    await expect(page.getByText('Kit Uji sudah dihapus.').first()).toBeVisible()
    await expect(table.getByRole('row', { name: /Kit Uji/ })).toHaveCount(0)
  })

  test('a delete blocked by active enrollments (409) stays in the dialog', async ({ page }) => {
    await installMockBackend(page, {
      as: 'ADMIN',
      failures: {
        'DELETE /api/admin/classes/1': {
          status: 409,
          code: 'conflict',
          error: 'Kelas masih memiliki peserta aktif.',
        },
      },
    })
    await page.goto('/admin/dashboard?tab=classes')
    await page.getByRole('button', { name: 'Hapus Bulan & Gerak' }).click()
    const dialog = page.getByRole('dialog', { name: 'Hapus Bulan & Gerak?' })
    await dialog.getByRole('button', { name: 'Ya, hapus' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Kelas masih memiliki peserta aktif.')
    await expect(dialog).toBeVisible()
  })

  test('the CMS JSON editor is validated against the section shape', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'ADMIN' })
    await page.goto('/admin/dashboard?tab=content')
    await page.getByRole('button', { name: 'Ubah Hero Beranda' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ubah Hero Beranda' })
    await expect(dialog.getByLabel('Halaman')).toBeDisabled()
    await dialog.getByLabel('Isi (JSON)').fill('{"eyebrow": "Sabtu pagi"}')
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(dialog.getByText('Kunci “heading” wajib ada.')).toBeVisible()
    await dialog.getByLabel('Isi (JSON)').fill('{oops')
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(dialog.getByText('Format JSON tidak valid.')).toBeVisible()
    expect(mock.calls.some((c) => c.method === 'PATCH')).toBe(false)
  })

  test('marks attendance and logs an assessment from the student profile', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'ADMIN' })
    await page.goto('/admin/dashboard')
    await nav(page).getByRole('button', { name: 'Siswa' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Direktori siswa' })).toBeVisible()
    await page.getByRole('button', { name: 'Lihat profil Amina' }).click()
    const dialog = page.getByRole('dialog', { name: 'Amina' })
    await expect(dialog).toContainText('Nadia Rahman')
    await expect(
      dialog.getByRole('link', { name: 'Hubungi Nadia Rahman via WhatsApp (membuka tab baru)' }),
    ).toHaveAttribute('href', 'https://wa.me/6281211112222')

    const enrollment = dialog.getByRole('row', { name: /Mengenal Syukur/ })
    await expect(enrollment).toContainText('Hadir')
    await dialog.getByRole('button', { name: 'Tandai tidak hadir di Mengenal Syukur' }).click()
    await expect(
      page.getByText('Kehadiran Amina di Mengenal Syukur tersimpan.').first(),
    ).toBeVisible()
    await expect(enrollment).toContainText('Tidak Hadir')
    expect(
      mock.calls.find((c) => c.method === 'PATCH' && c.path === '/api/admin/enrollments/1')?.body,
    ).toEqual({ status: 'ABSENT' })

    await dialog.getByRole('combobox', { name: /^Ranah/ }).selectOption({ label: 'Bahasa' })
    await dialog
      .getByRole('combobox', { name: /^Tingkat/ })
      .selectOption({ label: '2 · Berkembang' })
    await dialog.getByRole('textbox', { name: /^Capaian/ }).fill('Mengenali bunyi huruf alif')
    await dialog.getByRole('button', { name: 'Simpan penilaian' }).click()
    await expect(page.getByText('Penilaian Amina tersimpan.').first()).toBeVisible()
    await expect(dialog.getByText('Mengenali bunyi huruf alif')).toBeVisible()
    expect(
      mock.calls.find((c) => c.method === 'POST' && c.path === '/api/admin/assessments')?.body,
    ).toEqual({
      child_id: 1,
      domain: 'LANGUAGE',
      level: 2,
      milestone: 'Mengenali bunyi huruf alif',
      notes: null,
      observed_on: todayWib(),
      class_id: null,
    })
  })

  test('the assessment class picker lists only attended or confirmed past classes', async ({
    page,
  }) => {
    await installMockBackend(page, {
      as: 'ADMIN',
      enrollments: [
        makeEnrollment({
          id: 1,
          class_id: 1,
          class_title: 'Mengenal Syukur',
          class_date: '2026-01-17',
          status: 'ATTENDED',
        }),
        makeEnrollment({
          id: 2,
          class_id: 2,
          class_title: 'Kelas Batal',
          class_date: '2026-02-07',
          status: 'CANCELLED',
        }),
        makeEnrollment({
          id: 3,
          class_id: 3,
          class_title: 'Kelas Nanti',
          class_date: '2099-01-03',
          status: 'CONFIRMED',
        }),
      ],
    })
    await page.goto('/admin/dashboard?tab=students')
    await page.getByRole('button', { name: 'Lihat profil Amina' }).click()
    const dialog = page.getByRole('dialog', { name: 'Amina' })
    const picker = dialog.getByRole('combobox', { name: /^Kelas terkait/ })
    const options = await picker.locator('option').allTextContents()
    expect(options).toEqual(['Tanpa kelas', 'Mengenal Syukur · 17 Jan 2026'])
  })

  test('student search narrows the directory', async ({ page }) => {
    await installMockBackend(page, { as: 'ADMIN' })
    await page.goto('/admin/dashboard?tab=students')
    await expect(page.getByRole('table', { name: 'Daftar siswa' })).toContainText('Amina')
    await page.getByLabel('Cari siswa').fill('tidak-ada')
    await expect(page.getByRole('heading', { name: 'Siswa tidak ditemukan' })).toBeVisible()
  })
})
