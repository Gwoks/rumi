/**
 * Temporary body for screens whose real content is built by a page lane.
 * Page agents replace the screen file's contents and drop this import.
 */
import { InlineAlert } from '@/components/ui/inline-alert'
import { t } from '@/lib/copy'
import { Container, PageHeader } from './section'

export function ScreenPlaceholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Container className="pb-20">
        <InlineAlert>{t('common.placeholder.body')}</InlineAlert>
      </Container>
    </>
  )
}
