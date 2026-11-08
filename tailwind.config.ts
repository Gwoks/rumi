/**
 * Tailwind config (DESIGN.md "Semantic tokens" + "Non-color tokens").
 *
 * `theme.colors` is REPLACED, not extended: only the semantic tokens below
 * (plus transparent/current/inherit) exist, so `bg-white`, `text-slate-500` and
 * the default palette cannot compile into the design. Every color references a
 * CSS var from src/globals.css as `rgb(var(--color-…) / <alpha-value>)` so
 * opacity modifiers (`bg-ink/40`, `border-primary/40`) work.
 */
import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      canvas: token('canvas'),
      surface: {
        DEFAULT: token('surface'),
        subtle: token('surface-subtle'),
        inverse: token('surface-inverse'),
      },
      border: {
        DEFAULT: token('border'),
        subtle: token('border-subtle'),
        strong: token('border-strong'),
      },
      ink: {
        DEFAULT: token('ink'),
        secondary: token('ink-secondary'),
        tertiary: token('ink-tertiary'),
        disabled: token('ink-disabled'),
        inverse: token('ink-inverse'),
      },
      primary: {
        DEFAULT: token('primary'),
        hover: token('primary-hover'),
        strong: token('primary-strong'),
        'strong-hover': token('primary-strong-hover'),
        soft: token('primary-soft'),
        on: token('primary-on'),
      },
      accent: {
        DEFAULT: token('accent'),
        hover: token('accent-hover'),
        deep: token('accent-deep'),
        strong: token('accent-strong'),
        soft: token('accent-soft'),
        on: token('accent-on'),
      },
      highlight: {
        DEFAULT: token('highlight'),
        deep: token('highlight-deep'),
        strong: token('highlight-strong'),
        soft: token('highlight-soft'),
        on: token('highlight-on'),
      },
      danger: {
        DEFAULT: token('danger'),
        soft: token('danger-soft'),
        border: token('danger-border'),
      },
      focus: token('focus'),
    },
    extend: {
      borderColor: {
        DEFAULT: token('border'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': [
          '60px',
          { lineHeight: '1.05', letterSpacing: '-0.045em', fontWeight: '600' },
        ],
        display: ['48px', { lineHeight: '1.05', letterSpacing: '-0.045em', fontWeight: '600' }],
        h1: ['36px', { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '600' }],
        h2: ['30px', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        h4: ['16px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '32px', fontWeight: '400' }],
        body: ['16px', { lineHeight: '28px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '24px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '18px', fontWeight: '400' }],
        eyebrow: ['14px', { lineHeight: '20px', letterSpacing: '0.16em', fontWeight: '700' }],
        overline: ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '700' }],
        micro: ['11px', { lineHeight: '13px', letterSpacing: '0.12em', fontWeight: '700' }],
      },
      borderRadius: {
        modal: '28px',
        hero: '36px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        cta: 'var(--shadow-cta)',
        float: 'var(--shadow-float)',
        modal: 'var(--shadow-modal)',
      },
      zIndex: {
        header: '40',
        overlay: '50',
        toast: '80',
      },
      maxWidth: {
        dashboard: '1440px',
      },
      spacing: {
        'dashboard-header': '76px',
      },
      transitionDuration: {
        DEFAULT: 'var(--dur-base)',
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
        progress: 'var(--dur-progress)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease-standard)',
        standard: 'var(--ease-standard)',
        emphasized: 'var(--ease-emphasized)',
      },
      keyframes: {
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'content-in': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(20px) scale(.95)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'overlay-in': 'overlay-in var(--dur-base) var(--ease-standard)',
        'content-in': 'content-in var(--dur-slow) var(--ease-emphasized)',
        'sheet-in-right': 'sheet-in-right var(--dur-slow) var(--ease-emphasized)',
        'toast-in': 'toast-in var(--dur-base) var(--ease-standard)',
      },
    },
  },
  plugins: [],
}

export default config
