import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EducatorCard } from './educator-card'

const person = {
  name: 'Ustazah Mariam Yusuf',
  role: 'Guru Utama Montessori',
  bio: 'Membawa 12 tahun pengalaman pendidikan anak usia dini.',
  initials: 'MY',
  tone: 'orange' as const,
}

describe('EducatorCard', () => {
  it('renders a decorative initials tile in the tone, name, role and bio', () => {
    render(<EducatorCard person={person} />)
    const tile = screen.getByText('MY')
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    expect(tile).toHaveClass('bg-accent-soft')
    expect(
      screen.getByRole('heading', { level: 3, name: 'Ustazah Mariam Yusuf' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Guru Utama Montessori')).toBeInTheDocument()
    expect(screen.getByText(/12 tahun pengalaman/)).toBeInTheDocument()
  })

  it('supports a lower heading level', () => {
    render(<EducatorCard person={person} headingLevel="h4" />)
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Ustazah Mariam Yusuf')
  })
})
