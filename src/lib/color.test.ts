import { describe, expect, it } from 'vitest'
import { channelsToHex, readTokenHex } from './color'

const HASH = '#'

describe('channelsToHex', () => {
  it('converts space- or comma-separated channels', () => {
    expect(channelsToHex('42 157 143')).toBe(`${HASH}2A9D8F`)
    expect(channelsToHex(' 0, 0, 0 ')).toBe(`${HASH}000000`)
  })

  it('rejects malformed channels', () => {
    expect(channelsToHex('1 2')).toBeNull()
    expect(channelsToHex('256 0 0')).toBeNull()
    expect(channelsToHex('a b c')).toBeNull()
  })
})

describe('readTokenHex', () => {
  it('reads a CSS custom property from the root element', () => {
    document.documentElement.style.setProperty('--test-color', '250 140 66')
    expect(readTokenHex('--test-color')).toBe(`${HASH}FA8C42`)
    expect(readTokenHex('--missing')).toBeNull()
  })
})
