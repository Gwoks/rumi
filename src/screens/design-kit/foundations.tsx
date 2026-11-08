/** /design-kit 01–02: palette swatches (click to copy the computed hex) and the type scale. */
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { t, type CopyKey } from '@/lib/copy'
import { readTokenHex } from '@/lib/color'
import { FOCUS } from '@/lib/styles'
import { DemoLabel, KitSection } from './kit-section'

interface Swatch {
  nameKey: CopyKey
  cssVar: string
  className: string
}

const SWATCHES: readonly Swatch[] = [
  { nameKey: 'designKit.swatch.primary', cssVar: '--color-primary', className: 'bg-primary' },
  {
    nameKey: 'designKit.swatch.primaryStrong',
    cssVar: '--color-primary-strong',
    className: 'bg-primary-strong',
  },
  {
    nameKey: 'designKit.swatch.primarySoft',
    cssVar: '--color-primary-soft',
    className: 'bg-primary-soft',
  },
  { nameKey: 'designKit.swatch.accent', cssVar: '--color-accent', className: 'bg-accent' },
  {
    nameKey: 'designKit.swatch.accentStrong',
    cssVar: '--color-accent-strong',
    className: 'bg-accent-strong',
  },
  {
    nameKey: 'designKit.swatch.accentSoft',
    cssVar: '--color-accent-soft',
    className: 'bg-accent-soft',
  },
  { nameKey: 'designKit.swatch.highlight', cssVar: '--color-highlight', className: 'bg-highlight' },
  {
    nameKey: 'designKit.swatch.highlightStrong',
    cssVar: '--color-highlight-strong',
    className: 'bg-highlight-strong',
  },
  {
    nameKey: 'designKit.swatch.highlightSoft',
    cssVar: '--color-highlight-soft',
    className: 'bg-highlight-soft',
  },
  { nameKey: 'designKit.swatch.canvas', cssVar: '--color-canvas', className: 'bg-canvas' },
  { nameKey: 'designKit.swatch.surface', cssVar: '--color-surface', className: 'bg-surface' },
  { nameKey: 'designKit.swatch.ink', cssVar: '--color-ink', className: 'bg-ink' },
  {
    nameKey: 'designKit.swatch.inkSecondary',
    cssVar: '--color-ink-secondary',
    className: 'bg-ink-secondary',
  },
  { nameKey: 'designKit.swatch.border', cssVar: '--color-border', className: 'bg-border' },
  { nameKey: 'designKit.swatch.danger', cssVar: '--color-danger', className: 'bg-danger' },
]

function SwatchButton({ swatch }: { swatch: Swatch }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const hex = readTokenHex(swatch.cssVar) ?? swatch.cssVar
  const name = t(swatch.nameKey)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      toast(t('designKit.swatch.copied', { hex }))
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast(t('designKit.swatch.copyFailed', { hex }), 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={t('designKit.swatch.copyAria', { name, hex })}
      className={cn(
        'group overflow-hidden rounded-2xl border border-border bg-surface text-left transition hover:shadow-card motion-safe:hover:-translate-y-1',
        FOCUS,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('block h-20 border-b border-border-subtle', swatch.className)}
      />
      <span className="block p-3">
        <span className="block text-body-sm font-semibold text-ink">{name}</span>
        <span className="mt-1 flex items-center gap-1 font-mono text-caption text-ink-secondary">
          {copied ? (
            <Check aria-hidden="true" size={12} className="text-primary-strong" />
          ) : (
            <Copy aria-hidden="true" size={12} />
          )}
          {hex}
        </span>
        <span className="mt-0.5 block font-mono text-caption text-ink-tertiary">
          {swatch.cssVar}
        </span>
      </span>
    </button>
  )
}

const TYPE_SCALE: readonly {
  token: string
  className: string
  spec: string
  sampleKey: CopyKey
}[] = [
  {
    token: 'display-lg',
    className: 'text-display-lg',
    spec: '60 / 1.05 / 600',
    sampleKey: 'designKit.type.sample.display',
  },
  {
    token: 'display',
    className: 'text-display',
    spec: '48 / 1.05 / 600',
    sampleKey: 'designKit.type.sample.display',
  },
  {
    token: 'h1',
    className: 'text-h1',
    spec: '36 / 1.15 / 600',
    sampleKey: 'designKit.type.sample.heading',
  },
  {
    token: 'h2',
    className: 'text-h2',
    spec: '30 / 1.2 / 600',
    sampleKey: 'designKit.type.sample.heading',
  },
  {
    token: 'h3',
    className: 'text-h3',
    spec: '20 / 1.35 / 600',
    sampleKey: 'designKit.type.sample.heading',
  },
  {
    token: 'h4',
    className: 'text-h4',
    spec: '16 / 1.4 / 600',
    sampleKey: 'designKit.type.sample.heading',
  },
  {
    token: 'body-lg',
    className: 'text-body-lg',
    spec: '18 / 32 / 400',
    sampleKey: 'designKit.type.sample.body',
  },
  {
    token: 'body',
    className: 'text-body',
    spec: '16 / 28 / 400',
    sampleKey: 'designKit.type.sample.body',
  },
  {
    token: 'body-sm',
    className: 'text-body-sm',
    spec: '14 / 24 / 400',
    sampleKey: 'designKit.type.sample.body',
  },
  {
    token: 'caption',
    className: 'text-caption',
    spec: '12 / 18 / 400',
    sampleKey: 'designKit.type.sample.caption',
  },
  {
    token: 'eyebrow',
    className: 'text-eyebrow uppercase text-accent-strong',
    spec: '14 / 20 / 700',
    sampleKey: 'designKit.type.sample.eyebrow',
  },
  {
    token: 'overline',
    className: 'text-overline uppercase',
    spec: '12 / 16 / 700',
    sampleKey: 'designKit.type.sample.eyebrow',
  },
]

export function PaletteSection() {
  return (
    <KitSection
      id="palet"
      eyebrow={t('designKit.palette.eyebrow')}
      title={t('designKit.palette.title')}
      intro={t('designKit.palette.intro')}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SWATCHES.map((swatch) => (
          <SwatchButton key={swatch.cssVar} swatch={swatch} />
        ))}
      </div>
    </KitSection>
  )
}

export function TypeSection() {
  return (
    <KitSection
      id="tipografi"
      eyebrow={t('designKit.type.eyebrow')}
      title={t('designKit.type.title')}
      intro={t('designKit.type.intro')}
    >
      <Card padding="standard">
        <DemoLabel>{t('designKit.type.title')}</DemoLabel>
        <dl className="divide-y divide-border-subtle">
          {TYPE_SCALE.map((row) => (
            <div
              key={row.token}
              className="grid gap-2 py-4 sm:grid-cols-[160px_1fr] sm:items-baseline"
            >
              <dt className="font-mono text-caption text-ink-tertiary">
                text-{row.token}
                <span className="block">{row.spec}</span>
              </dt>
              <dd className={cn('min-w-0 break-words text-ink', row.className)}>
                {t(row.sampleKey)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </KitSection>
  )
}
