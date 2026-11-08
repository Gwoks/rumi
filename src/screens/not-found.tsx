/** 404 inside the public layout (the router's `*` route). */
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Container, SectionHeading } from '@/components/rumi/section'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/copy'
import { ROUTES } from '@/lib/navigation'

export function NotFoundScreen() {
  return (
    <Container className="py-24 lg:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <SectionHeading
          as="h1"
          align="center"
          eyebrow={t('common.notFound.eyebrow')}
          title={t('common.notFound.title')}
          intro={t('common.notFound.body')}
        />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to={ROUTES.home}>{t('common.notFound.home')}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to={ROUTES.weekendClasses}>
              {t('common.notFound.classes')}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </Container>
  )
}
