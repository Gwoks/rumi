/**
 * The single `t()` entry point for every user-facing string (Bahasa
 * Indonesia). Copy is split by area so parallel lanes edit disjoint files:
 *
 * | file            | prefix        | owner                          |
 * |-----------------|---------------|--------------------------------|
 * | common.ts       | `common.`     | foundation                     |
 * | design-kit.ts   | `designKit.`  | foundation                     |
 * | public.ts       | `public.`     | public lane (pages, cart, checkout) |
 * | auth.ts         | `auth.`       | public lane (auth screens)     |
 * | parent.ts       | `parent.`     | dashboard lane                 |
 * | admin.ts        | `admin.`      | dashboard lane                 |
 *
 * `copy.test.ts` enforces the prefixes, so a key can never collide across files.
 */
import { adminCopy } from './admin'
import { authCopy } from './auth'
import { commonCopy } from './common'
import { designKitCopy } from './design-kit'
import { parentCopy } from './parent'
import { publicCopy } from './public'

export const COPY_AREAS = {
  common: commonCopy,
  designKit: designKitCopy,
  public: publicCopy,
  auth: authCopy,
  parent: parentCopy,
  admin: adminCopy,
} as const

export const copy = {
  ...commonCopy,
  ...designKitCopy,
  ...publicCopy,
  ...authCopy,
  ...parentCopy,
  ...adminCopy,
} as const

export type CopyKey = keyof typeof copy
export type CopyVars = Record<string, string | number>

/** Resolve a copy key, substituting `{slot}` interpolation values. */
export function t(key: CopyKey, vars?: CopyVars): string {
  let s: string = copy[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

/** Type guard for keys built at runtime (e.g. `common.domain.${d}`). */
export function isCopyKey(key: string): key is CopyKey {
  return Object.prototype.hasOwnProperty.call(copy, key)
}
