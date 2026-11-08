import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from './button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from './drawer'

describe('Drawer', () => {
  it('opens as a right sheet and closes with "Tutup"', async () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <Button>Keranjang</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader title="Keranjang" />
          <DrawerBody>Isi</DrawerBody>
          <DrawerFooter>Total</DrawerFooter>
        </DrawerContent>
      </Drawer>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Keranjang' }))
    const panel = screen.getByRole('dialog', { name: 'Keranjang' })
    expect(panel.className).toContain('animate-sheet-in-right')
    expect(screen.getByText('Total')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tutup' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders an explicit description', () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader title="Laci" description="Keterangan laci." />
        </DrawerContent>
      </Drawer>,
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Keterangan laci.')
  })
})
