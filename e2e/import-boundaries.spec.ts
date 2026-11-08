/**
 * Folder import boundaries (CLAUDE.md "Frontend"):
 *  - screens and components never call `fetch` (only src/api/http.ts does);
 *  - generic ui primitives never import the API client, stores, RUMI
 *    composites or screens (schema TYPES are fine);
 *  - components never import screens.
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { importsOf, rel, sourceFiles, SRC, stripComments } from './support/source-files'

const FETCH_ALLOWED = new Set([path.join(SRC, 'api', 'http.ts')])

test('only src/api/http.ts calls fetch', () => {
  const offenders = sourceFiles(SRC, ['.ts', '.tsx'])
    .filter(
      (file) =>
        !FETCH_ALLOWED.has(file) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'),
    )
    .filter((file) => /\bfetch\s*\(/.test(stripComments(fs.readFileSync(file, 'utf8'))))
    .map(rel)
  expect(offenders).toEqual([])
})

test('ui primitives stay generic', () => {
  const forbidden = [
    /^@\/api(\/(client|auth-store|use-auth|index|http))?$/,
    /^@\/stores\//,
    /^@\/components\/rumi\//,
    /^@\/screens\//,
  ]
  const bad = sourceFiles(path.join(SRC, 'components', 'ui'), ['.ts', '.tsx'])
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .flatMap((file) =>
      importsOf(file)
        .filter((spec) => forbidden.some((re) => re.test(spec)))
        .map((spec) => `${rel(file)} -> ${spec}`),
    )
  expect(bad).toEqual([])
})

test('components never import screens', () => {
  const bad = sourceFiles(path.join(SRC, 'components'), ['.ts', '.tsx']).flatMap((file) =>
    importsOf(file)
      .filter((spec) => spec.startsWith('@/screens'))
      .map((spec) => `${rel(file)} -> ${spec}`),
  )
  expect(bad).toEqual([])
})
