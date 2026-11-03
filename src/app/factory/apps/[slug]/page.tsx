'use client'

/**
 * Private, config-driven company application. One URL pattern serves every
 * company; the versioned template configuration decides what it looks like
 * and which modules it runs. The API guard + explicit company grant are the
 * authoritative authorization boundary; this page only checks the session.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, LockKeyhole } from 'lucide-react'
import { RuntimeApp } from '@/components/factory/runtime/RuntimeApp'

export default function CompanyApplicationPage() {
  const params = useParams<{ slug: string }>()
  const slug = typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : ''
  const [state, setState] = useState<'checking' | 'ready' | 'denied'>('checking')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Sign in first, then open your private application.' : 'This account cannot open company applications.')
        const data = await res.json() as { user?: { mustChangePassword?: boolean; role?: string } }
        if (!active) return
        if (data.user?.mustChangePassword) { setNotice('Complete your first-login password change before opening company applications.'); setState('denied'); return }
        setState('ready')
      })
      .catch((error: unknown) => { if (active) { setNotice(error instanceof Error ? error.message : 'Session check failed'); setState('denied') } })
    return () => { active = false }
  }, [])

  if (state === 'checking') return <div className="flex min-h-screen items-center justify-center" style={{ background: '#F4FAFF' }} role="status">
    <div className="flex flex-col items-center gap-3"><Loader2 className="size-8 animate-spin text-[#063B8F]" /><p className="text-sm text-slate-500">Verifying your session…</p></div>
  </div>
  if (state === 'denied') return <div className="flex min-h-screen items-center justify-center p-6" style={{ background: '#F4FAFF' }}>
    <div className="max-w-md rounded-2xl border border-amber-300 bg-white p-6 text-sm shadow-sm">
      <p className="flex items-center gap-2 font-semibold text-amber-800"><LockKeyhole className="size-4" /> Private application</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">{notice}</p>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">Even after sign-in, an explicit active company grant is required. This is enforced on the server for every read and write.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white">Return to site</Link>
    </div>
  </div>
  return <RuntimeApp slug={slug} />
}
