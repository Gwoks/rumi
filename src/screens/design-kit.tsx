/**
 * `/design-kit` (PRD §4.1): the public page showing every UI primitive and
 * RUMI composite, built only from tokens and `t()` copy. Review it before
 * calling any visual change done (DESIGN.md).
 */
import { Container, PageHeader } from '@/components/rumi/section'
import { cn } from '@/lib/cn'
import { t, type CopyKey } from '@/lib/copy'
import { FOCUS } from '@/lib/styles'
import { BadgesSection, ButtonsSection } from './design-kit/actions'
import { DataSection } from './design-kit/data'
import { FeedbackSection } from './design-kit/feedback'
import { FormsSection } from './design-kit/forms'
import { PaletteSection, TypeSection } from './design-kit/foundations'
import { NavigationSection } from './design-kit/navigation'
import { OverlaysSection } from './design-kit/overlays'
import { CardsSection } from './design-kit/surfaces'

const TOC: readonly { id: string; titleKey: CopyKey }[] = [
  { id: 'palet', titleKey: 'designKit.palette.title' },
  { id: 'tipografi', titleKey: 'designKit.type.title' },
  { id: 'tombol', titleKey: 'designKit.buttons.title' },
  { id: 'status', titleKey: 'designKit.badges.title' },
  { id: 'formulir', titleKey: 'designKit.forms.title' },
  { id: 'kartu', titleKey: 'designKit.cards.title' },
  { id: 'umpan-balik', titleKey: 'designKit.feedback.title' },
  { id: 'navigasi', titleKey: 'designKit.navigation.title' },
  { id: 'overlay', titleKey: 'designKit.overlays.title' },
  { id: 'data', titleKey: 'designKit.data.title' },
]

export function DesignKitScreen() {
  return (
    <>
      <PageHeader
        eyebrow={t('designKit.eyebrow')}
        title={t('designKit.title')}
        intro={t('designKit.intro')}
      />
      <Container className="pb-24">
        <nav aria-label={t('designKit.toc.label')}>
          <ul className="flex flex-wrap gap-2">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 text-caption font-semibold text-ink-secondary hover:border-primary hover:text-primary-strong',
                    FOCUS,
                  )}
                >
                  {t(item.titleKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <PaletteSection />
        <TypeSection />
        <ButtonsSection />
        <BadgesSection />
        <FormsSection />
        <CardsSection />
        <FeedbackSection />
        <NavigationSection />
        <OverlaysSection />
        <DataSection />
      </Container>
    </>
  )
}
