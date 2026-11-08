/**
 * DomainChart + DomainTrend (DESIGN.md "DomainChart" and "Trend line").
 *
 * - `DomainChart`: the latest level per Montessori domain (ChildReport
 *   `latest_levels`) as labelled bars in the canonical domain order. Every bar
 *   carries its level label and "(n/4)" as text — never color alone; a missing
 *   level reads "Belum ada catatan".
 * - `DomainTrend`: one domain's level history (assessments, oldest first) as a
 *   small inline SVG polyline with y ticks 1–4. The SVG is decorative; the same
 *   data is always given as a screen-reader list.
 *
 * Hand-rolled (no chart library), tokens only.
 */
import type { Assessment, AssessmentLevel, Domain, DomainLevel } from '@/api/schemas'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { DOMAINS, domainMeta, LEVELS, MAX_LEVEL } from '@/lib/domains'
import { formatDate } from '@/lib/format'

/** "Berlatih Mandiri" for 3; "Belum ada catatan" for null. */
export function levelLabel(level: AssessmentLevel | null): string {
  const meta = LEVELS.find((l) => l.level === level)
  return meta ? t(meta.labelKey) : t('common.level.none')
}

/** "Berlatih Mandiri (3/4)" for 3; "Belum ada catatan" for null. */
export function levelValueText(level: AssessmentLevel | null): string {
  if (level === null) return t('common.level.none')
  return t('parent.chart.levelValue', { label: levelLabel(level), level })
}

/** The five domains in canonical order, filling any domain missing from `levels`. */
export function orderedLevels(levels: readonly DomainLevel[]): DomainLevel[] {
  return DOMAINS.map(
    (d) =>
      levels.find((l) => l.domain === d.key) ?? {
        domain: d.key,
        level: null,
        observed_on: null,
        milestone: null,
      },
  )
}

export interface DomainChartProps {
  levels: readonly DomainLevel[]
  /** Show the latest milestone and its date under each bar. */
  showMilestones?: boolean
  /** Accessible name of the list (defaults to "Tingkat terbaru per ranah"). */
  label?: string
  className?: string
}

export function DomainChart({
  levels,
  showMilestones = false,
  label,
  className,
}: DomainChartProps) {
  return (
    <ul aria-label={label ?? t('parent.chart.listLabel')} className={cn('space-y-6', className)}>
      {orderedLevels(levels).map((item) => {
        const meta = domainMeta(item.domain)
        const name = t(meta.labelKey)
        const value = levelValueText(item.level)
        return (
          <li key={item.domain}>
            <div className="mb-2 flex flex-wrap justify-between gap-x-3 text-body-sm">
              <span className="font-semibold text-ink">{name}</span>
              <span className="text-ink-secondary">{value}</span>
            </div>
            <Progress
              value={item.level ?? 0}
              max={MAX_LEVEL}
              tone={meta.tone}
              label={t('parent.chart.barLabel', { domain: name, value })}
            />
            {showMilestones && item.milestone && item.observed_on && (
              <p className="mt-2 text-caption text-ink-secondary">
                {t('parent.chart.milestone', {
                  milestone: item.milestone,
                  date: formatDate(item.observed_on),
                })}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export interface TrendPoint {
  id: number
  observed_on: string
  level: AssessmentLevel
}

/** One domain's history, oldest first (observed_on ASC, id ASC). */
export function trendSeries(assessments: readonly Assessment[], domain: Domain): TrendPoint[] {
  return assessments
    .filter((a) => a.domain === domain)
    .map(({ id, observed_on, level }) => ({ id, observed_on, level }))
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.id - b.id)
}

// SVG geometry (user units; the SVG scales uniformly with its width).
export const TREND_VIEW = { width: 240, height: 96, left: 28, right: 12, top: 12, bottom: 12 }
const PLOT_WIDTH = TREND_VIEW.width - TREND_VIEW.left - TREND_VIEW.right
const PLOT_HEIGHT = TREND_VIEW.height - TREND_VIEW.top - TREND_VIEW.bottom

/** y for a level: 4 at the top, 1 at the bottom. */
export function trendY(level: number): number {
  return TREND_VIEW.top + ((MAX_LEVEL - level) * PLOT_HEIGHT) / (MAX_LEVEL - 1)
}

/** Evenly spaced x per point; a single point sits in the middle. */
export function trendCoordinates(points: readonly TrendPoint[]): { x: number; y: number }[] {
  const n = points.length
  return points.map((p, i) => ({
    x: n === 1 ? TREND_VIEW.left + PLOT_WIDTH / 2 : TREND_VIEW.left + (i * PLOT_WIDTH) / (n - 1),
    y: trendY(p.level),
  }))
}

function TrendSvg({ points }: { points: readonly TrendPoint[] }) {
  const coords = trendCoordinates(points)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${TREND_VIEW.width} ${TREND_VIEW.height}`}
      className="mt-3 h-auto w-full max-w-[240px]"
    >
      {LEVELS.map(({ level }) => (
        <g key={level}>
          <line
            x1={TREND_VIEW.left}
            x2={TREND_VIEW.width - TREND_VIEW.right}
            y1={trendY(level)}
            y2={trendY(level)}
            className="stroke-border-subtle"
            strokeWidth={1}
          />
          <text
            x={TREND_VIEW.left - 10}
            y={trendY(level)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-ink-tertiary text-caption"
          >
            {level}
          </text>
        </g>
      ))}
      {coords.length > 1 && (
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          className="fill-none stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {coords.map((c, i) => (
        <circle key={points[i].id} cx={c.x} cy={c.y} r={4} className="fill-primary-strong" />
      ))}
    </svg>
  )
}

export interface DomainTrendProps {
  domain: Domain
  assessments: readonly Assessment[]
  className?: string
}

export function DomainTrend({ domain, assessments, className }: DomainTrendProps) {
  const name = t(domainMeta(domain).labelKey)
  const points = trendSeries(assessments, domain)
  const latest = points.at(-1)
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="text-body-sm">
        <span className="block font-semibold text-ink">{name}</span>
        <span className="block text-ink-secondary">
          {latest
            ? t('parent.chart.trendLatest', { value: levelValueText(latest.level) })
            : t('common.level.none')}
        </span>
      </figcaption>
      {points.length > 0 && (
        <>
          <TrendSvg points={points} />
          <ol className="sr-only" aria-label={t('parent.chart.trendList', { domain: name })}>
            {points.map((p) => (
              <li key={p.id}>
                {t('parent.chart.trendPoint', {
                  date: formatDate(p.observed_on),
                  value: levelValueText(p.level),
                })}
              </li>
            ))}
          </ol>
        </>
      )}
    </figure>
  )
}
