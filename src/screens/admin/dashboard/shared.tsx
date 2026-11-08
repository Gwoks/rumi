/** Small pieces shared by the admin ResourceManager configs. */
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/copy'

/** PRD §5.8.5: fee_idr / price_idr are 0–100_000_000. */
export const MAX_IDR = 100_000_000
/** PRD §5.8.6: image_url is at most 500 characters. */
export const IMAGE_URL_MAX = 500

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? 'success' : 'neutral'}>
      {t(isActive ? 'admin.status.active' : 'admin.status.inactive')}
    </Badge>
  )
}
