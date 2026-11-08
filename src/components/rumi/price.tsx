/** Rupiah amount (always through `formatRupiah`, never `$`). */
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'

export interface PriceProps {
  amount: number
  className?: string
}

export function Price({ amount, className }: PriceProps) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>{formatRupiah(amount)}</span>
  )
}
