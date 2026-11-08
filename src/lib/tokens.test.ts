/**
 * Guards src/globals.css: every primitive's RGB channels must equal the hex in
 * its comment (DESIGN.md "Format"), and every semantic var Tailwind wraps must
 * be defined.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config'
import { channelsToHex } from './color'

const css = readFileSync(resolve(__dirname, '../globals.css'), 'utf8')

describe('globals.css tokens', () => {
  it('keeps primitive channels in sync with their hex comments', () => {
    const primitive = /--([a-z]+-\d+|white): (\d+ \d+ \d+); \/\* (#[0-9A-Fa-f]{6})/g
    const matches = [...css.matchAll(primitive)]
    expect(matches.length).toBeGreaterThanOrEqual(25)
    for (const [, name, channels, hex] of matches) {
      expect(channelsToHex(channels), name).toBe(hex.toUpperCase())
    }
  })

  it('defines every semantic var that tailwind.config.ts references', () => {
    const configText = JSON.stringify(tailwindConfig.theme)
    const referenced = [...configText.matchAll(/--color-([a-z-]+)\)/g)].map((m) => m[1])
    expect(referenced.length).toBeGreaterThan(30)
    for (const name of new Set(referenced)) {
      expect(css, `--color-${name}`).toMatch(new RegExp(`--color-${name}: var\\(--`))
    }
  })
})
