import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from './button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from './dialog'

function Demo({ wide = false }: { wide?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Buka</Button>
      </DialogTrigger>
      <DialogContent size={wide ? 'wide' : 'default'}>
        <DialogHeader title="Detail kelas" description="Isi dialog." />
        <DialogFooter>
          <DialogClose asChild>
            <Button>Selesai</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('opens with a title, closes with "Tutup" and returns focus', async () => {
    render(<Demo />)
    const trigger = screen.getByRole('button', { name: 'Buka' })
    await userEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Detail kelas' })
    expect(dialog).toHaveAccessibleDescription('Isi dialog.')
    expect(dialog.className).toContain('rounded-t-modal')
    expect(dialog.className).toContain('max-w-lg')
    await userEvent.click(screen.getByRole('button', { name: 'Tutup' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape and supports the wide size', async () => {
    render(<Demo wide />)
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }))
    expect(screen.getByRole('dialog').className).toContain('max-w-3xl')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('can hide the close button', async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader title="Tanpa tutup" hideClose />
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Tanpa tutup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tutup' })).toBeNull()
  })
})
