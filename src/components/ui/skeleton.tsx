/** Skeleton (DESIGN.md "Feedback states"): a pulsing block (motion-safe only),
 * hidden from assistive tech. The region it fills should set aria-busy. */
import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-4 w-full rounded-xl bg-border-subtle motion-safe:animate-pulse', className)}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  )
}
