'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy, useSyncExternalStore } from 'react'
import { Toaster } from 'sonner'
import { ArrowUp } from 'lucide-react'

// Public site views (single-route SPA with hash navigation)
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import HomeView from '@/components/site/HomeView'
import AboutView from '@/components/site/AboutView'
import ServicesView from '@/components/site/ServicesView'
import ServiceDetailView from '@/components/site/ServiceDetailView'
import IndustriesView from '@/components/site/IndustriesView'
import IndustryDetailView from '@/components/site/IndustryDetailView'
import WorkView from '@/components/site/WorkView'
import TechnologiesView from '@/components/site/TechnologiesView'
import ProcessView from '@/components/site/ProcessView'
import BlogView from '@/components/site/BlogView'
import BlogPostView from '@/components/site/BlogPostView'
import CareersView from '@/components/site/CareersView'
import ContactView from '@/components/site/ContactView'
import LegalView from '@/components/site/LegalView'
import FaqView from '@/components/site/FaqView'
import PortalView from '@/components/site/PortalView'

// Private admin console (auth-gated internally)
const AdminApp = lazy(() => import('@/components/admin/AdminApp'))

import { TRACKING } from '@/lib/constants'

// ------------------------------------------------------------------
// Consent-aware analytics: Meta Pixel + GTM load only after consent.
// Server-side /api/track events are always recorded (our own log).
// ------------------------------------------------------------------
const consentStore = {
  listeners: new Set<() => void>(),
  read(): boolean | null {
    try {
      const v = localStorage.getItem('t360_consent')
      return v === 'granted' ? true : v === 'denied' ? false : null
    } catch { return null }
  },
  write(granted: boolean) {
    try { localStorage.setItem('t360_consent', granted ? 'granted' : 'denied') } catch { /* ignore */ }
    this.listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    consentStore.listeners.add(listener)
    return () => consentStore.listeners.delete(listener)
  },
}

function useConsent() {
  const consent = useSyncExternalStore(consentStore.subscribe, consentStore.read, () => null)
  const decide = useCallback((granted: boolean) => {
    consentStore.write(granted)
    if (granted) window.dispatchEvent(new CustomEvent('t360-consent-granted'))
  }, [])
  return { consent, decide }
}

function injectAnalytics() {
  if (document.getElementById('t360-gtm')) return
  // GTM
  const s = document.createElement('script')
  s.id = 't360-gtm'
  s.async = true
  s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${TRACKING.gtmId}');`
  document.head.appendChild(s)
  // Meta Pixel
  const p = document.createElement('script')
  p.id = 't360-pixel'
  p.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${TRACKING.metaPixelId}');fbq('track','PageView');`
  document.head.appendChild(p)
  const noscript = document.createElement('noscript')
  noscript.id = 't360-pixel-noscript'
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${TRACKING.metaPixelId}&ev=PageView&noscript=1" alt=""/>`
  document.body.appendChild(noscript)
}

function trackServerEvent(name: string, path: string) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, consent: localStorage.getItem('t360_consent') === 'granted', meta: { hash: path } }),
      keepalive: true,
    }).catch(() => null)
  } catch { /* ignore */ }
}

function ConsentBanner({ onDecide }: { onDecide: (g: boolean) => void }) {
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-[0_-8px_30px_rgba(6,59,143,0.08)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-slate-600">
          We use privacy-respecting analytics (Google Tag Manager, Meta Pixel) to improve this site.
          No CRM or personal client data is ever sent to analytics platforms.{' '}
          <a href="#/legal/privacy" className="font-medium text-[#009FE3] underline underline-offset-2">Privacy Policy</a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => onDecide(false)} className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Decline</button>
          <button onClick={() => onDecide(true)} className="h-11 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white transition hover:bg-[#063B8F]">Accept</button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Reading progress bar + back-to-top (public pages) — direct DOM updates
// via rAF so scrolling never triggers React re-render cascades.
// ------------------------------------------------------------------
function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const update = () => {
      const el = barRef.current
      if (el) {
        const doc = document.documentElement
        const max = doc.scrollHeight - doc.clientHeight
        const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0
        el.style.transform = `scaleX(${pct})`
      }
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; update() })
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[80] h-[3px] bg-transparent">
      <div ref={barRef} className="h-full w-full origin-left scale-x-0 bg-gradient-to-r from-[#009FE3] via-[#063B8F] to-[#18B83A]" style={{ willChange: 'transform' }} />
    </div>
  )
}

