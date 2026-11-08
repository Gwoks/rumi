/**
 * Montessori domains, tones, levels and CMS icons (DESIGN.md "Domain, tone and
 * status mapping"; PRD §5.5, §5.7). Class strings are FULL literals so Tailwind
 * JIT can see them — never build a class name by concatenation.
 */
import {
  BookOpen,
  Hand,
  HandHeart,
  Heart,
  Leaf,
  Moon,
  Shapes,
  Sparkles,
  Star,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import type { AssessmentLevel, Domain, IconName, Tone } from '@/api/schemas'
import type { CopyKey } from './copy'

export interface DomainMeta {
  key: Domain
  labelKey: CopyKey
  tone: Tone
  icon: LucideIcon
}

/** The canonical domain order (PRD §5.5) — also the kit categories. */
export const DOMAINS: readonly DomainMeta[] = [
  { key: 'PRACTICAL_LIFE', labelKey: 'common.domain.PRACTICAL_LIFE', tone: 'teal', icon: Hand },
  { key: 'SENSORIAL', labelKey: 'common.domain.SENSORIAL', tone: 'orange', icon: Sparkles },
  { key: 'LANGUAGE', labelKey: 'common.domain.LANGUAGE', tone: 'yellow', icon: BookOpen },
  { key: 'MATH', labelKey: 'common.domain.MATH', tone: 'teal', icon: Shapes },
  { key: 'ISLAMIC_STUDIES', labelKey: 'common.domain.ISLAMIC_STUDIES', tone: 'orange', icon: Moon },
]

const DOMAIN_BY_KEY = new Map(DOMAINS.map((d) => [d.key, d]))

export function domainMeta(domain: Domain): DomainMeta {
  const meta = DOMAIN_BY_KEY.get(domain)
  if (!meta) throw new Error(`Unknown domain: ${domain}`)
  return meta
}

/** Soft tint surface per tone: icon chips, kit tiles, educator tiles, notes. */
export const TONE_SOFT: Record<Tone, string> = {
  teal: 'bg-primary-soft',
  orange: 'bg-accent-soft',
  yellow: 'bg-highlight-soft',
}

/** Solid fill per tone: bars and dots (non-text). */
export const TONE_SOLID: Record<Tone, string> = {
  teal: 'bg-primary',
  orange: 'bg-accent',
  yellow: 'bg-highlight',
}

export interface LevelMeta {
  level: AssessmentLevel
  labelKey: CopyKey
}

/** Assessment levels 1–4 (PRD §5.5). */
export const LEVELS: readonly LevelMeta[] = [
  { level: 1, labelKey: 'common.level.1' },
  { level: 2, labelKey: 'common.level.2' },
  { level: 3, labelKey: 'common.level.3' },
  { level: 4, labelKey: 'common.level.4' },
]

export const MAX_LEVEL = 4

/** `level × 25%` width for the DomainChart fill; 0 when there is no level. */
export function levelPercent(level: AssessmentLevel | null): number {
  return level === null ? 0 : (level / MAX_LEVEL) * 100
}

/** CMS `IconName` → lucide icon (PRD §5.7 frontend icon mapping). */
export const CMS_ICONS: Record<IconName, LucideIcon> = {
  heart: Heart,
  hands: HandHeart,
  sparkles: Sparkles,
  moon: Moon,
  sun: Sun,
  star: Star,
  leaf: Leaf,
  book: BookOpen,
}
