'use client'

import { useState } from 'react'
import { Crown, FileText, KeyRound, Loader2, Lock, LogIn, Mail, ShieldCheck, UserCog } from 'lucide-react'

import { api, ApiError } from '@/lib/admin-client'
import { ADMIN_ROLES, OFFICIAL_INFO } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Super Admin & Admin login — one endpoint, role decides access.
 * Framed on the official company pad: logo + CONNECT·INNOVATE·GROW
 * header, legal identity, and the pad ADDRESS / PHONE / WEBSITE /
 * EMAIL footer, with downloads for the official letterhead PDF and
 * the Official Information Sheet. No credentials are ever shown.
 */
export function LoginScreen({ onExit, onLoggedIn }: { onExit: () => void; onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needsTotp, setNeedsTotp] = useState(false)
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
      await api.login(email.trim(), password, needsTotp ? totp.trim() : undefined)
      onLoggedIn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const data = err.data as { code?: string } | null
        if (data?.code === 'TOTP_REQUIRED') {
          setNeedsTotp(true)
          setError('Your account is protected with two-factor authentication. Enter the 6-digit code from your authenticator app.')
        } else {
          setError(err.message)
        }
      } else if (err instanceof Error) setError(err.message)
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
      <div className="relative w-full max-w-md">
        {/* — Official pad header — */}
        <div className="mb-5 overflow-hidden rounded-xl bg-white shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between gap-4 px-5 pt-4">
            <img
              src="/brand/tech360-logo-original.jpg"
              alt="TECH360 LLC — official letterhead"
              className="h-11 w-auto"
              width={44}
              height={44}
            />
            <div className="text-right">
              <p className="text-[15px] font-black tracking-[0.14em] text-[#0B1F33]">TECH360</p>
              <p className="text-[9px] font-bold tracking-[0.22em] text-[#009FE3]">{OFFICIAL_INFO.tagline}</p>
              <p className="text-[9px] text-slate-500">{OFFICIAL_INFO.servicesLine}</p>
            </div>
          </div>
          <p className="px-5 pt-2 text-right text-[10px] leading-relaxed text-slate-500">
            <b className="tracking-wide text-[#0B1F33]">{OFFICIAL_INFO.legalName}</b> · Missouri LLC {OFFICIAL_INFO.missouriLLC} · EIN {OFFICIAL_INFO.ein}
            <br />
            {OFFICIAL_INFO.address}
          </p>
          <div className="mx-5 mb-3 mt-3 h-[5px] rounded bg-gradient-to-r from-[#063B8F] via-[#009FE3] to-[#18B83A]" aria-hidden="true" />
          <div className="flex justify-between border-t border-slate-100 px-5 pb-3 pt-1.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">
            <span>Official company document</span>
            <span>Admin Access</span>
          </div>
        </div>

        <div className="mb-5 text-center">
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Super Admin &amp; Admin Login</h1>
          <p className="mt-1 text-xs text-slate-500">
            One secure login for both roles — your account role decides what you can access. New accounts are created by a Super Admin (Team → Create user) and must change their temporary password on first login.
          </p>
        </div>

        {/* — Role cards — */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ADMIN_ROLES.map((r) => (
            <div key={r.role} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                {r.role === 'SUPER_ADMIN' ? (
                  <Crown className="size-4 text-[#009FE3]" aria-hidden="true" />
                ) : (
                  <UserCog className="size-4 text-[#18B83A]" aria-hidden="true" />
                )}
                {r.label}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{r.summary}</p>
            </div>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur"
          aria-label="Super Admin and Admin login form"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-medium text-slate-400">
                Email (Super Admin or Admin)
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
            {needsTotp ? (
              <div className="space-y-1.5">
                <Label htmlFor="login-totp" className="text-xs font-medium text-slate-400">
                  Two-factor code
                </Label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                  <Input
                    id="login-totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className="h-10 border-slate-800 bg-slate-950/60 pl-9 font-mono tracking-[0.3em] text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>
            ) : null}

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

        {/* — Official downloads (pad documents) — */}
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px]">
          <a
            href={OFFICIAL_INFO.officialInfoDoc}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-slate-300 hover:text-white"
          >
            <FileText className="size-3.5" aria-hidden="true" /> Official Info Sheet
          </a>
          <a
            href={OFFICIAL_INFO.officialInfoPdf}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-slate-300 hover:text-white"
          >
            <FileText className="size-3.5" aria-hidden="true" /> Official Info PDF
          </a>
          <a
            href={OFFICIAL_INFO.letterheadPdf}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-slate-300 hover:text-white"
          >
            <FileText className="size-3.5" aria-hidden="true" /> Official Letterhead PDF
          </a>
        </div>

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

        {/* — Pad footer: ADDRESS / PHONE / WEBSITE / EMAIL — */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-[10.5px] leading-relaxed text-slate-500">
          <div className="mb-3 h-1 rounded bg-gradient-to-r from-[#18B83A] via-[#009FE3] to-[#063B8F]" aria-hidden="true" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#009FE3]">Address</p>
              <p>{OFFICIAL_INFO.addressLines[0]}<br />{OFFICIAL_INFO.addressLines[1]}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#009FE3]">Phone</p>
              <p>{OFFICIAL_INFO.padPhone}<br />{OFFICIAL_INFO.phone}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#009FE3]">Website</p>
              <p>{OFFICIAL_INFO.padWebsite}<br />www.{OFFICIAL_INFO.website}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#009FE3]">Email</p>
              <p>{OFFICIAL_INFO.padEmail}<br />{OFFICIAL_INFO.email}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-600">
            <KeyRound className="size-3" aria-hidden="true" />
            Session cookies are HttpOnly · administrative mutations are CSRF-protected
          </p>
        </div>
      </div>
    </div>
  )
}
