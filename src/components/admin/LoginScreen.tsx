'use client'

import { useState } from 'react'
import { KeyRound, Loader2, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'

import { api, ApiError } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginScreen({ onExit, onLoggedIn }: { onExit: () => void; onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setBusy(true)
    try {
      await api.login(email.trim(), password)
      onLoggedIn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(err.message)
      else if (err instanceof Error) setError(err.message)
      else setError('Login failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="relative flex min-h-[70vh] w-full items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,159,227,0.12), transparent), #0B1220' }}
      role="main"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30,41,59,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.7) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/images/tech360-logo-web.png"
            alt="Tech360 LLC logo"
            className="h-10 w-auto"
            width={96}
            height={40}
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">Super Admin Console</h1>
            <p className="mt-1 text-xs text-slate-500">AI Command Center — Tech360 LLC</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur"
          aria-label="Login form"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-medium text-slate-400">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bdtech360.com"
                  className="h-10 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-medium text-slate-400">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-10 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
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
              style={{ background: busy ? undefined : '#009FE3' }}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Signing in…
                </>
              ) : (
                <>
                  <LogIn className="size-4" aria-hidden="true" /> Sign In
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-[11px] text-slate-600">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Authorized personnel only. All actions are audited.
          </p>
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/50"
          >
            Back to website
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-700">
          <KeyRound className="size-3" aria-hidden="true" />
          Session cookies are HttpOnly · CSRF-protected mutations
        </p>
      </div>
    </div>
  )
}
