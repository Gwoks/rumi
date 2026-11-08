import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CMS_SEED } from '@/test/cms-seed'
import { makeCmsPage, makeCmsSection } from '@/test/factories'
import { cmsBody, CmsIcon, InfoCard, ProseBlock } from './cms-section'

describe('cmsBody', () => {
  it('returns the validated body and its section', () => {
    const page = makeCmsPage('home')
    const hero = cmsBody(page, 'home', 'hero')
    expect(hero?.body.heading).toBe('Ruang kecil untuk')
    expect(hero?.section.section_key).toBe('hero')
  })

  it('returns null for a missing page, another page, a missing key or a malformed body', () => {
    const page = makeCmsPage('home')
    expect(cmsBody(undefined, 'home', 'hero')).toBeNull()
    expect(cmsBody(page, 'who-we-are', 'mission')).toBeNull()
    expect(cmsBody({ ...page, sections: [] }, 'home', 'hero')).toBeNull()
    const broken = { ...page, sections: [makeCmsSection({ body: { heading: 1 } })] }
    expect(cmsBody(broken, 'home', 'hero')).toBeNull()
  })

  it('skips inactive sections', () => {
    const page = { page_slug: 'home' as const, sections: [makeCmsSection({ is_active: false })] }
    expect(cmsBody(page, 'home', 'hero')).toBeNull()
  })
})

describe('CmsIcon', () => {
  it('renders a decorative lucide icon', () => {
    const { container } = render(<CmsIcon name="heart" size={18} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '18')
  })
})

describe('InfoCard', () => {
  it('renders the tinted icon chip, title and text', () => {
    render(
      <InfoCard icon="hands" tone="yellow" title="Tangan sebelum layar" text="Material nyata." />,
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'Tangan sebelum layar' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Material nyata.')).toBeInTheDocument()
    expect(document.querySelector('.bg-highlight-soft')).not.toBeNull()
  })
})

describe('ProseBlock', () => {
  it('renders the eyebrow, an h2 and every paragraph', () => {
    const body = CMS_SEED['who-we-are'].philosophy.body
    render(<ProseBlock id="p" body={body} />)
    expect(screen.getByRole('heading', { level: 2, name: body.heading })).toHaveAttribute('id', 'p')
    expect(screen.getByText(body.eyebrow)).toBeInTheDocument()
    for (const paragraph of body.paragraphs) expect(screen.getByText(paragraph)).toBeInTheDocument()
  })
})
