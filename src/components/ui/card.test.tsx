import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardDescription, CardTitle, IconChip, InlineNote } from './card'

describe('Card family', () => {
  it('is flat by default and lifts only when interactive', () => {
    const { rerender } = render(<Card data-testid="card">x</Card>)
    expect(screen.getByTestId('card').className).toContain('border-border')
    expect(screen.getByTestId('card').className).not.toContain('shadow')
    rerender(
      <Card data-testid="card" variant="interactive">
        x
      </Card>,
    )
    expect(screen.getByTestId('card').className).toContain('hover:shadow-card')
  })

  it('paints tint cards with the tone soft surface', () => {
    render(
      <Card data-testid="tint" variant="tint" tone="yellow">
        x
      </Card>,
    )
    expect(screen.getByTestId('tint').className).toContain('bg-highlight-soft')
  })

  it('renders onto a semantic child with asChild', () => {
    render(
      <Card asChild>
        <article aria-label="Kelas">x</article>
      </Card>,
    )
    expect(screen.getByRole('article', { name: 'Kelas' }).className).toContain('rounded-2xl')
  })

  it('renders title, description, note and icon chips', () => {
    render(
      <>
        <CardTitle>Judul</CardTitle>
        <CardDescription>Isi</CardDescription>
        <InlineNote>Catatan</InlineNote>
        <IconChip tone="orange" size="sm">
          i
        </IconChip>
      </>,
    )
    expect(screen.getByRole('heading', { name: 'Judul', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Isi')).toBeInTheDocument()
    expect(screen.getByText('Catatan').className).toContain('bg-primary-soft')
    expect(screen.getByText('i').className).toContain('bg-accent-soft')
  })
})
