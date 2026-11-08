/** /design-kit 03–04: every Button variant/size/state, badges and status badges. */
import { ArrowRight, Heart } from 'lucide-react'
import { CLASS_STATUS_VALUES, ENROLLMENT_STATUS_VALUES, ORDER_STATUS_VALUES } from '@/api/schemas'
import {
  ClassStatusBadge,
  EnrollmentStatusBadge,
  OrderStatusBadge,
  SeatBadge,
  StockBadge,
} from '@/components/rumi/status-badge'
import { Badge, EyebrowPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { t } from '@/lib/copy'
import { DemoLabel, KitSection } from './kit-section'

const ROW = 'flex flex-wrap items-center gap-3'

export function ButtonsSection() {
  return (
    <KitSection
      id="tombol"
      eyebrow={t('designKit.buttons.eyebrow')}
      title={t('designKit.buttons.title')}
      intro={t('designKit.buttons.intro')}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="standard" className="lg:col-span-2">
          <DemoLabel>{t('designKit.buttons.variants')}</DemoLabel>
          <div className={ROW}>
            <Button className="shadow-cta">{t('designKit.button.primary')}</Button>
            <Button variant="accent">{t('designKit.button.accent')}</Button>
            <Button variant="secondary">{t('designKit.button.secondary')}</Button>
            <Button variant="soft">{t('designKit.button.soft')}</Button>
            <Button variant="ghost">{t('designKit.button.ghost')}</Button>
            <Button variant="link" className="group">
              {t('designKit.button.link')}
              <ArrowRight
                aria-hidden="true"
                size={16}
                className="transition motion-safe:group-hover:translate-x-1"
              />
            </Button>
            <Button variant="danger">{t('designKit.button.danger')}</Button>
            <Button variant="icon" size="icon" aria-label={t('designKit.button.icon')}>
              <Heart aria-hidden="true" size={18} />
            </Button>
          </div>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.buttons.sizes')}</DemoLabel>
          <div className={ROW}>
            <Button size="sm">{t('designKit.button.small')}</Button>
            <Button size="md">{t('designKit.button.medium')}</Button>
            <Button size="lg">{t('designKit.button.large')}</Button>
          </div>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.buttons.states')}</DemoLabel>
          <div className={ROW}>
            <Button loading>{t('designKit.button.loading')}</Button>
            <Button variant="accent" disabled>
              {t('designKit.button.disabled')}
            </Button>
          </div>
        </Card>
      </div>
    </KitSection>
  )
}

export function BadgesSection() {
  return (
    <KitSection
      id="status"
      eyebrow={t('designKit.badges.eyebrow')}
      title={t('designKit.badges.title')}
      intro={t('designKit.badges.intro')}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Card padding="standard">
          <DemoLabel>{t('designKit.badges.variants')}</DemoLabel>
          <div className={ROW}>
            <Badge variant="success">{t('designKit.badges.success')}</Badge>
            <Badge variant="pending">{t('designKit.badges.pending')}</Badge>
            <Badge variant="attention">{t('designKit.badges.attention')}</Badge>
            <Badge variant="neutral">{t('designKit.badges.neutral')}</Badge>
            <Badge variant="danger">{t('designKit.badges.danger')}</Badge>
            <EyebrowPill>{t('designKit.badges.eyebrowPill')}</EyebrowPill>
          </div>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.badges.orders')}</DemoLabel>
          <div className={ROW}>
            {ORDER_STATUS_VALUES.map((status) => (
              <OrderStatusBadge key={status} status={status} />
            ))}
          </div>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.badges.classes')}</DemoLabel>
          <div className={ROW}>
            {CLASS_STATUS_VALUES.map((status) => (
              <ClassStatusBadge key={status} status={status} />
            ))}
            <ClassStatusBadge status="OPEN" isFull />
          </div>
        </Card>
        <Card padding="standard">
          <DemoLabel>{t('designKit.badges.enrollments')}</DemoLabel>
          <div className={ROW}>
            {ENROLLMENT_STATUS_VALUES.map((status) => (
              <EnrollmentStatusBadge key={status} status={status} />
            ))}
          </div>
        </Card>
        <Card padding="standard" className="md:col-span-2">
          <DemoLabel>{t('designKit.badges.indicators')}</DemoLabel>
          <div className={ROW}>
            <SeatBadge seatsLeft={9} isFull={false} />
            <SeatBadge seatsLeft={2} isFull={false} />
            <SeatBadge seatsLeft={0} isFull />
            <StockBadge stock={16} />
            <StockBadge stock={4} />
            <StockBadge stock={0} />
          </div>
        </Card>
      </div>
    </KitSection>
  )
}
