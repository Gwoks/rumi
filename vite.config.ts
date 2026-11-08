/**
 * Vite config for the RUMI SPA (mirrors ../hookbox/vite.config.ts).
 * - React plugin for JSX/Fast Refresh.
 * - `@` alias → ./src.
 * - Dev proxy: same-origin /api and /healthz → the Rust backend on :8080.
 *   NO `changeOrigin` (PRD §5.3.3 / §6.19): `Host` must stay localhost:5173 so
 *   it matches the browser's `Origin` and the CSRF Origin check passes.
 * - Build output → dist/ (served by the Rust `routes/spa.rs` with an index fallback).
 */
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': { target: BACKEND },
      '/healthz': { target: BACKEND },
    },
  },
  build: {
    outDir: 'dist',
  },
})
