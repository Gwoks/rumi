/** "Lewati ke konten utama" — first in tab order, visible on focus. */
import { cn } from '@/lib/cn'
import { t } from '@/lib/copy'
import { FOCUS } from '@/lib/styles'

export const MAIN_ID = 'main'

export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className={cn(
        'sr-only z-toast rounded-xl bg-surface px-4 py-3 text-body-sm font-semibold text-primary-strong shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-4',
        FOCUS,
      )}
    >
      {t('common.skipLink')}
    </a>
  )
}
