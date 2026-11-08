import { describe, expect, it } from 'vitest'
import {
  homeForRole,
  loginPathWithNext,
  parentReportPath,
  ROUTES,
  safeNextPath,
} from './navigation'

describe('navigation helpers', () => {
  it('sends each role to its home', () => {
    expect(homeForRole('PARENT')).toBe(ROUTES.parentDashboard)
    expect(homeForRole('ADMIN')).toBe(ROUTES.adminDashboard)
  })

  it('builds the report path', () => {
    expect(parentReportPath(42)).toBe('/parent/report/42')
  })

  it('accepts only same-origin paths for ?next=', () => {
    expect(safeNextPath('/play-kits?category=MATH', '/')).toBe('/play-kits?category=MATH')
    expect(safeNextPath(null, '/x')).toBe('/x')
    expect(safeNextPath('https://evil.test', '/x')).toBe('/x')
    expect(safeNextPath('//evil.test', '/x')).toBe('/x')
    expect(safeNextPath('/\\evil.test', '/x')).toBe('/x')
    expect(safeNextPath('/a\nb', '/x')).toBe('/x')
  })

  it('builds /login?next=…', () => {
    expect(loginPathWithNext('/parent/dashboard?tab=orders')).toBe(
      '/login?next=%2Fparent%2Fdashboard%3Ftab%3Dorders',
    )
    expect(loginPathWithNext('/')).toBe('/login')
    expect(loginPathWithNext('/login?next=%2Fx')).toBe('/login')
    expect(loginPathWithNext('//evil')).toBe('/login')
  })
})
