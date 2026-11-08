import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders a type="button" primary by default and handles clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Simpan</Button>)
    const button = screen.getByRole('button', { name: 'Simpan' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('bg-primary-strong')
    expect(button.className).toContain('focus-visible:outline-focus')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses dark text on the orange accent (never white)', () => {
    render(<Button variant="accent">Pesan via WhatsApp</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('bg-accent')
    expect(cls).toContain('text-accent-on')
  })

  it('shows a spinner, sets aria-busy and disables while loading', () => {
    render(<Button loading>Menyimpan</Button>)
    const button = screen.getByRole('button', { name: /Menyimpan/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Memuat…')
  })

  it('keeps the link variant auto-height and padding-free', () => {
    render(<Button variant="link">Lihat semua</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('h-auto')
    expect(cls).toContain('px-0')
    expect(cls).not.toContain('h-11')
  })

  it('renders onto a child with asChild', () => {
    render(
      <Button asChild variant="ghost">
        <a href="/login">Masuk</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Masuk' })
    expect(link.className).toContain('text-primary-strong')
  })
})
