/**
 * Auth journeys (PRD §5.8.3): login (validation, invalid_credentials,
 * rate_limited, role/next redirects), the 3-step register (happy path and
 * email_taken back to step 1), forgot-password and reset-password.
 */
import { expect, test } from '@playwright/test'
import { ADMIN_PASSWORD, installMockBackend, PARENT_PASSWORD, RESET_TOKEN } from './mock-backend'

test.describe('/login', () => {
  test('validates, rejects bad credentials, then redirects to next', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/login?next=%2Fweekend-classes%3Fage%3D4')
    await expect(page.getByRole('heading', { level: 1, name: 'Masuk' })).toBeVisible()
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page.getByText('Wajib diisi.').first()).toBeVisible()
    await expect(page.getByLabel('Email')).toBeFocused()

    await page.getByLabel('Email').fill('nadia@example.com')
    await page.getByLabel('Kata sandi').fill('salah-sandi')
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.')

    await page.getByLabel('Kata sandi').fill(PARENT_PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL('/weekend-classes?age=4')
  })

  test('an admin lands on the admin dashboard; open redirects are ignored', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/login?next=%2F%2Fevil.example')
    await page.getByLabel('Email').fill('admin@rumi.id')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL('/admin/dashboard')
  })

  test('shows the rate-limit message with the retry delay', async ({ page }) => {
    await installMockBackend(page, {
      failures: {
        'POST /api/auth/login': {
          status: 429,
          code: 'rate_limited',
          error: 'Terlalu banyak percobaan.',
          retryAfter: 30,
        },
      },
    })
    await page.goto('/login')
    await page.getByLabel('Email').fill('nadia@example.com')
    await page.getByLabel('Kata sandi').fill(PARENT_PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'Terlalu banyak percobaan. Coba lagi dalam 30 detik.',
    )
  })

  test('links to register and forgot password', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/login')
    await expect(page.getByRole('link', { name: 'Daftar sekarang' })).toHaveAttribute(
      'href',
      '/register',
    )
    await page.getByRole('link', { name: 'Lupa kata sandi?' }).click()
    await expect(page).toHaveURL('/forgot-password')
  })
})

test.describe('/register', () => {
  async function fillParent(page: import('@playwright/test').Page, email: string) {
    await page.getByLabel('Nama lengkap').fill('Siti Aminah')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Nomor WhatsApp').fill('0812-3456-7890')
    await page.getByLabel('Kata sandi', { exact: false }).first().fill('rahasia-123')
    await page.getByLabel('Ulangi kata sandi').fill('rahasia-123')
    await page.getByRole('button', { name: 'Lanjut' }).click()
  }

  async function fillChild(page: import('@playwright/test').Page) {
    await page.getByLabel('Nama anak').fill('Yusuf')
    await page.getByLabel('Tanggal lahir').fill('2021-05-10')
    await page.getByLabel(/Catatan untuk pendamping/).fill('Alergi kacang')
    await page.getByRole('button', { name: 'Lanjut' }).click()
  }

  test('three steps → atomic register → Ahlan wa sahlan', async ({ page }) => {
    const mock = await installMockBackend(page)
    await page.goto('/register')
    const stepper = page.getByRole('list', { name: 'Langkah' })
    await expect(stepper.locator('[aria-current="step"]')).toContainText('Orang tua')

    await page.getByRole('button', { name: 'Lanjut' }).click()
    await expect(page.getByText('Wajib diisi.').first()).toBeVisible()
    await fillParent(page, 'siti@example.com')
    await expect(stepper.locator('[aria-current="step"]')).toContainText('Anak')
    await fillChild(page)
    await expect(stepper.locator('[aria-current="step"]')).toContainText('Konfirmasi')
    await expect(page.getByText('6281234567890')).toBeVisible()
    await page.getByRole('button', { name: 'Buat akun' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Ahlan wa sahlan, Siti Aminah!',
    )
    await expect(page.getByText('Ahlan wa sahlan! Akun Anda sudah aktif.').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Buka dasbor orang tua' })).toHaveAttribute(
      'href',
      '/parent/dashboard',
    )
    const call = mock.calls.find((c) => c.method === 'POST' && c.path === '/api/auth/register')
    expect(call?.body).toEqual({
      parent: {
        full_name: 'Siti Aminah',
        email: 'siti@example.com',
        phone_wa: '6281234567890',
        password: 'rahasia-123',
      },
      child: { name: 'Yusuf', dob: '2021-05-10', notes: 'Alergi kacang' },
    })
    expect(JSON.stringify(call?.body)).not.toContain('role')
  })

  test('email_taken sends the parent back to step 1 with the error on email', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/register')
    await fillParent(page, 'nadia@example.com')
    await fillChild(page)
    await page.getByRole('button', { name: 'Buat akun' }).click()
    const stepper = page.getByRole('list', { name: 'Langkah' })
    await expect(stepper.locator('[aria-current="step"]')).toContainText('Orang tua')
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert')).toContainText('Email sudah terdaftar. Silakan masuk.')
    await expect(page.getByLabel('Nama lengkap')).toHaveValue('Siti Aminah')
  })
})

test.describe('password reset', () => {
  test('forgot-password always shows the same neutral message', async ({ page }) => {
    const mock = await installMockBackend(page)
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill('Tidak.Ada@Example.com')
    await page.getByRole('button', { name: 'Kirim tautan reset' }).click()
    await expect(page.getByRole('heading', { name: 'Periksa email Anda' })).toBeVisible()
    await expect(page.getByText(/Jika tidak\.ada@example\.com terdaftar di RUMI/)).toBeVisible()
    const call = mock.calls.find((c) => c.path === '/api/auth/forgot-password')
    expect(call?.body).toEqual({ email: 'tidak.ada@example.com' })
  })

  test('reset-password sets a new password and points to login', async ({ page }) => {
    await installMockBackend(page)
    await page.goto(`/reset-password?token=${RESET_TOKEN}`)
    await page.getByLabel('Kata sandi baru').fill('kata-sandi-baru')
    await page.getByLabel('Ulangi kata sandi').fill('beda-sandi-123')
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click()
    await expect(page.getByText('Konfirmasi kata sandi tidak sama.')).toBeVisible()
    await page.getByLabel('Ulangi kata sandi').fill('kata-sandi-baru')
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click()
    await expect(page.getByRole('heading', { name: 'Kata sandi berhasil diubah' })).toBeVisible()
    await page.getByRole('link', { name: 'Masuk sekarang' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('an invalid or missing token offers a new link', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/reset-password?token=kedaluwarsa')
    await page.getByLabel('Kata sandi baru').fill('kata-sandi-baru')
    await page.getByLabel('Ulangi kata sandi').fill('kata-sandi-baru')
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click()
    await expect(page.getByRole('alert')).toContainText('Tautan tidak valid')
    await page.getByRole('link', { name: 'Minta tautan baru' }).click()
    await expect(page).toHaveURL('/forgot-password')

    await page.goto('/reset-password')
    await expect(page.getByRole('alert')).toContainText('Tautan tidak valid')
  })
})
