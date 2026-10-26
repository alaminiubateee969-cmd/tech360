'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { SCROLL_THIN } from './styles'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  className?: string
  thClassName?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows?: T[]
  loading?: boolean
  loadingRows?: number
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  maxHeightClass?: string
  'aria-label'?: string
  filterPills?: Array<{ label: string; onClear: () => void }>
}

export function DataTable<T>({
  columns,
  rows,
  loading = false,
  loadingRows = 6,
  rowKey,
  onRowClick,
  empty,
  maxHeightClass = 'max-h-[70vh]',
  'aria-label': ariaLabel,
  filterPills,
}: DataTableProps<T>) {
  const skeletonCount = loading ? loadingRows : 0
  const showEmpty = !loading && (!rows || rows.length === 0)
  return (
    <div className="space-y-2">
      {filterPills && filterPills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1" aria-label="Active filters">
          {filterPills.map((pill, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full border border-[#009FE3]/30 bg-[#009FE3]/10 px-2.5 py-1 text-xs text-[#009FE3]">
              {pill.label}
              <button type="button" onClick={pill.onClear} aria-label={`Clear filter ${pill.label}`} className="ml-0.5 rounded-full p-0.5 hover:bg-[#009FE3]/20">×</button>
            </span>
          ))}
        </div>
      ) : null}
      <div
        className={cn('relative w-full overflow-auto rounded-lg border border-slate-800', maxHeightClass, SCROLL_THIN)}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
      <Table className="min-w-[640px]">
        <TableHeader className="sticky top-0 z-10 bg-[#0d1526]">
          <TableRow className="hover:bg-transparent border-slate-800">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  'h-9 bg-[#0d1526] px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500',
                  c.thClassName,
                )}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <TableRow key={`sk-${i}`} className="border-slate-800/60">
              {columns.map((c) => (
                <TableCell key={c.key} className="px-3 py-2.5">
                  <Skeleton className={cn('h-4 w-full max-w-[140px] bg-slate-800/80')} />
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!loading &&
            rows &&
            rows.map((row, i) => (
              <TableRow
                key={rowKey(row) || `row-${i}`}
                className={cn(
                  'border-slate-800/60 text-slate-300',
                  onRowClick && 'cursor-pointer hover:bg-slate-800/40 focus-visible:bg-slate-800/40',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn('px-3 py-2.5 text-[13px]', c.className)}>
                    {c.cell(row, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {showEmpty && (
            <TableRow className="border-slate-800/60">
              <TableCell colSpan={columns.length} className="px-3 py-10 text-center">
                {empty ?? <span className="text-sm text-slate-600">No records yet.</span>}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
    </div>
  )
}
