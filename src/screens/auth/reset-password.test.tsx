import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { renderWithRouter } from '@/test/render'
import { ResetPasswordScreen } from './reset-password'

afterEach(() => window.history.replaceState(null, '', '/'))

async function submit(route: string) {
  const reset = vi.spyOn(api, 'resetPassword').mockResolvedValue(null)
  const user = userEvent.setup()
  renderWithRouter(<ResetPasswordScreen />, { route })
  await user.type(screen.getByLabelText(/Kata sandi baru/), 'kata-sandi-baru')
  await user.type(screen.getByLabelText(/Ulangi kata sandi/), 'kata-sandi-baru')
  await user.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }))
  await screen.findByRole('heading', { name: 'Kata sandi berhasil diubah' })
  return reset
}

describe('ResetPasswordScreen', () => {
  it('reads the token from the URL fragment', async () => {
    const reset = await submit('/reset-password#token=dari-fragmen')
    expect(reset).toHaveBeenCalledWith({ token: 'dari-fragmen', password: 'kata-sandi-baru' })
  })

  it('still accepts a legacy ?token= link', async () => {
    const reset = await submit('/reset-password?token=tautan-lama')
    expect(reset).toHaveBeenCalledWith({ token: 'tautan-lama', password: 'kata-sandi-baru' })
  })

  it('strips the token from the address bar on load', () => {
    window.history.pushState(null, '', '/reset-password#token=rahasia')
    renderWithRouter(<ResetPasswordScreen />, { route: '/reset-password#token=rahasia' })
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/reset-password')
  })

  it('offers a new link when no token is present', () => {
    renderWithRouter(<ResetPasswordScreen />, { route: '/reset-password' })
    expect(screen.getByRole('alert')).toHaveTextContent('Tautan tidak valid')
  })
})
