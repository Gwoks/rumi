import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeAssessment, makeDomainLevels } from '@/test/factories'
import {
  DomainChart,
  DomainTrend,
  levelLabel,
  levelValueText,
  orderedLevels,
  trendCoordinates,
  trendSeries,
  trendY,
  TREND_VIEW,
} from './domain-chart'

const HISTORY = [
  makeAssessment({ id: 3, domain: 'PRACTICAL_LIFE', level: 3, observed_on: '2026-10-24' }),
  makeAssessment({ id: 1, domain: 'PRACTICAL_LIFE', level: 2, observed_on: '2026-01-17' }),
  makeAssessment({ id: 2, domain: 'ISLAMIC_STUDIES', level: 2, observed_on: '2026-01-17' }),
  makeAssessment({ id: 4, domain: 'PRACTICAL_LIFE', level: 4, observed_on: '2026-10-24' }),
]

describe('level text helpers', () => {
  it('labels levels 1–4 and a missing level', () => {
    expect(levelLabel(1)).toBe('Mulai Mengenal')
    expect(levelLabel(null)).toBe('Belum ada catatan')
    expect(levelValueText(3)).toBe('Berlatih Mandiri (3/4)')
    expect(levelValueText(null)).toBe('Belum ada catatan')
  })

  it('fills missing domains in canonical order', () => {
    const ordered = orderedLevels([
      { domain: 'MATH', level: 2, observed_on: '2026-10-24', milestone: 'Menghitung' },
    ])
    expect(ordered.map((l) => l.domain)).toEqual([
      'PRACTICAL_LIFE',
      'SENSORIAL',
      'LANGUAGE',
      'MATH',
      'ISLAMIC_STUDIES',
    ])
    expect(ordered[3].level).toBe(2)
    expect(ordered[0].level).toBeNull()
  })
})

describe('DomainChart', () => {
  it('renders one labelled bar per domain with text values (never color-only)', () => {
    render(<DomainChart levels={makeDomainLevels([makeAssessment()])} showMilestones />)
    const list = screen.getByRole('list', { name: 'Tingkat terbaru per ranah' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('Kehidupan Praktis')
    expect(rows[0]).toHaveTextContent('Berlatih Mandiri (3/4)')
    expect(rows[0]).toHaveTextContent(
      'Memilih kegiatan menuang tiga kali dan merapikannya sendiri · 24 Okt 2026',
    )
    expect(rows[1]).toHaveTextContent('Belum ada catatan')
    const bar = screen.getByRole('progressbar', {
      name: 'Kehidupan Praktis: Berlatih Mandiri (3/4)',
    })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    expect(
      screen.getByRole('progressbar', { name: 'Sensorial: Belum ada catatan' }),
    ).toHaveAttribute('aria-valuenow', '0')
  })

  it('hides milestones by default and accepts a custom label', () => {
    render(<DomainChart levels={makeDomainLevels()} label="Peta belajar" />)
    expect(screen.getByRole('list', { name: 'Peta belajar' })).toBeInTheDocument()
    expect(screen.queryByText(/Memilih kegiatan menuang/)).toBeNull()
  })
})

describe('trend helpers', () => {
  it('builds a per-domain series, oldest first (observed_on, then id)', () => {
    expect(trendSeries(HISTORY, 'PRACTICAL_LIFE')).toEqual([
      { id: 1, observed_on: '2026-01-17', level: 2 },
      { id: 3, observed_on: '2026-10-24', level: 3 },
      { id: 4, observed_on: '2026-10-24', level: 4 },
    ])
    expect(trendSeries(HISTORY, 'MATH')).toEqual([])
  })

  it('maps level 4 to the top and level 1 to the bottom of the plot', () => {
    expect(trendY(4)).toBe(TREND_VIEW.top)
    expect(trendY(1)).toBe(TREND_VIEW.height - TREND_VIEW.bottom)
  })

  it('spreads points across the plot and centers a single point', () => {
    const series = trendSeries(HISTORY, 'PRACTICAL_LIFE')
    const coords = trendCoordinates(series)
    expect(coords[0].x).toBe(TREND_VIEW.left)
    expect(coords[2].x).toBe(TREND_VIEW.width - TREND_VIEW.right)
    const [single] = trendCoordinates(trendSeries(HISTORY, 'ISLAMIC_STUDIES'))
    expect(single.x).toBe(
      TREND_VIEW.left + (TREND_VIEW.width - TREND_VIEW.left - TREND_VIEW.right) / 2,
    )
  })
})

describe('DomainTrend', () => {
  it('draws a polyline and repeats the data as a screen-reader list', () => {
    const { container } = render(<DomainTrend domain="PRACTICAL_LIFE" assessments={HISTORY} />)
    expect(screen.getByText('Kehidupan Praktis')).toBeInTheDocument()
    expect(screen.getByText('Terakhir: Menguasai (4/4)')).toBeInTheDocument()
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('points')?.split(' ')).toHaveLength(3)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    const list = screen.getByRole('list', { name: 'Riwayat tingkat Kehidupan Praktis' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '17 Jan 2026: Berkembang (2/4)',
      '24 Okt 2026: Berlatih Mandiri (3/4)',
      '24 Okt 2026: Menguasai (4/4)',
    ])
  })

  it('shows a single point without a line', () => {
    const { container } = render(<DomainTrend domain="ISLAMIC_STUDIES" assessments={HISTORY} />)
    expect(container.querySelector('polyline')).toBeNull()
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('says "Belum ada catatan" and draws nothing without history', () => {
    const { container } = render(<DomainTrend domain="MATH" assessments={HISTORY} />)
    expect(screen.getByText('Belum ada catatan')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })
})
