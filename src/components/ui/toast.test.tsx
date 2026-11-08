import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ToastProvider, useToast } from './toast'

function Trigger() {
  const { toast, dismissAll } = useToast()
  return (
    <>
      <button type="button" onClick={dismissAll}>
        tutup semua
      </button>
      <button type="button" onClick={() => toast('Kit ditambahkan ke keranjang.')}>
        sukses
      </button>
      <button type="button" onClick={() => toast('Stok tidak mencukupi.', 'error')}>
        galat
      </button>
    </>
  )
}

describe('Toast', () => {
  it('shows success and error toasts', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'sukses' }))
    await userEvent.click(screen.getByRole('button', { name: 'galat' }))
    expect(await screen.findAllByText('Kit ditambahkan ke keranjang.')).not.toHaveLength(0)
    expect(await screen.findAllByText('Stok tidak mencukupi.')).not.toHaveLength(0)
  })

  it('removes a toast once dismissed', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'sukses' }))
    const toast = (await screen.findAllByText('Kit ditambahkan ke keranjang.'))[0].closest('li')
    expect(toast).not.toBeNull()
    await act(async () => {
      toast?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
  })

  it('dismisses every open toast at once', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'sukses' }))
    await userEvent.click(screen.getByRole('button', { name: 'galat' }))
    expect(await screen.findAllByText('Stok tidak mencukupi.')).not.toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'tutup semua' }))
    await waitFor(() => {
      expect(screen.queryByText('Kit ditambahkan ke keranjang.')).toBeNull()
      expect(screen.queryByText('Stok tidak mencukupi.')).toBeNull()
    })
  })

  it('is a no-op outside the provider', () => {
    function Lonely() {
      const { toast, dismissAll } = useToast()
      toast('x')
      dismissAll()
      return null
    }
    expect(() => render(<Lonely />)).not.toThrow()
  })
})
