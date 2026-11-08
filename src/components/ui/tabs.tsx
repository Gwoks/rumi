/** Tabs (DESIGN.md "Tabs"): Radix Tabs, underline style. The active tab has a
 * 2px primary underline plus primary-strong text (not color alone). */
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { FOCUS } from '@/lib/styles'

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('flex gap-2 overflow-x-auto border-b border-border', className)}
      {...props}
    />
  )
})

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'whitespace-nowrap border-b-2 border-transparent px-4 pb-3 text-body-sm font-semibold text-ink-tertiary transition hover:text-ink-secondary',
        FOCUS,
        'data-[state=active]:border-primary data-[state=active]:text-primary-strong',
        className,
      )}
      {...props}
    />
  )
})

export const TabsContent = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn('mt-6', FOCUS, className)} {...props} />
})
