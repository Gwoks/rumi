import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ToastProvider, useToast } from './toast'

function Trigger() {
  const { toast } = useToast()
  return (
    <>
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

  it('is a no-op outside the provider', () => {
    function Lonely() {
      const { toast } = useToast()
      toast('x')
      return null
    }
    expect(() => render(<Lonely />)).not.toThrow()
  })
})
