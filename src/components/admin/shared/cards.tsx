'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { CARD } from './styles'
import { Skeleton } from '@/components/ui/skeleton'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {Icon ? (
        <div className="flex size-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
          <Icon className="size-5 text-slate-600" aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'accent',
  sub,
  loading = false,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  tone?: 'accent' | 'green' | 'amber' | 'red' | 'slate'
  sub?: ReactNode
  loading?: boolean
}) {
  const toneCls: Record<string, string> = {
    accent: 'bg-[#009FE3]/10 text-[#009FE3]',
    green: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
    slate: 'bg-slate-500/10 text-slate-400',
  }
  return (
    <div className={cn(CARD, 'flex min-w-0 flex-col p-4')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {Icon ? (
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', toneCls[tone])}>
            <Icon className="size-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-2 space-y-1.5">
          <Skeleton className="h-7 w-20 bg-slate-800/80" />
          <Skeleton className="h-3 w-16 bg-slate-800/60" />
        </div>
      ) : (
        <>
          <p className="mt-1 truncate text-2xl font-semibold leading-tight tabular-nums text-slate-100" title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}>{value}</p>
          {sub ? (
            <p className="mt-0.5 line-clamp-2 min-h-[1.4rem] text-[11px] leading-[1.15] text-slate-400" title={typeof sub === 'string' ? sub : undefined}>
              {sub}
            </p>
          ) : (
            <p className="mt-0.5 min-h-[1.4rem]" aria-hidden="true" />
          )}
        </>
      )}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section className={cn(CARD, className)} aria-label={typeof title === 'string' ? title : undefined}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-slate-200">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </section>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-slate-100">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
