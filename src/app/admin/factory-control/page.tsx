'use client'

/**
 * Direct, authenticated URL for the Software Factory Control Center.
 * The same operator surface is also available in the main admin console
 * (Product Factory → Software Factory Control Center). All API guards remain
 * authoritative; this page performs no privileged work itself.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { ControlCenter } from '@/components/admin/factory/ControlCenter'

type Me = { email: string; name?: string | null; role: string; mustChangePassword?: boolean }

export default function FactoryControlPage() {
  const [state, setState] = useState<'checking' | 'ready' | 'denied'>('checking')
  const [role, setRole] = useState('STAFF')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    if (!hadDark) root.classList.add('dark')
    let active = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Sign in through the Admin / Super Admin console first.' : 'This account cannot open the Control Center.')
        const data = await res.json() as { user: Me }
        if (!active) return
        if (data.user.mustChangePassword) { setNotice('Complete your first-login password change before opening the Control Center.'); setState('denied'); return }
        if (!['ADMIN', 'SUPER_ADMIN'].includes(data.user.role)) { setNotice(`The ${data.user.role} role is not authorized for the Software Factory Control Center.`); setState('denied'); return }
        setRole(data.user.role)
        setState('ready')
      })
      .catch((error: unknown) => { if (active) { setNotice(error instanceof Error ? error.message : 'Session check failed'); setState('denied') } })
    return () => { active = false; if (!hadDark) root.classList.remove('dark') }
  }, [])

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#0B1220' }} role="status">
        <div className="flex flex-col items-center gap-3"><Loader2 className="size-8 animate-spin text-[#009FE3]" /><p className="text-sm text-slate-500">Verifying session…</p></div>
      </div>
    )
  }
  if (state === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: '#0B1220' }}>
        <div className="max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
          <p className="font-semibold">Control Center unavailable</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{notice}</p>
          <Link href="/#/admin" className="mt-4 inline-block rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200">Back to admin console</Link>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen w-full px-3 py-4 sm:px-6 lg:py-8" style={{ background: '#0B1220' }}>
      <div className="mx-auto max-w-[1600px]">
        <ControlCenter role={role} />
      </div>
    </div>
  )
}
