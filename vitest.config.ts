/**
 * Vitest config — unit/component tests for the SPA (mirrors hookbox).
 * Reuses vite.config.ts (React plugin + `@` alias) so tests resolve modules
 * exactly like the app. Playwright owns e2e/ — vitest only collects
 * `src/**\/*.test.{ts,tsx}`.
 */
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// pnpm forwards `pnpm test -- --coverage` as `vitest run -- --coverage`, and
// vitest ignores flags after `--`; honor the flag anywhere in argv so the
// documented gate command (CLAUDE.md) really measures coverage.
const wantsCoverage = process.argv.includes('--coverage')

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      coverage: {
        enabled: wantsCoverage,
        provider: 'v8',
        include: ['src/lib/**', 'src/api/**', 'src/stores/**', 'src/components/**'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/lib/copy/**', 'src/api/index.ts'],
        reporter: ['text-summary', 'text'],
        thresholds: { lines: 80 },
      },
    },
  }),
)
