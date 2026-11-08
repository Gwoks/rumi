/**
 * DESIGN.md "The no-raw-color rule (hard)": no raw hex, rgb()/rgba() or
 * hsl()/hsla() color literals anywhere in src/ except src/globals.css — all
 * color flows through semantic Tailwind token classes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { rel, sourceFiles, SRC } from './support/source-files'

const HEX = /#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\b/
const FUNCS = /\b(rgba?|hsla?)\(/
const ALLOWED = new Set([path.join(SRC, 'globals.css')])

test('no raw color literals in src/ (outside globals.css)', () => {
  const hits: string[] = []
  for (const file of sourceFiles(SRC)) {
    if (ALLOWED.has(file)) continue
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (HEX.test(line) || FUNCS.test(line)) hits.push(`${rel(file)}:${i + 1}: ${line.trim()}`)
      })
  }
  expect(hits, `Raw colors found (use semantic tokens):\n${hits.join('\n')}`).toEqual([])
})

test('the scanner itself catches raw colors', () => {
  expect(HEX.test('bg-[#2a9d8f]')).toBe(true)
  expect(HEX.test('color: #FFF;')).toBe(true)
  expect(FUNCS.test('rgba(0,0,0,.4)')).toBe(true)
  expect(HEX.test('href="#main"')).toBe(false)
})
