/**
 * Beranda hero (DESIGN.md "Hero art"): CMS `home / hero` copy with the
 * page's single h1 ("{heading} {heading_highlight}"), two CTAs, the families
 * avatar stack and the decorative CSS-shape art panel. Falls back to the
 * seeded copy when the CMS section is missing or invalid (the h1 must exist).
 */
import { ArrowRight, Moon, Sparkles, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HeroBody } from '@/api/schemas'
import { Container } from '@/components/rumi/section'
import { EyebrowPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'

export const FALLBACK_HERO: HeroBody = {
  eyebrow: t('public.home.hero.eyebrow'),
  heading: t('public.home.hero.heading'),
  heading_highlight: t('public.home.hero.highlight'),
  subheading: t('public.home.hero.subheading'),
  art_badge: t('public.home.hero.artBadge'),
  art_caption: t('public.home.hero.artCaption'),
  art_motto: t('public.home.hero.artMotto'),
  social_proof: null,
}

const AVATARS = [
  { letter: 'N', className: 'bg-highlight' },
  { letter: 'S', className: 'bg-primary-soft' },
  { letter: 'A', className: 'bg-accent-soft' },
] as const

function HeroArt({ hero }: { hero: HeroBody | null }) {
  return (
    <div
      role="img"
      aria-label={hero?.art_caption ?? FALLBACK_HERO.art_caption}
      className="relative min-h-[390px] overflow-hidden rounded-hero bg-primary-soft p-6 sm:min-h-[490px]"
    >
      <div aria-hidden="true">
        {hero && (
          <span className="absolute right-8 top-8 rounded-full bg-surface/70 px-4 py-2 text-caption font-semibold text-primary-strong">
            {hero.art_badge}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-2/3 rounded-t-[45%] bg-highlight/80" />
        <span className="absolute bottom-14 left-1/2 grid h-52 w-52 -translate-x-1/2 place-items-center rounded-full border-[22px] border-surface/80 bg-accent text-center shadow-float">
          <span className="text-accent-on">
            <Moon size={48} className="mx-auto mb-2" />
            {hero && (
              <span className="block text-overline uppercase tracking-[.2em]">
                {hero.art_motto}
              </span>
            )}
          </span>
        </span>
        <span className="absolute bottom-12 left-7 grid h-20 w-20 place-items-center rounded-[24px] bg-surface text-accent-deep shadow-float">
          <Sparkles size={30} />
        </span>
        <span className="absolute bottom-24 right-8 grid h-24 w-24 place-items-center rounded-full bg-primary text-ink-inverse shadow-float">
          <Sun size={34} />
        </span>
        {hero && (
          <span className="absolute left-8 top-24 max-w-[210px] text-2xl font-semibold leading-tight text-ink">
            {hero.art_caption}
          </span>
        )}
      </div>
    </div>
  )
}

function HeroCopy({ hero }: { hero: HeroBody }) {
  return (
    <div>
      <EyebrowPill className="mb-6">{hero.eyebrow}</EyebrowPill>
      <h1 className="max-w-2xl text-balance text-display text-ink sm:text-display-lg">
        {hero.heading} <span className="text-primary">{hero.heading_highlight}</span>
      </h1>
      <p className="mt-6 max-w-xl text-body-lg text-ink-secondary">{hero.subheading}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="shadow-cta">
          <Link to={ROUTES.weekendClasses}>
            {t('public.home.hero.ctaClasses')}
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to={ROUTES.ourApproach}>{t('public.home.hero.ctaApproach')}</Link>
        </Button>
      </div>
      {hero.social_proof && (
        <div className="mt-10 flex items-center gap-5 text-body-sm text-ink-secondary">
          <div aria-hidden="true" className="flex -space-x-2">
            {AVATARS.map((avatar) => (
              <span
                key={avatar.letter}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full border-2 border-canvas text-xs font-bold text-ink',
                  avatar.className,
                )}
              >
                {avatar.letter}
              </span>
            ))}
          </div>
          <span>{hero.social_proof}</span>
        </div>
      )}
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-6 h-8 w-64 rounded-full" />
      <Skeleton className="h-14 w-full max-w-xl" />
      <Skeleton className="mt-3 h-14 w-2/3" />
      <SkeletonText lines={3} className="mt-6 max-w-xl" />
      <div className="mt-8 flex gap-3">
        <Skeleton className="h-12 w-52" />
        <Skeleton className="h-12 w-44" />
      </div>
    </div>
  )
}

export interface HomeHeroProps {
  /** The CMS hero; null while loading. */
  hero: HeroBody | null
  isLoading: boolean
}

export function HomeHero({ hero, isLoading }: HomeHeroProps) {
  const shown = isLoading ? null : (hero ?? FALLBACK_HERO)
  return (
    <Container
      className="grid gap-12 pb-20 pt-20 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pt-28"
      aria-busy={isLoading || undefined}
    >
      {shown ? <HeroCopy hero={shown} /> : <HeroSkeleton />}
      <HeroArt hero={shown} />
    </Container>
  )
}
