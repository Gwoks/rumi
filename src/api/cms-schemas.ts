/**
 * CMS registry and body shapes (PRD §5.7, FROZEN). The registry is fixed: 9
 * `(page_slug, section_key)` pairs, each with exactly one strict body shape.
 * `short` = 1–120 chars and `long` = 1–1000 chars, measured after trimming
 * (Unicode scalar values, PRD §5.4.4). Unknown keys are rejected (`.strict()`),
 * mirroring the server's strict validation.
 */
import { z } from 'zod'
import { domainSchema } from './enums'

const charCount = (s: string): number => [...s.trim()].length

const text = (max: number) =>
  z.string().refine((s) => {
    const n = charCount(s)
    return n >= 1 && n <= max
  })

export const shortText = text(120)
export const longText = text(1000)

export const toneSchema = z.enum(['teal', 'orange', 'yellow'])
export const iconNameSchema = z.enum([
  'heart',
  'hands',
  'sparkles',
  'moon',
  'sun',
  'star',
  'leaf',
  'book',
])
export const pageSlugSchema = z.enum(['home', 'who-we-are', 'our-approach'])

export const heroBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    heading_highlight: shortText,
    subheading: longText,
    art_badge: shortText,
    art_caption: shortText,
    art_motto: shortText,
    social_proof: shortText.nullable(),
  })
  .strict()

export const rumiWayBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    intro: longText,
    cards: z
      .array(
        z
          .object({ icon: iconNameSchema, tone: toneSchema, title: shortText, text: longText })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict()

export const founderMessageBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    paragraphs: z.array(longText).min(1).max(6),
    signature_name: shortText,
    signature_role: shortText,
  })
  .strict()

export const proseBodySchema = z
  .object({ eyebrow: shortText, heading: shortText, paragraphs: z.array(longText).min(1).max(6) })
  .strict()

export const missionBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    statement: longText,
    points: z.array(longText).min(1).max(8),
  })
  .strict()

export const educatorsBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    intro: longText,
    people: z
      .array(
        z
          .object({
            name: shortText,
            role: shortText,
            bio: longText,
            initials: z.string().regex(/^[A-Z]{1,3}$/),
            tone: toneSchema,
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()

export const domainsBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    intro: longText,
    items: z
      .array(
        z
          .object({
            domain: domainSchema,
            title: shortText,
            summary: longText,
            activities: z.array(shortText).min(1).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(5)
      .refine((items) => new Set(items.map((i) => i.domain)).size === items.length),
  })
  .strict()

export const valuesBodySchema = z
  .object({
    eyebrow: shortText,
    heading: shortText,
    intro: longText,
    items: z
      .array(
        z
          .object({
            icon: iconNameSchema,
            title: shortText,
            arabic: shortText.nullable(),
            text: longText,
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

/** The fixed registry: page → section_key → body schema (PRD §5.7 table). */
export const CMS_REGISTRY = {
  home: { hero: heroBodySchema, rumi_way: rumiWayBodySchema },
  'who-we-are': {
    founder_message: founderMessageBodySchema,
    philosophy: proseBodySchema,
    mission: missionBodySchema,
    educators: educatorsBodySchema,
  },
  'our-approach': { intro: proseBodySchema, domains: domainsBodySchema, values: valuesBodySchema },
} as const

export type CmsRegistry = typeof CMS_REGISTRY
export type PageSlug = z.infer<typeof pageSlugSchema>
export type SectionKey<P extends PageSlug> = keyof CmsRegistry[P] & string
export type CmsBody<P extends PageSlug, K extends SectionKey<P>> = z.infer<
  CmsRegistry[P][K] extends z.ZodTypeAny ? CmsRegistry[P][K] : never
>

export type Tone = z.infer<typeof toneSchema>
export type IconName = z.infer<typeof iconNameSchema>
export type HeroBody = z.infer<typeof heroBodySchema>
export type RumiWayBody = z.infer<typeof rumiWayBodySchema>
export type FounderMessageBody = z.infer<typeof founderMessageBodySchema>
export type ProseBody = z.infer<typeof proseBodySchema>
export type MissionBody = z.infer<typeof missionBodySchema>
export type EducatorsBody = z.infer<typeof educatorsBodySchema>
export type DomainsBody = z.infer<typeof domainsBodySchema>
export type ValuesBody = z.infer<typeof valuesBodySchema>

/** The body schema for a registry pair, or null if the pair is not registered. */
export function cmsBodySchemaFor(pageSlug: string, sectionKey: string): z.ZodTypeAny | null {
  const page = (CMS_REGISTRY as Record<string, Record<string, z.ZodTypeAny>>)[pageSlug]
  return page?.[sectionKey] ?? null
}

/** Section keys registered for a page, in registry order. */
export function cmsSectionKeys(pageSlug: PageSlug): string[] {
  return Object.keys(CMS_REGISTRY[pageSlug])
}

/**
 * Validate a CMS `body` against its registry shape. Returns the typed body, or
 * null when it does not match (the public page then skips that section rather
 * than crash, PRD §5.7 rendering rules).
 */
export function parseCmsBody<P extends PageSlug, K extends SectionKey<P>>(
  pageSlug: P,
  sectionKey: K,
  body: unknown,
): CmsBody<P, K> | null {
  const schema = cmsBodySchemaFor(pageSlug, sectionKey)
  if (!schema) return null
  const parsed = schema.safeParse(body)
  return parsed.success ? (parsed.data as CmsBody<P, K>) : null
}
