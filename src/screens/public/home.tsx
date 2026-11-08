/**
 * `/` Beranda (PRD §4.1): CMS hero + "Cara RUMI", quick booking, the next
 * three upcoming classes and the latest four kits, then a join band.
 * Content only — PublicLayout provides header, footer and main#main.
 */
import { useState } from 'react'
import { api } from '@/api/client'
import type { PlayKit, WeekendClass } from '@/api/schemas'
import { useAuth } from '@/api/use-auth'
import { cmsBody } from '@/components/rumi/cms-section'
import { useAsync } from '@/lib/use-async'
import { ClassDetailDialog } from './shared/class-detail-dialog'
import { KitDetailDialog } from './shared/kit-detail-dialog'
import { useCartActions } from './shared/use-cart-actions'
import { HomeHero } from './home/home-hero'
import {
  JoinBand,
  LatestKitsSection,
  QuickBooking,
  RumiWaySection,
  UpcomingClassesSection,
} from './home/home-sections'

const UPCOMING_LIMIT = 3
const LATEST_KITS_LIMIT = 4

export function HomeScreen() {
  const { user } = useAuth()
  const { bookClass, addKitToCart } = useCartActions()
  const [detailClass, setDetailClass] = useState<WeekendClass | null>(null)
  const [detailKit, setDetailKit] = useState<PlayKit | null>(null)

  const cms = useAsync(() => api.getCmsPage('home'), [])
  const classes = useAsync(
    () => api.listClasses().then((list) => list.items.slice(0, UPCOMING_LIMIT)),
    [],
  )
  const kits = useAsync(() => api.listKits().then((list) => list.slice(0, LATEST_KITS_LIMIT)), [])

  const hero = cmsBody(cms.data, 'home', 'hero')
  const rumiWay = cmsBody(cms.data, 'home', 'rumi_way')

  const book = (cls: WeekendClass) => {
    setDetailClass(null)
    bookClass(cls)
  }
  const addKit = (kit: PlayKit, quantity = 1) => {
    setDetailKit(null)
    addKitToCart(kit, quantity)
  }

  return (
    <>
      <HomeHero hero={hero?.body ?? null} isLoading={cms.status === 'loading' && !cms.data} />
      <QuickBooking classes={classes} onBook={book} />
      {rumiWay && <RumiWaySection body={rumiWay.body} />}
      <UpcomingClassesSection classes={classes} onBook={book} onDetails={setDetailClass} />
      <LatestKitsSection kits={kits} onAdd={(kit) => addKit(kit)} onDetails={setDetailKit} />
      <JoinBand isSignedIn={user !== null} />
      <ClassDetailDialog cls={detailClass} onClose={() => setDetailClass(null)} onBook={book} />
      <KitDetailDialog kit={detailKit} onClose={() => setDetailKit(null)} onAdd={addKit} />
    </>
  )
}
