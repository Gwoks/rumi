/**
 * Shared class recipes that are not a component of their own (DESIGN.md
 * "Components"). Full literal strings so Tailwind JIT can see them.
 */

/** The shared focus recipe. Every interactive element gets it; never remove it. */
export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/** Public page container (max-w-7xl with the template gutters). */
export const CONTAINER = 'mx-auto w-full max-w-7xl px-5 lg:px-8'
