import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

describe('Tabs', () => {
  it('switches panels with the keyboard and marks the active tab', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Contoh">
          <TabsTrigger value="a">Ringkasan</TabsTrigger>
          <TabsTrigger value="b">Kehadiran</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    )
    const first = screen.getByRole('tab', { name: 'Ringkasan' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first.className).toContain('data-[state=active]:border-primary')
    await userEvent.click(screen.getByRole('tab', { name: 'Kehadiran' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B')
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel A')
  })
})
