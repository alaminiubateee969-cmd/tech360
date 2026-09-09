'use client'

import { useState } from 'react'
import { Loader2, Lock, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react'

import { api } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordScreen({
  email,
  onDone,
  onExit,
}: {
  email: string
  onDone: () => void
  onExit: () => void
}) {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!currentPassword || !newPassword) {
      setError('Both fields are required.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(24,184,58,0.08), transparent), #0B1220' }}
      role="main"
    >
      <div className="w-full max-w-md rounded-xl border border-amber-500/25 bg-slate-900/70 p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
            <ShieldAlert className="size-5 text-amber-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100">Password change required</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Signed in as <span className="font-mono text-slate-400">{email}</span>. Set a new password before
              accessing the command center.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4" aria-label="Change password form">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current" className="text-xs font-medium text-slate-400">
              Current password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
              <Input
                id="cp-current"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                className="h-10 border-slate-800 bg-slate-950/60 pl-9 text-slate-200"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new" className="text-xs font-medium text-slate-400">
              New password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
              <Input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNext(e.target.value)}
                className="h-10 border-slate-800 bg-slate-950/60 pl-9 text-slate-200"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm" className="text-xs font-medium text-slate-400">
              Confirm new password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
              <Input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10 border-slate-800 bg-slate-950/60 pl-9 text-slate-200"
              />
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-400"
            >
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={busy}
            className="h-10 w-full font-semibold"
            style={{ background: busy ? undefined : '#18B83A' }}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Updating…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" aria-hidden="true" /> Set New Password
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-600">
          <p>Passwords are hashed server-side (scrypt). This change is audit-logged.</p>
          <button
            type="button"
            onClick={onExit}
            className="flex shrink-0 items-center gap-1 text-slate-500 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/50"
          >
            <LogOut className="size-3" aria-hidden="true" /> Exit to website
          </button>
        </div>
      </div>
    </div>
  )
}
