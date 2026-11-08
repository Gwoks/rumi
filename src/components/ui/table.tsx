/**
 * Table (DESIGN.md "Table"): scrolls horizontally inside its own wrapper;
 * header cells are `th scope="col"`. Give every table a caption (visible or
 * sr-only) so it has an accessible name.
 */
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { FOCUS } from '@/lib/styles'

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  caption?: React.ReactNode
  /** Hide the caption visually (keep it for screen readers). */
  hideCaption?: boolean
  wrapperClassName?: string
}

export function Table({
  caption,
  hideCaption = true,
  className,
  wrapperClassName,
  children,
  ...props
}: TableProps) {
  return (
    <div className={cn('overflow-x-auto', wrapperClassName)}>
      <table className={cn('w-full min-w-[600px] text-left text-body-sm', className)} {...props}>
        {caption && (
          <caption
            className={cn(
              'pb-3 text-left text-body-sm font-semibold text-ink',
              hideCaption && 'sr-only',
            )}
          >
            {caption}
          </caption>
        )}
        {children}
      </table>
    </div>
  )
}

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'border-b border-border-subtle text-overline uppercase text-ink-tertiary',
        className,
      )}
      {...props}
    />
  )
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-border-subtle last:border-0', className)} {...props} />
}

export function TableHeaderCell({
  className,
  scope = 'col',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope={scope} className={cn('pb-3 pr-4 font-semibold', className)} {...props} />
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('py-4 pr-4 align-middle text-ink', className)} {...props} />
}

/** Compact text action inside a row ("Lihat", "Ubah"). */
export const TableRowAction = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function TableRowAction({ className, type, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'min-h-10 rounded-lg px-3 py-2 text-caption font-semibold text-primary-strong hover:bg-primary-soft disabled:opacity-50',
        FOCUS,
        className,
      )}
      {...props}
    />
  )
})
