/**
 * RBAC bounces in the SPA (PRD §5.3.1; the API enforces the same rules):
 * anonymous visitors go to /login?next=<path+search>, a signed-in user on
 * the other role's pages goes to their own dashboard, and a session that
 * expires mid-use (401 `unauthorized` from any call) returns to the login.
 */
import { expect, test } from '@playwright/test'
import { installMockBackend } from './mock-backend'

test.describe('RBAC', () => {
  test('anonymous visitors are sent to the login with next=', async ({ page }) => {
    await installMockBackend(page)
    await page.goto('/admin/dashboard?tab=orders')
    await expect(page).toHaveURL('/login?next=%2Fadmin%2Fdashboard%3Ftab%3Dorders')
    await page.goto('/parent/report/1')
    await expect(page).toHaveURL('/login?next=%2Fparent%2Freport%2F1')
  })

  test('a parent visiting the admin dashboard lands on the parent dashboard', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'PARENT' })
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL('/parent/dashboard')
    await expect(page.getByRole('heading', { name: 'Perjalanan Amina di RUMI' })).toBeVisible()
    expect(mock.calls.some((c) => c.path.startsWith('/api/admin/'))).toBe(false)
  })

  test('an admin visiting parent pages lands on the admin dashboard', async ({ page }) => {
    const mock = await installMockBackend(page, { as: 'ADMIN' })
    await page.goto('/parent/dashboard')
    await expect(page).toHaveURL('/admin/dashboard')
    await page.goto('/parent/report/1')
    await expect(page).toHaveURL('/admin/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: 'Dasbor Admin' })).toBeVisible()
    expect(mock.calls.some((c) => c.path.startsWith('/api/me/'))).toBe(false)
  })

  test('a session that expires mid-use returns to the login', async ({ page }) => {
    await installMockBackend(page, {
      as: 'PARENT',
      failures: {
        'GET /api/me/orders': {
          status: 401,
          code: 'unauthorized',
          error: 'Silakan masuk terlebih dahulu.',
        },
      },
    })
    await page.goto('/parent/dashboard?tab=orders')
    await expect(page).toHaveURL('/login?next=%2Fparent%2Fdashboard%3Ftab%3Dorders')
  })
})
