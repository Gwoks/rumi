import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** The custom type-scale keys from tailwind.config.ts. Without registering them,
 * tailwind-merge would read `text-body-sm` as a text COLOR and drop it when a
 * `text-ink` follows (or vice versa). */
const FONT_SIZES = [
  'display-lg',
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'eyebrow',
  'overline',
  'micro',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      shadow: [{ shadow: ['card', 'cta', 'float', 'modal'] }],
    },
  },
})

/** Merge Tailwind class names, resolving conflicts (last wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
