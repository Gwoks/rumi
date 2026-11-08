/**
 * Runtime token inspection for /design-kit: resolve a semantic CSS var
 * (`--color-primary` → "42 157 143") and convert RGB channels to hex. Hex is
 * COMPUTED here so no literal ever lives outside globals.css.
 */

/** "42 157 143" → "#" + 6 uppercase hex digits; null unless three 0–255 channels. */
export function channelsToHex(channels: string): string | null {
  const parts = channels
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return `#${parts
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/** Read a CSS custom property from :root and return it as hex (or null). */
export function readTokenHex(
  cssVar: string,
  root: Element = document.documentElement,
): string | null {
  const value = getComputedStyle(root).getPropertyValue(cssVar)
  return value ? channelsToHex(value) : null
}