function BackToTop() {
  const btnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let raf = 0
    const update = () => {
      const el = btnRef.current
      if (el) {
        const show = window.scrollY > 600
        el.style.opacity = show ? '1' : '0'
        el.style.pointerEvents = show ? 'auto' : 'none'
        el.style.transform = show ? 'translateY(0)' : 'translateY(12px)'
      }
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; update() })
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <button
      ref={btnRef}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-[70] flex h-11 w-11 items-center justify-center rounded-full bg-[#063B8F] text-white shadow-lg shadow-[#063B8F]/25 outline-none transition-[opacity,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
      style={{ opacity: 0, pointerEvents: 'none', transform: 'translateY(12px)' }}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  )
}

// ------------------------------------------------------------------
// Hash router
// ------------------------------------------------------------------
function parseHash(raw: string) {
  const clean = (raw || '').replace(/^#/, '') || '/'
  const parts = clean.split('/').filter(Boolean)
  const section = parts[0] ?? ''
  const param = parts[1] ?? ''
  return { section, param, full: `/${parts.join('/')}` }
}

const PUBLIC_SECTIONS = new Set(['', 'about', 'services', 'industries', 'work', 'technologies', 'process', 'blog', 'careers', 'contact', 'legal', 'faq', 'portal'])

function PublicView({ section, param, navigate }: { section: string; param: string; navigate: (h: string) => void }) {
  switch (section) {
    case '': return <HomeView onNavigate={navigate} />
    case 'about': return <AboutView />
    case 'services': return param ? <ServiceDetailView slug={param} /> : <ServicesView />
    case 'industries': return param ? <IndustryDetailView slug={param} /> : <IndustriesView />
    case 'work': return <WorkView />
    case 'technologies': return <TechnologiesView />
    case 'process': return <ProcessView />
    case 'blog': return param ? <BlogPostView slug={param} /> : <BlogView />
    case 'careers': return <CareersView />
    case 'contact': return <ContactView />
    case 'legal': return <LegalView slug={param || 'terms'} />
    case 'faq': return <FaqView />
    case 'portal': return <PortalView />
    default: return <HomeView onNavigate={navigate} />
  }
}

export default function Page() {
  const [hash, setHash] = useState<string>('/')
  const { consent, decide } = useConsent()

  useEffect(() => {
    const onHash = () => {
      const next = (window.location.hash || '#/').replace(/^#/, '') || '/'
      setHash(next)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const { section, param } = useMemo(() => parseHash(hash), [hash])
  const isAdmin = section === 'admin'

  // analytics lifecycle
  useEffect(() => {
    if (consent === true) injectAnalytics()
  }, [consent])
  useEffect(() => {
    const onGrant = () => injectAnalytics()
    window.addEventListener('t360-consent-granted', onGrant)
    return () => window.removeEventListener('t360-consent-granted', onGrant)
  }, [])
  useEffect(() => {
    trackServerEvent('page_view', hash)
    if (consent === true) {
      const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...args: unknown[]) => void }
      w.dataLayer?.push({ event: 'page_view', page_path: hash })
      w.fbq?.('track', 'PageView')
    }
  }, [hash, consent])

  const navigate = useCallback((h: string) => {
    const target = h.startsWith('#') ? h : `#${h.startsWith('/') ? '' : '/'}${h}`
    if (window.location.hash === target) {
      setHash(target.replace(/^#/, ''))
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    } else {
      window.location.hash = target
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#063B8F] focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      {isAdmin ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0B1220] text-slate-300">Loading command center…</div>}>
          <AdminApp onExit={() => navigate('#/')} />
        </Suspense>
      ) : (
        <>
          <ScrollProgressBar />
          <SiteHeader currentHash={hash} />
          <main id="main-content" className="flex-1">
            <PublicView section={section} param={param} navigate={navigate} />
          </main>
          <BackToTop />
          <SiteFooter />
        </>
      )}
      {consent === null && !isAdmin && <ConsentBanner onDecide={decide} />}
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}
