'use client'

import type { AgentProviderSummary } from '@/lib/admin-client'
import { cn } from '@/lib/utils'

/** Configuration status, never a claim that an upstream inference succeeded. */
export function AgentProviderNotice({ status, compact = false }: {
  status?: AgentProviderSummary
  compact?: boolean
}) {
  if (!status) return null
  return (
    <div
      role="status"
      aria-label="AI execution provider configuration"
      className={cn(
        'rounded-lg border px-4 py-3',
        compact ? 'mb-3' : 'mb-4',
        status.configured
          ? 'border-sky-500/25 bg-sky-500/5'
          : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <p className={cn('text-xs font-semibold', status.configured ? 'text-sky-300' : 'text-amber-300')}>
        {status.configured
          ? `AI provider configured: ${status.provider} · not yet a live health check`
          : 'AI execution is unavailable: no complete provider configuration'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{status.detail}</p>
      {!compact ? (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {status.configured
            ? 'Run a read-only agent task to verify inference. Provider errors and quota limits are saved in the execution ledger.'
            : 'A Super Admin must configure the provider in the server environment and restart the app. Signing in as Admin or Super Admin does not supply AI credentials.'}
        </p>
      ) : null}
    </div>
  )
}
