import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, EyebrowPill } from './badge'

describe('Badge', () => {
  it.each([
    ['success', 'bg-primary-soft'],
    ['pending', 'bg-highlight-soft'],
    ['attention', 'bg-accent-soft'],
    ['neutral', 'bg-surface-subtle'],
    ['danger', 'bg-danger-soft'],
  ] as const)('%s uses %s', (variant, cls) => {
    render(<Badge variant={variant}>Label</Badge>)
    expect(screen.getByText('Label').className).toContain(cls)
  })

  it('renders the eyebrow pill with a decorative dot', () => {
    const { container } = render(<EyebrowPill>Sabtu pagi</EyebrowPill>)
    expect(screen.getByText('Sabtu pagi')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
