# RUMI — Style Reference
> a sunlit Saturday-morning playroom: warm paper, calm teal, a bright splash of orange

**Theme:** light only in v1 (no dark mode, YAGNI). The semantic layer keeps dark mode cheap to add later.
**Source of truth:** the v0 template (`../rumi-v0-template/app/page.tsx`, `app/globals.css`, `app/design-kit/page.tsx`). The six brand colors below match it exactly.
**UI language:** Bahasa Indonesia. Every string goes through `t()` in `src/lib/copy.ts`.

**What RUMI should feel like.** RUMI should feel like a prepared Montessori room on a Saturday morning: unhurried, tidy, warm and quietly joyful.

**Surfaces.**
- The page sits on a warm paper **canvas** (#FDFBF7).
- Content lives on **white cards** with a hairline **slate border** (#E2E8F0) and soft 16px corners.
- Cards sit flat on the canvas. They lift and gain a shadow only on hover.

**Color.**
- **Teal** (#2A9D8F) is the calm anchor. It carries brand moments, active states and data.
- **Orange** (#FA8C42) is the warm call to action: book, add to cart, order via WhatsApp.
- **Yellow** (#FAD02C) is a sunny highlight: date tiles, selection and small celebrations.
- Each hue has a **soft tint** (#E7F4F0, #FFF1E6, #FFF7CF). The tints paint icon chips, kit tiles and note panels, like colored paper on a work tray.

**Type.** The typeface is Inter. Headings are semibold and tightly tracked, and body copy is open and airy.

**Illustration and motion.**
- Illustration is made from CSS shapes (sun, moon, hill) and initials tiles. There are no stock photos.
- Motion is gentle: small lifts on hover, sheets that slide in, and bars that grow. All of it turns off under `prefers-reduced-motion`.

---

## Colors

### Brand primitives (template, exact)

| Name | Hex | Role |
|---|---|---|
| Teal | `#2A9D8F` | Brand primary. Use it for decorative fills, icons, chart bars, the active-tab underline, the hero highlight word (large text only) and selection |
| Teal Hover | `#238B7F` | The template's hover shade for **non-text** teal fills, such as a chart bar on hover |
| Orange | `#FA8C42` | Warm CTA fill, the cart count chip, the eyebrow dot |
| Orange Hover | `#E77E36` | Hover fill for orange CTAs |
| Orange Deep | `#D86D29` | The template's dark orange. **Decorative only** (icons, dots) or text ≥ 24px, because it reaches only 3.42:1 on white |
| Yellow | `#FAD02C` | Highlight: `::selection`, the toast check icon, the hero hill, avatar chips |
| Yellow Deep | `#8D7100` | The template's dark yellow. **Decorative only** or large text, because it reaches only 4.33:1 on the soft yellow |
| Canvas | `#FDFBF7` | Page background, the `<html>` background, the `theme-color` meta |
| White | `#FFFFFF` | Card and dialog surfaces |
| Ink | `#2D3748` | Primary text, the dark surface (toast, floating cart), text on yellow |
| Slate Border | `#E2E8F0` | Hairline card and section borders |
| Teal Soft | `#E7F4F0` | Teal tint: icon chips, soft buttons, success badges, notes |
| Orange Soft | `#FFF1E6` | Orange tint: hero eyebrow pill, attention badges |
| Yellow Soft | `#FFF7CF` | Yellow tint: date tiles, pending badges, observation panels |

### AA-derived shades (added at Phase 0; not in the template)

The template puts white text on `#2A9D8F` (3.32:1) and on `#FA8C42` (2.36:1). It also uses `#D86D29` and `#8D7100` as small text on their tints. All of these fail WCAG AA for normal text. The brand fills stay as they are; the shades below take over wherever **text** sits on, or is drawn in, those hues.

| Name | Hex | Replaces (for text) | Ratio |
|---|---|---|---|
| Teal Strong | `#1F7A70` | Teal fills that carry text, teal text on light surfaces, the focus ring | white on it 5.15; on white 5.15; on canvas 4.98; on teal soft 4.56 |
| Teal Strong Hover | `#19665E` | Hover of Teal Strong fills | white on it 6.77 |
| Orange Strong | `#A8501A` | Orange text: eyebrows, role labels, attention badges | on white 5.49; on orange soft 4.96; on canvas 5.31 |
| Yellow Strong | `#7A6200` | Text on yellow soft: pending badges | on yellow soft 5.44; on white 5.87 |
| Ink Deep | `#1A202C` | Text **on** orange fills. Orange CTAs use dark text, not white | on orange 6.91; on orange hover 5.78 |

### Neutrals and status

| Name | Hex | Role |
|---|---|---|
| Slate 600 | `#475569` | Secondary text and body copy. 7.58 on white; at least 6.7 on every soft tint |
| Slate 500 | `#64748B` | Tertiary text: meta, captions, placeholders, inactive nav. 4.76 on white, 4.60 on canvas. **Never on a tint** (4.21 on teal soft) |
| Slate 450 | `#7C8BA1` | Form-control borders, which need 3:1 against the surface (3.46 on white) |
| Slate 400 | `#94A3B8` | Disabled text and decorative icons only (2.56 on white) |
| Slate 100 | `#F1F5F9` | Subtle dividers, progress tracks, skeletons |
| Slate 50 | `#F8FAFC` | Neutral hover and subtle surface |
| Red 700 | `#B42318` | Danger text, icon and fill. 6.57 on white; white on it 6.57 |
| Red 200 | `#FECDCA` | Danger border |
| Red 50 | `#FEF3F2` | Danger tint |

---

## Semantic tokens (the only color names that code may use)

**Format.** `src/globals.css` defines every primitive as **space-separated RGB channels**, with the hex in a comment. Example: `--teal-500: 42 157 143; /* #2A9D8F */`.

**Mapping.** Each semantic var maps to one primitive. Example: `--color-primary: var(--teal-500);`.

**Tailwind.** `tailwind.config.ts` wraps every token as `rgb(var(--color-…) / <alpha-value>)`, so opacity modifiers work: `bg-ink/40`, `bg-surface/90`, `text-ink-inverse/70`, `border-primary/40`.

**Color set.** `theme.colors` is **replaced**, not extended. Only the tokens below, plus `transparent`, `current` and `inherit`, exist, so `bg-white`, `text-slate-500` and `bg-[#…]` cannot compile into the design.

| CSS var | Primitive | Tailwind | Use |
|---|---|---|---|
| `--color-canvas` | Canvas | `bg-canvas` | Page background, dashboard header (`bg-canvas/90`) |
| `--color-surface` | White | `bg-surface` | Cards, dialogs, drawer, inputs, public footer |
| `--color-surface-subtle` | Slate 50 | `bg-surface-subtle` | Neutral hover, disabled inputs, neutral badge |
| `--color-surface-inverse` | Ink | `bg-surface-inverse` | Toast, floating cart button |
| `--color-border` | Slate Border | `border-border` (also the default `border`) | Card and section hairlines |
| `--color-border-subtle` | Slate 100 | `border-border-subtle`, `bg-border-subtle` | Row dividers, progress track, skeleton |
| `--color-border-strong` | Slate 450 | `border-border-strong` | Input, select, textarea and checkbox boundaries |
| `--color-ink` | Ink | `text-ink` | Primary text and headings |
| `--color-ink-secondary` | Slate 600 | `text-ink-secondary` | Body copy, labels, text on tints |
| `--color-ink-tertiary` | Slate 500 | `text-ink-tertiary` | Meta, captions, placeholders, inactive tabs (on white or canvas only) |
| `--color-ink-disabled` | Slate 400 | `text-ink-disabled` | Disabled text, decorative icons |
| `--color-ink-inverse` | White | `text-ink-inverse` | Text on `surface-inverse`, `primary-strong` and `danger` |
| `--color-primary` | Teal | `bg-primary`, `text-primary`, `border-primary` | Brand fills, icons, bars, active underline, hero highlight (≥ 24px). **Never small text** |
| `--color-primary-hover` | Teal Hover | `bg-primary-hover` | Hover of non-text teal fills |
| `--color-primary-strong` | Teal Strong | `bg-primary-strong`, `text-primary-strong` | Primary buttons, teal text and links, success-badge text, active nav text |
| `--color-primary-strong-hover` | Teal Strong Hover | `bg-primary-strong-hover` | Primary button hover |
| `--color-primary-soft` | Teal Soft | `bg-primary-soft` | Soft buttons, chips, success badges, notes, active nav background |
| `--color-primary-on` | White | `text-primary-on` | Text on `primary-strong` |
| `--color-accent` | Orange | `bg-accent` | Warm CTA fill, count chip, dots |
| `--color-accent-hover` | Orange Hover | `bg-accent-hover` | Warm CTA hover |
| `--color-accent-deep` | Orange Deep | `text-accent-deep` | Decorative icons only |
| `--color-accent-strong` | Orange Strong | `text-accent-strong` | Eyebrows, role labels, attention-badge text, warm text links |
| `--color-accent-soft` | Orange Soft | `bg-accent-soft` | Hero eyebrow pill, attention badges, orange-tone tiles |
| `--color-accent-on` | Ink Deep | `text-accent-on` | Text on `accent` and `accent-hover` |
| `--color-highlight` | Yellow | `bg-highlight`, `text-highlight` | Selection, hero hill, toast check, chart fill for LANGUAGE |
| `--color-highlight-deep` | Yellow Deep | `text-highlight-deep` | Decorative icons on yellow soft |
| `--color-highlight-strong` | Yellow Strong | `text-highlight-strong` | Pending-badge text |
| `--color-highlight-soft` | Yellow Soft | `bg-highlight-soft` | Date tiles, pending badges, yellow-tone tiles, observation panel |
| `--color-highlight-on` | Ink | `text-highlight-on` | Text on `highlight` |
| `--color-danger` | Red 700 | `text-danger`, `bg-danger`, `border-danger` | Errors, destructive confirm button |
| `--color-danger-soft` | Red 50 | `bg-danger-soft` | Error alert background, danger badge |
| `--color-danger-border` | Red 200 | `border-danger-border` | Error alert border |
| `--color-focus` | Teal Strong | `outline-focus`, `ring-focus` | Every focus indicator |

### Non-color tokens (also defined in `globals.css` and surfaced in `tailwind.config.ts`)

**Shadows** (rgba built from the ink and teal channels):

| Token | Value | Tailwind | Template equivalent |
|---|---|---|---|
| `--shadow-sm` | `0 1px 2px 0 rgb(var(--ink-700) / 0.06)` | `shadow-sm` | `shadow-sm` on buttons |
| `--shadow-card` | `0 10px 15px -3px rgb(var(--ink-700) / 0.08), 0 4px 6px -4px rgb(var(--ink-700) / 0.06)` | `shadow-card` | `hover:shadow-lg` on cards |
| `--shadow-cta` | `0 10px 15px -3px rgb(var(--teal-500) / 0.15), 0 4px 6px -4px rgb(var(--teal-500) / 0.15)` | `shadow-cta` | `shadow-lg shadow-[#2A9D8F]/15` on the hero CTA |
| `--shadow-float` | `0 20px 25px -5px rgb(var(--ink-700) / 0.15), 0 8px 10px -6px rgb(var(--ink-700) / 0.10)` | `shadow-float` | `shadow-xl` on toast, floating cart, hero shapes |
| `--shadow-modal` | `0 25px 50px -12px rgb(var(--ink-700) / 0.25)` | `shadow-modal` | `shadow-2xl` on dialog and drawer |

**Motion:**

| Token | Value |
|---|---|
| `--dur-fast` | `150ms` |
| `--dur-base` | `200ms` (the default for `transition`) |
| `--dur-slow` | `300ms` |
| `--dur-progress` | `1000ms` |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` (the default) |
| `--ease-emphasized` | `cubic-bezier(.2,.7,0,1)` |

**Tailwind `extend` entries for the rest:**
- `borderRadius`: `modal: '28px'`, `hero: '36px'`. Keep the defaults `lg` (8px), `xl` (12px), `2xl` (16px) and `full`.
- `zIndex`: `header: '40'`, `overlay: '50'`, `toast: '80'`.
- `maxWidth`: `dashboard: '1440px'`. Public pages use the default `max-w-7xl` (1280px).
- `spacing`: `'dashboard-header': '76px'`.
- `fontFamily`: `sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']`. The font comes from `@fontsource-variable/inter`, imported once in `main.tsx`.
- `borderColor`: `DEFAULT` = `--color-border`, so a bare `border` is the hairline.
- `boxShadow`: `sm`, `card`, `cta`, `float` and `modal`, each set to `var(--shadow-…)`.
- `fontSize`: the tokens in the Typography table below, in Tailwind tuple form, e.g. `display: ['48px', { lineHeight: '1.05', letterSpacing: '-0.045em', fontWeight: '600' }]`. The default size keys stay available.
- `transitionDuration`: `DEFAULT`, `fast`, `base`, `slow` and `progress`, each set to `var(--dur-…)` (`DEFAULT` is `var(--dur-base)`).
- `transitionTimingFunction`: `DEFAULT` and `standard` set to `var(--ease-standard)`; `emphasized` set to `var(--ease-emphasized)`.
- `keyframes` and `animation` for the overlays listed under Motion:
  - `overlay-in`
  - `content-in`
  - `sheet-in-right`
  - `toast-in`

### Base layer (`globals.css`, `@layer base`)

- `html`: `bg-canvas`, `scroll-behavior: smooth`, `color-scheme: light`.
- `body`: `bg-canvas text-ink font-sans antialiased`.
- `::selection`: `background: rgb(var(--color-highlight)); color: rgb(var(--color-highlight-on))`.
- `button`: `cursor: pointer`.
- Interactive elements: `-webkit-tap-highlight-color: transparent`.
- **Reduced motion.** Copy the template's block word for word:

  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

### The no-raw-color rule (hard)

**No raw hex anywhere in `src/` except `src/globals.css`.** The same goes for color literals written as `rgb()`, `rgba()` or `hsl()`, and for arbitrary color classes such as `bg-[#…]` or `text-[rgb(…)]`.

- `tailwind.config.ts` references CSS vars only.
- The rule is enforced by `e2e/no-hex.spec.ts`, which scans **all of `src/`** except `src/globals.css`. It covers `.ts`, `.tsx` and `.css` files with the pattern `#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\b`, and also flags `rgba?\(` and `hsla?\(`.
- **Allowed exceptions** (outside `src/`):
  - `<meta name="theme-color" content="#FDFBF7">` in `index.html`;
  - brand assets in `public/brand/`.

---

## Typography

**Inter Variable** is the only family, with the system UI stack as fallback.
- Weights: 400 for body, 500 for labels and nav, 600 for headings and buttons, 700 for eyebrows, badges and the date-tile day.
- Display sizes use tight negative tracking. Body text uses normal tracking. Uppercase micro-labels use wide positive tracking.

| Token (`text-…`) | Size | Line height | Weight | Tracking | Template use |
|---|---|---|---|---|---|
| `display-lg` | 60px | 1.05 | 600 | -0.045em | Hero h1 at `sm` and up |
| `display` | 48px | 1.05 | 600 | -0.045em | Hero h1 (mobile), with `text-balance` |
| `h1` | 36px | 1.15 | 600 | -0.025em | Section heading at `sm` and up; page title |
| `h2` | 30px | 1.2 | 600 | -0.025em | Section heading (mobile); dashboard title |
| `h3` | 20px | 1.35 | 600 | -0.01em | Dialog title, sub-section |
| `h4` | 16px | 1.4 | 600 | 0 | Card titles, table emphasis |
| `body-lg` | 18px | 32px | 400 | 0 | Hero sub-heading |
| `body` | 16px | 28px | 400 | 0 | Section intros, prose |
| `body-sm` | 14px | 24px | 400 | 0 | Card body, labels, buttons (`md`) |
| `caption` | 12px | 18px | 400 | 0 | Meta lines, hints, footnotes |
| `eyebrow` | 14px | 20px | 700 | 0.16em | Section eyebrow (add `uppercase`) |
| `overline` | 12px | 16px | 700 | 0.05em | Badges, pills, table heads, role labels (add `uppercase`) |
| `micro` | 11px | 13px | 700 | 0.12em | Month in the date tile only (add `uppercase`) |

**Rules:**
- The hero pairs `text-display sm:text-display-lg`. Section headings pair `text-h2 sm:text-h1`.
- The **minimum size for readable text is 12px**. `micro` (11px) is allowed only where the same information is also given in full, for example a date tile whose full date is in its `aria-label` or in `sr-only` text.
- Prose sits at 60–70 characters per line (`max-w-xl` / `max-w-2xl`).

---

## Spacing and layout

- **Base unit** is 4px (the Tailwind default scale). The density is comfortable.
- **Public container:** `mx-auto max-w-7xl px-5 lg:px-8`.
  - Section rhythm is `py-20`.
  - The hero is `pt-20 pb-20 lg:pt-28`, laid out as `grid gap-12 lg:grid-cols-[1.02fr_.98fr] lg:items-center`.
- **Dashboard:**
  - Sidebar: `w-64` (collapsed `w-24`), `lg:block`.
  - Sticky header: `h-dashboard-header` (76px).
  - Main: `mx-auto max-w-dashboard p-5 lg:p-8`.
- **Grids:**
  - classes: `md:grid-cols-2 lg:grid-cols-3`
  - kits: `sm:grid-cols-2 lg:grid-cols-4`
  - info cards: `md:grid-cols-3`
  - Gaps are `gap-4` or `gap-5`.
- **Card padding:** `p-5` (compact) or `p-6` (standard); `sm:p-8` for feature panels.
- **Stacks:** label → control `mt-2`; title → body `mt-2`; eyebrow → heading `mt-2`/`mt-3`; heading → intro `mt-4`/`mt-5`.

## Radius

| Use | Class | Value |
|---|---|---|
| Inner buttons, quantity steps, segmented items | `rounded-lg` | 8px |
| **Controls**: buttons, inputs, selects, icon buttons, chips, date tiles, alerts | `rounded-xl` | 12px |
| **Cards**: cards, panels, kit tiles, educator tiles, floating cart | `rounded-2xl` | 16px |
| **Modals**: dialog (`rounded-t-modal sm:rounded-modal`), drawer (`sm:rounded-l-modal`) | `rounded-modal` | 28px |
| Hero art panel | `rounded-hero` | 36px |
| **Pills**: badges, eyebrow pill, toast, avatars, dots | `rounded-full` | 9999px |

## Elevation

Content cards are **flat**: a 1px border, no shadow. Elevation shows interaction or overlay.

| Level | Recipe |
|---|---|
| Resting card | `border border-border bg-surface` (no shadow) |
| Hovered interactive card | `hover:shadow-card hover:border-primary/40` |
| Buttons | `shadow-sm` (primary and accent only); the hero primary CTA uses `shadow-cta` |
| Floating (toast, floating cart, hero shapes) | `shadow-float` |
| Overlay (dialog, drawer) | `shadow-modal`, over the scrim `bg-ink/40 backdrop-blur-sm` |
| Sticky headers | translucency instead of a shadow: `bg-surface/90 backdrop-blur-md` (public) or `bg-canvas/90 backdrop-blur` (dashboard), plus `border-b border-border` |

## Motion

Motion is gentle and quick. It confirms an action and never decorates for its own sake. Use CSS only; there is no animation library.

| Pattern | Recipe |
|---|---|
| Button hover lift | `transition motion-safe:hover:-translate-y-0.5` (primary, accent, secondary) |
| Card hover lift | `transition motion-safe:hover:-translate-y-1` |
| Arrow nudge | `transition motion-safe:group-hover:translate-x-1` |
| Kit icon zoom | `transition motion-safe:group-hover:scale-110` |
| Dialog | Scrim `animate-overlay-in` (fade, base). Content `animate-content-in`: opacity 0 → 1 and `translateY(30px)` → 0, over `--dur-slow` with `--ease-emphasized` |
| Drawer (cart) | `animate-sheet-in-right`: `translateX(100%)` → 0, slow, emphasized |
| Toast | `animate-toast-in`: opacity 0, `translateY(20px) scale(.95)` → rest, base |
| Mobile nav | height and opacity collapse, base |
| Progress and level bars | `transition-[width] duration-progress ease-emphasized`, growing from `0` to the value on mount |
| Skeleton | `motion-safe:animate-pulse` |
| Spinner | `motion-safe:animate-spin` |

**Rules:**
- Every transform-based animation is wrapped in `motion-safe:`.
- The global reduced-motion block neutralizes durations.
- Nothing loops forever except the spinner and skeleton while loading.

---

## Components (recipes in tokens)

These are the canonical class recipes. The primitives in `src/components/ui/` encapsulate them, using `cva` variants and `cn()`. Screens compose those primitives and never re-type the recipes.

**Shared focus recipe (`FOCUS`).** Every interactive element gets it, and it must never be removed:
`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`

### Button (`components/ui/button.tsx`)

**Base:**
`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-base ease-standard {FOCUS} disabled:pointer-events-none disabled:opacity-50`

**Sizes:**

| Size | Classes |
|---|---|
| `sm` | `h-9 px-3 text-body-sm` |
| `md` | `h-11 px-4 text-body-sm` |
| `lg` | `h-12 px-5 text-body` |
| `icon` | `h-10 w-10` |

**Variants:**

| Variant | Recipe | Template origin |
|---|---|---|
| `primary` | `bg-primary-strong text-primary-on shadow-sm hover:bg-primary-strong-hover motion-safe:hover:-translate-y-0.5` | "Find a weekend class", "Save assessment" |
| `accent` | `bg-accent text-accent-on shadow-sm hover:bg-accent-hover motion-safe:hover:-translate-y-0.5` | "Enroll a child", "Add to bag", **"Pesan via WhatsApp"** |
| `secondary` | `border border-border bg-surface text-ink hover:border-primary motion-safe:hover:-translate-y-0.5` | "How RUMI works", "Quiet action" |
| `soft` | `bg-primary-soft text-primary-strong hover:ring-1 hover:ring-inset hover:ring-primary/30` | "Quick add", "Update results" |
| `ghost` | `text-primary-strong hover:bg-primary-soft` | "Parent login" |
| `link` | `h-auto px-0 text-primary-strong underline-offset-4 hover:underline` (often with a trailing `ArrowRight` of 14–16px) | "Shop all →", "View all →" |
| `danger` | `bg-danger text-ink-inverse hover:bg-danger/90` | confirming "Batalkan pesanan" |
| `icon` | `text-ink hover:bg-primary-soft` | close, menu, notifications; **needs `aria-label`** |

**Usage rules:**
- The hero primary CTA adds `shadow-cta`.
- A screen has **one** `accent` button per decision point.
- `primary` is for navigation and confirmation.
- `accent` is for commitment actions: booking, adding to the cart, ordering.

### Form controls (`components/ui/input.tsx`: Input, Select, Textarea, Checkbox, Field)

**Control:**
`w-full rounded-xl border border-border-strong bg-surface px-3 py-3 text-body-sm text-ink placeholder:text-ink-tertiary transition {FOCUS} focus-visible:border-primary-strong aria-[invalid=true]:border-danger disabled:bg-surface-subtle disabled:text-ink-disabled`

| Control | Extra |
|---|---|
| Select | `appearance-none pr-9`, plus a `ChevronDown` (16px) at `pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary` with `aria-hidden` |
| Search input | `pl-10`, plus a `Search` icon (17px) at `absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary` |
| Textarea | `min-h-32` |
| Checkbox | `h-4 w-4 rounded border-border-strong accent-primary-strong {FOCUS}`; the label row is `flex cursor-pointer items-center gap-3 rounded-xl border border-border-subtle p-3 hover:bg-surface-subtle` |

**`Field` wrapper:**
- Label: `block text-body-sm font-medium text-ink-secondary`.
- Control: `mt-2`.
- Hint: `mt-1.5 text-caption text-ink-tertiary`.
- Error: `mt-1.5 flex items-center gap-1.5 text-caption font-medium text-danger`, with an `AlertCircle` 14px icon.
- The control gets `aria-invalid="true"` and an `aria-describedby` that points at the hint and error ids.
- A required field shows `*`, plus `sr-only` "wajib".

**Quantity stepper:**
- Wrapper: `flex items-center gap-2 rounded-xl border border-border px-2 py-1`.
- Steps: `grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-subtle {FOCUS}`, with `aria-label`s "Kurangi jumlah" and "Tambah jumlah".
- Value: `w-6 text-center text-body-sm font-semibold`, with `aria-live="polite"`.

### Card family (`components/ui/card.tsx`)

| Card | Recipe |
|---|---|
| **Card** | `rounded-2xl border border-border bg-surface p-5` (or `p-6`) |
| **Interactive card** | Card + `group transition duration-base hover:border-primary/40 hover:shadow-card motion-safe:hover:-translate-y-1` |
| **Canvas card** (template `InfoCard`) | `rounded-2xl border border-border bg-canvas p-6` |
| **Feature panel** (teal note) | `rounded-2xl bg-primary-strong p-6 text-ink-inverse sm:p-8`; secondary text `text-ink-inverse/80`; an inner action button uses `secondary` styling on `bg-surface` |
| **Tint panel** | `rounded-2xl bg-{tone}-soft p-6` (observation note, gallery-style intro) |
| **Inline note** | `rounded-xl bg-primary-soft p-4 text-body-sm text-ink-secondary` |

**Icon chip:**
- `grid h-11 w-11 place-items-center rounded-xl bg-{tone}-soft text-ink`, with an icon of 18–20px.
- The `h-10 w-10` version is used in stat cards.

### Badge and pills (`components/ui/badge.tsx`)

**Base:**
`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-overline uppercase`

| Variant | Recipe | Meaning |
|---|---|---|
| `success` | `bg-primary-soft text-primary-strong` | Paid, confirmed, attended, open, in stock |
| `pending` | `bg-highlight-soft text-highlight-strong` | Waiting for WhatsApp confirmation, reserved, draft |
| `attention` | `bg-accent-soft text-accent-strong` | Few seats or little stock left, full, absent |
| `neutral` | `bg-surface-subtle text-ink-secondary ring-1 ring-inset ring-border` | Cancelled, closed, out of stock |
| `danger` | `bg-danger-soft text-danger` | Errors only (rare as a badge) |

**Other pills:**
- **Hero eyebrow pill:** `inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-overline uppercase text-accent-strong`, with a dot `h-2 w-2 rounded-full bg-accent` (`aria-hidden`).
- **Section eyebrow:** `text-eyebrow uppercase text-accent-strong`. Alternate it with `text-primary-strong` section by section, as the template does.
- **Section header block:** eyebrow, then `mt-3 text-h2 text-ink sm:text-h1`, then an optional `mt-4 max-w-xl text-body text-ink-secondary`.

### RUMI composites (`components/rumi/`)

**Date tile:**
- Tile: `grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-highlight-soft text-center text-ink`.
- Day: `block text-xl font-bold leading-none`.
- Month: `text-micro uppercase` (for example "NOV").
- The tile carries `aria-label` with the full date, e.g. "Sabtu, 14 November 2026".

**ClassCard** (template `ScheduleCard`):
- Interactive card with `flex flex-col justify-between`.
- Top row: `flex gap-4`, holding the date tile and then:
  - a seat badge;
  - the title (`text-h4`);
  - meta rows `mt-2 flex items-center gap-1 text-caption text-ink-secondary` with `MapPin` and `Clock3` (13–14px icons): the location, `time_slot` + " WIB", and the age range "Usia 3–6".
- Price: `mt-3 text-body font-semibold`, formatted with `formatRupiah`.
- Footer action: `mt-6 flex items-center justify-between border-t border-border-subtle pt-4 text-body-sm font-semibold text-accent-strong` with "Pesan Kursi" and an `ArrowRight` nudge.
- When `is_full`, the footer is disabled and the badge reads "Penuh".

**KitCard** (template `ProductCard`):
- Wrapper: `group overflow-hidden rounded-2xl border border-border bg-surface`.
- Media: a `button` that opens the detail, `grid h-44 place-items-center bg-{tone}-soft` with the domain icon at 48px `text-ink/60 transition motion-safe:group-hover:scale-110` (`aria-hidden`), or the `image_url` as `h-44 w-full object-cover`.
- Body: `p-4`, holding:
  - the category `text-caption font-semibold text-primary-strong`;
  - the name `mt-1 text-h4`;
  - the price `mt-2 font-semibold`;
  - the stock badge.
- Action: `px-4 pb-4` with a full-width `soft` button "Tambah ke Keranjang", disabled with "Stok habis" when `stock = 0`.

**EducatorCard:**
- Card `p-5`.
- Initials tile: `mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-{tone}-soft text-xl font-semibold text-ink`.
- Name: `text-h4`.
- Role: `mt-2 text-overline uppercase text-accent-strong`.
- Bio: `mt-4 text-body-sm text-ink-secondary`.

**StatCard:**
- Card.
- Label: `text-body-sm text-ink-tertiary`.
- Value: `mt-2 text-3xl font-semibold tracking-tight text-ink` (for example "Rp 2.480.000").
- Icon chip: `h-10 w-10` in the matching tint.
- Footnote: `mt-4 text-caption font-semibold text-primary-strong`, with **real data only**.

**DomainChart** (latest level per domain):
- Rows: `space-y-6`.
- Header row: `mb-2 flex justify-between text-body-sm`, with the label `font-semibold` and the value `text-ink-secondary` showing the level label plus "(3/4)".
- Track: `h-3 overflow-hidden rounded-full bg-border-subtle`.
- Fill: `h-full rounded-full {domain bar class}` with `width: level × 25%` and the progress transition.
- Use `role="img"` with an `aria-label` that summarizes all five domains, or a visually-hidden table.
- A missing level shows "Belum ada catatan".

**Trend line:**
- An inline SVG `polyline` with `stroke-primary`, `stroke-width 2`, points as `fill-primary-strong` circles, and y ticks 1–4.
- It always comes with a text list or table of the same data.

**Stepper** (checkout and register):
- Row: `flex items-center gap-2`.
- Step: `flex flex-1 items-center gap-2`.
- Circle: `grid h-8 w-8 place-items-center rounded-full text-xs font-bold`.
  - Done or current: `bg-primary-strong text-primary-on`.
  - To do: `bg-surface-subtle text-ink-tertiary`.
  - Done steps show a `Check` (15px).
- Label: `hidden text-caption font-semibold sm:block`; `text-ink` when current, `text-ink-tertiary` otherwise.
- Connector: `h-px flex-1 bg-border`.
- The current step has `aria-current="step"`, and the list is an `<ol>`.

**Table:**
- Scroll wrapper: `overflow-x-auto`.
- Table: `w-full min-w-[600px] text-left text-body-sm`.
- Head: `border-b border-border-subtle text-overline uppercase text-ink-tertiary`; `th` is `pb-3 font-semibold` with `scope="col"`.
- Row: `border-b border-border-subtle last:border-0`.
- Cell: `py-4` (or `py-5`).
- Row action: `rounded-lg px-3 py-2 text-caption font-semibold text-primary-strong hover:bg-primary-soft {FOCUS}`.

### Overlays (Radix)

**Dialog:**
- Overlay: `fixed inset-0 z-overlay bg-ink/40 backdrop-blur-sm animate-overlay-in`.
- Positioner: `fixed inset-0 z-overlay flex items-end justify-center sm:items-center sm:p-6`.
- Content: `max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-modal bg-surface p-6 shadow-modal animate-content-in sm:rounded-modal`; the `wide` version uses `max-w-3xl`.
- Header: `mb-6 flex items-center justify-between`.
- Title: `text-h3 text-ink`. A `Dialog.Title` is mandatory.
- Close: an `icon` button with `aria-label` "Tutup".

**ConfirmDialog:** a Dialog with a body text, then `secondary` "Batal" and `primary` or `danger` confirm buttons, right-aligned (`flex justify-end gap-3`).

**Drawer (CartDrawer, built on Radix Dialog):**
- Panel: `fixed inset-y-0 right-0 z-overlay flex w-full max-w-md flex-col bg-surface shadow-modal animate-sheet-in-right sm:rounded-l-modal`.
- Header: `flex items-center justify-between border-b border-border-subtle p-5`.
- Body: `flex-1 space-y-3 overflow-auto p-5`. Each item row is `flex gap-3 rounded-xl border border-border-subtle p-3`.
- Footer: `space-y-3 border-t border-border-subtle p-5`, with a total row `flex justify-between text-body font-semibold` and a full-width `accent` "Lanjut ke Checkout".

**Toast (Radix):**
- Viewport: `fixed bottom-6 left-1/2 z-toast -translate-x-1/2`.
- Toast: `flex items-center gap-2 rounded-full bg-surface-inverse px-5 py-3 text-body-sm font-medium text-ink-inverse shadow-float animate-toast-in`.
- Success icon: `Check` 16px `text-highlight`. Error icon: `AlertCircle` 16px `text-accent`.
- It is announced via `role="status"`.

**Floating cart button:**
- Button: `fixed bottom-5 right-5 z-header flex items-center gap-4 rounded-2xl bg-surface-inverse px-5 py-4 text-ink-inverse shadow-float {FOCUS}`.
- Count chip: `grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-on`.
- Total: `text-ink-inverse/70`.
- `aria-label`: "Lihat keranjang, {n} item, {total}".

### Navigation and shells

**Public header:**
- Wrapper: `sticky top-0 z-header border-b border-border-subtle bg-canvas/90 backdrop-blur-md`.
- Row: `mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8`.
- Nav: `hidden items-center gap-8 text-body-sm font-medium text-ink-secondary md:flex`. The active link has `aria-current="page"` and `text-primary-strong font-semibold underline decoration-primary decoration-2 underline-offset-8`.
- Right side: the cart button (`icon`, with a count chip) plus a `ghost` "Masuk" or "Dasbor".
- Mobile menu: an `icon` Menu button toggles a panel `border-t border-border-subtle px-5 md:hidden`, with links `rounded-lg p-3`.

**Public footer:** the template's `RumiFooter`.
- Wrapper: `border-t border-border bg-surface`.
- Grid: `mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-3 lg:px-8`.
- Bottom bar: `border-t border-border-subtle px-5 py-5 text-center text-caption text-ink-tertiary`.

**Tabs (Radix, underline style):**
- List: `flex gap-2 overflow-x-auto border-b border-border`.
- Trigger: `whitespace-nowrap border-b-2 border-transparent px-4 pb-3 text-body-sm font-semibold text-ink-tertiary {FOCUS} data-[state=active]:border-primary data-[state=active]:text-primary-strong`.

**Segmented control:**
- Wrapper: `flex rounded-xl bg-primary-soft p-1 text-caption font-semibold`.
- Item: `rounded-lg px-3 py-2 text-ink-secondary {FOCUS} data-[state=on]:bg-surface data-[state=on]:text-primary-strong data-[state=on]:shadow-sm`.

**Dashboard shell:**
- Sidebar: `hidden border-r border-border bg-surface p-4 lg:block`.
  - Item: `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-body-sm font-medium text-ink-tertiary hover:bg-surface-subtle {FOCUS}`.
  - Active item: `bg-primary-soft text-primary-strong` with `aria-current="page"`.
- Header: `sticky top-0 z-header flex h-dashboard-header items-center justify-between border-b border-border bg-canvas/90 px-5 backdrop-blur lg:px-8`. It shows the date in `text-caption text-ink-tertiary` and a greeting in `text-h3`.
- User chip: `flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5 shadow-sm ring-1 ring-border`, with initials in `h-8 w-8 rounded-lg bg-highlight-soft text-xs font-bold`.

### Feedback states

**Inline alert:** `flex items-start gap-3 rounded-xl p-3 text-body-sm`, with a 17px icon at `mt-0.5 shrink-0`.

| Variant | Classes | Icon | Role |
|---|---|---|---|
| Info | `bg-primary-soft text-ink` | `Info`, `text-primary-strong` | `role="status"` |
| Attention | `bg-accent-soft text-ink` | `AlertTriangle`, `text-accent-strong` | `role="status"` |
| Danger | `border border-danger-border bg-danger-soft text-danger` | `AlertCircle` | `role="alert"` |

**Other states:**

| State | Recipe |
|---|---|
| **Empty state** | `flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center`. Icon chip in `primary-soft`, title `text-h4`, body `max-w-sm text-body-sm text-ink-secondary`, optional action |
| **Skeleton** | `rounded-xl bg-border-subtle motion-safe:animate-pulse`, with `aria-hidden`. The region it fills has `aria-busy="true"` |
| **Spinner** | `h-5 w-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin`, plus `sr-only` "Memuat…" |

### Hero art (CSS shapes, decorative)

**Panel:** `relative min-h-[390px] overflow-hidden rounded-hero bg-primary-soft p-6 sm:min-h-[490px]`, with `role="img"` and `aria-label={art_caption}`. Every child is `aria-hidden`.

| Piece | Recipe |
|---|---|
| Badge | `absolute right-8 top-8 rounded-full bg-surface/70 px-4 py-2 text-caption font-semibold text-primary-strong` |
| Hill | `absolute inset-x-0 bottom-0 h-2/3 rounded-t-[45%] bg-highlight/80` |
| Sun | `absolute bottom-14 left-1/2 grid h-52 w-52 -translate-x-1/2 place-items-center rounded-full border-[22px] border-surface/80 bg-accent text-center shadow-float`. It holds a `Moon` icon at 48px and the motto in `text-overline uppercase tracking-[.2em] text-accent-on` |
| Tile | `absolute bottom-12 left-7 grid h-20 w-20 place-items-center rounded-[24px] bg-surface shadow-float`, holding a `Sparkles` icon |
| Circle | `absolute bottom-24 right-8 grid h-24 w-24 place-items-center rounded-full bg-primary text-ink-inverse shadow-float` |
| Caption | `absolute left-8 top-24 max-w-[170px] text-2xl font-semibold leading-tight text-ink` |

**Logo:** `<img src="/brand/rumi-logo.svg" alt="RUMI — Rumah Main Islami" class="h-10 w-auto">`. The SVG is vendored and optimized with svgo in `public/brand/`. Do not recreate the template's "R" tile.

---

## Domain, tone and status mapping

These live in `src/lib/domains.ts` as **full literal class strings**, so that Tailwind JIT can see them. Never build a class name by concatenation.

**Tone → classes** (CMS `tone`, kit tiles, educator tiles, icon chips):

| Tone | Soft surface | Solid (bars, dots) |
|---|---|---|
| `teal` | `bg-primary-soft` | `bg-primary` |
| `orange` | `bg-accent-soft` | `bg-accent` |
| `yellow` | `bg-highlight-soft` | `bg-highlight` |

**Domain → label, tone, icon:**

| Domain | Label | Tone | lucide icon |
|---|---|---|---|
| `PRACTICAL_LIFE` | Kehidupan Praktis | teal | `Hand` |
| `SENSORIAL` | Sensorial | orange | `Sparkles` |
| `LANGUAGE` | Bahasa | yellow | `BookOpen` |
| `MATH` | Matematika | teal | `Shapes` |
| `ISLAMIC_STUDIES` | Studi Islam | orange | `Moon` |

**Status → badge variant** (the labels are from PRD §5.5):

| Status | Badge |
|---|---|
| Order `PENDING_WA` | pending |
| Order `PAID` | success |
| Order `CANCELLED` | neutral |
| Class `DRAFT` | pending |
| Class `OPEN` | success |
| Class `CLOSED` | neutral |
| Class `CANCELLED` | neutral |
| Class `is_full` | attention, "Penuh" |
| Enrollment `RESERVED` | pending |
| Enrollment `CONFIRMED` | success |
| Enrollment `ATTENDED` | success |
| Enrollment `ABSENT` | attention |
| Enrollment `CANCELLED` | neutral |

**Seat indicator** (frontend constant `FEW_SEATS_THRESHOLD = 3`):

| Condition | Badge and text |
|---|---|
| `is_full` | attention, "Penuh" |
| `seats_left ≤ 3` | attention, "Sisa {n} kursi" |
| otherwise | success, "{n} kursi tersedia" |

**Stock indicator** (`LOW_STOCK_THRESHOLD = 5`, from PRD §5.5):

| Condition | Badge and text |
|---|---|
| `stock = 0` | neutral, "Stok habis" |
| `stock ≤ 5` | attention, "Sisa {n}" |
| otherwise | success, "Stok tersedia" |

## Imagery

- Illustration-first.
  - The hero is built from CSS shapes.
  - Kits are tinted tiles with a domain icon, unless `image_url` is set.
  - Educators are initials tiles.
  - Classes are represented by date tiles, not photos.
- There are **no stock photos** (the template's Unsplash gallery is out of scope).
- An `image_url` from the CMS, a class or a kit renders as `w-full object-cover rounded-2xl`. Its `alt` is the item's name or title.
- Icons come from `lucide-react` at 13–20px, with `aria-hidden="true"` unless the icon is the only content. An icon-only button carries an Indonesian `aria-label` from `t()`.
- Arabic words (CMS `values[].arabic`) are rendered as `<span lang="ar" dir="rtl">`.

## Accessibility (WCAG 2.2 AA; hard rules)

1. **Contrast.**
   - Text pairs come only from the semantic table above. Every listed text pairing is at least 4.5:1, and the ratios are in the Colors section.
   - Never put small text on `primary`, `accent-deep` or `highlight-deep`.
   - Never put white text on `accent`.
   - Never put `ink-tertiary` text on a tint.
2. **Focus.**
   - Every interactive element shows the `FOCUS` outline: 2px `focus`, offset 2px, at least 3:1 on every surface.
   - `outline-none` is allowed only together with a visible replacement.
   - Focus order follows the visual order.
   - Dialogs and the drawer trap focus, close on Esc, and return focus (Radix).
3. **Never color-only.**
   - Every status is a text badge.
   - Seat and stock indicators carry text.
   - Chart bars carry visible labels and values.
   - Form errors use an icon, text and `aria-invalid` together.
   - The active nav item uses an underline or background as well as color.
4. **Reduced motion.** The global CSS block plus the `motion-safe:` prefix on every transform. JS-driven animation checks `matchMedia('(prefers-reduced-motion: reduce)')`.
5. **Targets.** Interactive targets are at least 40×40px (`h-10`). Quantity steps (32px) are the only exception, and they still exceed the 24px WCAG 2.2 minimum.
6. **Semantics.**
   - `<html lang="id">`.
   - A skip link "Lewati ke konten utama", visible on focus, comes first in the tab order.
   - Landmarks: `header`, `nav`, `main`, `footer`.
   - One `h1` per page, with headings in order.
   - Tables use `th scope`.
   - Stepper lists are `<ol>`.
7. **Live regions.**
   - Toasts use `role="status"`.
   - Form-level errors use `role="alert"`.
   - The cart count change is announced politely.
8. **Forms.**
   - Every control has a visible `<label>`. Placeholders are examples, never labels.
   - Required fields are marked in text.
   - Inputs use `autocomplete` (`email`, `name`, `tel`, `new-password`, `current-password`, `street-address`) and `inputmode="tel"` for WhatsApp numbers.
9. **Text size.** At least 12px, except `micro` with a full-text alternative. Layouts survive 200% zoom and a 320px viewport without horizontal scrolling, except tables, which scroll inside their own wrapper.

## Do's and Don'ts

### Do
- Use `canvas` for the page and `surface` for cards. Separate them with a 1px `border`, not a shadow.
- Keep `primary` (`#2A9D8F`) for brand moments, icons, bars and large display text. Use `primary-strong` for buttons and teal text.
- Use exactly one `accent` (orange) commitment button per decision point, with `text-accent-on`.
- Paint chips, tiles and note panels with the three soft tints, rotating teal, orange and yellow as the template does.
- Use `rounded-xl` for controls, `rounded-2xl` for cards, `rounded-modal` for overlays and `rounded-full` for pills.
- Show money through `formatRupiah` only ("Rp 150.000"), and dates in Indonesian ("Sabtu, 14 November 2026") with times followed by "WIB".
- Use real data in every number on a dashboard. Show an empty state rather than a made-up stat.
- Wrap every hover transform in `motion-safe:`.

### Don't
- Don't write hex, `rgb()` or `hsl()` literals, or arbitrary color classes, anywhere in `src/` outside `globals.css`. Don't use Tailwind's default palette (`slate-*`, `white`), which is removed on purpose.
- Don't put white text on orange, or small text on brand teal `#2A9D8F`.
- Don't add shadows to resting content cards, and don't stack several shadows on one element.
- Don't add gradients, glassy blurs on content, or stock photography.
- Don't use more than one chromatic filled button in the same button group, or `accent` for secondary actions.
- Don't animate layout properties in loops, and don't add motion that ignores reduced-motion.
- Don't hard-code copy in components. Every string goes through `t()`.
