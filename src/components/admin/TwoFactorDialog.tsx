'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { api, type TwoFactorSetupResponse } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================
// TWO-FACTOR DIALOG — TOTP enrollment for the signed-in user.
// Setup returns a provisioning secret + otpauth:// URI (paste or
// scan with any authenticator). Enabling only succeeds after a
// valid code is verified server-side. Disabling re-asks for
// password + a live code.
// ============================================================

export function TwoFactorDialog({
  open,
  onOpenChange,
  enabled,
  email,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  enabled: boolean
  email: string
}) {
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'idle' | 'enroll' | 'disable'>('idle')

  function reset() {
    setSetup(null)
    setCode('')
    setPassword('')
    setMode('idle')
  }

  async function startSetup() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.twoFactor.setup()
      setSetup(r)
      setMode('enroll')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start 2FA setup')
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable() {
    if (busy || code.length !== 6) return
    setBusy(true)
    try {
      await api.twoFactor.enable(code)
      toast.success('Two-factor authentication enabled')
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDisable() {
    if (busy || code.length !== 6 || !password) return
    setBusy(true)
    try {
      await api.twoFactor.disable(password, code)
      toast.success('Two-factor authentication disabled')
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disable 2FA')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#009FE3]" aria-hidden="true" />
            Two-factor authentication
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Time-based one-time passwords (TOTP) add a second factor to your {email} sign-in.
          </DialogDescription>
        </DialogHeader>

        {mode === 'idle' && !enabled ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-slate-400">
                Works with Google Authenticator, Authy, 1Password, Microsoft Authenticator, or any
                RFC 6238 app. You will scan (or paste) a secret, then confirm one 6-digit code to
                activate.
              </p>
            </div>
            <Button onClick={() => void startSetup()} disabled={busy} className="w-full" style={{ background: '#009FE3' }}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
              Start enrollment
            </Button>
          </div>
        ) : null}

        {mode === 'enroll' && setup ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[#009FE3]/30 bg-[#009FE3]/5 p-3">
              <p className="text-xs font-semibold text-[#009FE3]">1. Add the key to your authenticator</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                In your app choose “Enter a setup key” (or scan the URI below), account{' '}
                <span className="font-medium text-slate-300">{email}</span>, time-based, 6 digits, 30 s.
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 rounded border border-slate-800 bg-slate-950/80 px-3 py-2.5">
                <code className="select-all break-all text-center font-mono text-sm font-semibold tracking-wider text-[#009FE3]">
                  {setup.secretGrouped}
                </code>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] text-slate-600 hover:text-slate-400">
                  otpauth:// URI (QR-encodable)
                </summary>
                <p className="mt-1 break-all rounded bg-slate-950/80 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
                  {setup.otpauthUri}
                </p>
              </details>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs font-semibold text-slate-300">2. Enter the current 6-digit code</p>
              <div className="mt-2">
                <Label htmlFor="totp-enable" className="sr-only">Authenticator code</Label>
                <Input
                  id="totp-enable"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="h-11 border-slate-800 bg-slate-950/60 text-center font-mono text-lg tracking-[0.5em] text-slate-200"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-600">
                Two-factor only activates after this code is verified — no half-enrolled state.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1 border-slate-800 bg-slate-900 text-slate-300">
                Cancel
              </Button>
              <Button onClick={() => void confirmEnable()} disabled={busy || code.length !== 6} className="flex-1" style={{ background: '#009FE3' }}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                Verify & enable
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'disable' && enabled ? (
          <div className="space-y-3.5">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
              <p className="flex items-center gap-1.5 font-semibold">
                <Lock className="size-3.5" aria-hidden="true" /> Disabling weakens your account
              </p>
              <p className="mt-1">Confirm with your password and a current authenticator code.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="2fa-pass" className="text-xs text-slate-400">Password</Label>
              <Input
                id="2fa-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="2fa-code" className="text-xs text-slate-400">Authenticator code</Label>
              <Input
                id="2fa-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="h-9 border-slate-800 bg-slate-950/60 text-center font-mono tracking-[0.3em] text-slate-200"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-slate-800 bg-slate-900 text-slate-300">
                Keep 2FA on
              </Button>
              <Button variant="destructive" onClick={() => void confirmDisable()} disabled={busy || code.length !== 6 || !password} className="flex-1">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Disable 2FA
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'idle' && enabled ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-emerald-300">
                Two-factor authentication is <strong>active</strong> on this account. Sign-in requires
                your password plus a 6-digit code from your authenticator.
              </p>
            </div>
            <Button variant="outline" onClick={() => setMode('disable')} className="w-full border-slate-800 bg-slate-900 text-slate-300">
              <Lock className="size-4" aria-hidden="true" /> Disable two-factor
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
