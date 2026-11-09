'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy, useSyncExternalStore } from 'react'
import { Toaster } from 'sonner'
import { ArrowUp } from 'lucide-react'

import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import ChatWidget from '@/components/site/ChatWidget'
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
import BlogPostView, { type BlogPost } from '@/components/site/BlogPostView'
import CareersView from '@/components/site/CareersView'
import ContactView from '@/components/site/ContactView'
import LegalView from '@/components/site/LegalView'
import FaqView from '@/components/site/FaqView'
import PortalView from '@/components/site/PortalView'
import DesignKitView from '@/components/site/DesignKitView'
import AgentPipelineView from '@/components/site/AgentPipelineView'
import PlatformView from '@/components/site/PlatformView'

const AdminApp = lazy(() => import('@/components/admin/AdminApp'))

import { TRACKING } from '@/lib/constants'
import { resolvePublicRoute } from '@/lib/public-route-catalog'
import { SITE_URL } from '@/lib/site-contact'

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
  const s = document.createElement('script')
  s.id = 't360-gtm'
  s.async = true
  s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${TRACKING.gtmId}');`
  document.head.appendChild(s)
  const p = document.createElement('script')
  p.id = 't360-pixel'
  p.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${TRACKING.metaPixelId}');fbq('track','PageView');`
  document.head.appendChild(p)
  const noscript = document.createElement('noscript')
  noscript.id = 't360-pixel-noscript'
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${TRACKING.metaPixelId}&ev=PageView&noscript=1" alt=""/>`
  document.body.appendChild(noscript)
}

function visitorAnonId(): string | null {
  try {
    let id = localStorage.getItem('t360_anid')
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      localStorage.setItem('t360_anid', id)
    }
    return id
  } catch { return null }
}

function trackServerEvent(name: string, path: string) {
  try {
    const meta: Record<string, string> = { hash: path }
    if (document.referrer) meta.referrer = document.referrer
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, anonId: visitorAnonId(), consent: localStorage.getItem('t360_consent') === 'granted', meta }),
      keepalive: true,
    }).catch(() => null)
  } catch { /* ignore */ }
}

function ConsentBanner({ onDecide }: { onDecide: (g: boolean) => void }) {
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-[0_-8px_30px_rgba(6,59,143,0.08)] print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-slate-600">
          If you accept analytics and advertising technologies, the site may load Google Tag Manager and Meta Pixel. These services may receive technical, browser, and event data according to the live configuration and their own policies.{' '}
          <a href="/legal/privacy" className="font-medium text-[#009FE3] underline underline-offset-2">Privacy Policy</a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => onDecide(false)} className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Decline</button>
          <button onClick={() => onDecide(true)} className="h-11 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white transition hover:bg-[#063B8F]">Accept</button>
        </div>
      </div>
    </div>
  )
}

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
    <div aria-hidden id="scroll-progress" className="fixed inset-x-0 top-0 z-[80] h-[3px] bg-transparent print:hidden">
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
      id="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-[70] flex h-11 w-11 items-center justify-center rounded-full bg-[#063B8F] text-white shadow-lg shadow-[#063B8F]/25 outline-none transition-[opacity,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[#009FE3] print:hidden"
      style={{ opacity: 0, pointerEvents: 'none', transform: 'translateY(12px)' }}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  )
}

function parseHash(raw: string) {
  const clean = ((raw || '').replace(/^#/, '') || '/').split('?')[0]
  const parts = clean.split('/').filter(Boolean)
  const section = parts[0] ?? ''
  const param = parts[1] ?? ''
  return { section, param, parts, full: `/${parts.join('/')}` }
}

function UnknownPublicRoute({ navigate }: { navigate: (h: string) => void }) {
  return (
    <div className="grid min-h-[65vh] place-items-center bg-[#F7FAFC] px-5 py-20">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#009FE3]">404 · Page not found</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1F33]">That TECH360 page does not exist.</h1>
        <p className="mt-4 leading-7 text-slate-600">Check the address or return to a verified section of the website.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-8 min-h-11 rounded-lg bg-[#063B8F] px-6 text-sm font-semibold text-white transition hover:bg-[#052f72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">
          Return home
        </button>
      </section>
    </div>
  )
}

function PublicView({
  section,
  param,
  navigate,
  initialBlogPost,
}: {
  section: string
  param: string
  navigate: (h: string) => void
  initialBlogPost?: BlogPost | null
}) {
  switch (section) {
    case '': return <HomeView onNavigate={navigate} />
    case 'about': return <AboutView />
    case 'platform': return <PlatformView />
    case 'services': return param ? <ServiceDetailView slug={param} /> : <ServicesView />
    case 'industries': return param ? <IndustryDetailView slug={param} /> : <IndustriesView />
    case 'work':
      if (param && param !== 'projects' && param !== 'case-studies') {
        return <UnknownPublicRoute navigate={navigate} />
      }
      return <WorkView subView={param} />
    case 'technologies': return <TechnologiesView />
    case 'process': return <ProcessView />
    case 'blog': return param ? <BlogPostView slug={param} initialPost={initialBlogPost} /> : <BlogView />
    case 'careers': return <CareersView />
    case 'contact': return <ContactView />
    case 'legal': return <LegalView slug={param || 'terms'} />
    case 'faq': return <FaqView />
    case 'design-kit': return <DesignKitView />
    case 'portal': return <PortalView />
    case 'pipeline': return <AgentPipelineView />
    default: return <UnknownPublicRoute navigate={navigate} />
  }
}

function upsertMeta(selector: string, attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertCanonical(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

export default function Page({
  initialHash = '/',
  initialBlogPost = null,
}: {
  initialHash?: string
  initialBlogPost?: BlogPost | null
}) {
  const [hash, setHash] = useState<string>(initialHash)
  const { consent, decide } = useConsent()

  useEffect(() => {
    const fallbackHash = `#${initialHash.startsWith('/') ? initialHash : `/${initialHash}`}`
    /**
     * Legacy hash-form bookmarks (`#/route`) are permanent: canonicalise them to
     * the real path form (`/route`) once, using replaceState so the back button
     * is not polluted and no extra history entry is created. In-page anchors
     * (`#main-content`, `#workflows`) are untouched.
     */
    const raw = window.location.hash
    if (raw.startsWith('#/') && window.location.pathname === '/' && typeof history !== 'undefined') {
      const legacyPath = '/' + raw.slice(2).split('?')[0].replace(/^\/+/, '')
      if (legacyPath !== '/') history.replaceState(history.state, '', legacyPath)
      else if (raw !== '#/') history.replaceState(history.state, '', '/')
    }

    const onHash = () => {
      const raw = window.location.hash
      // Preserve current SPA route if a non-route in-page anchor (#main-content, #workflows, etc.) is triggered
      if (raw && !raw.startsWith('#/')) {
        const anchorId = raw.slice(1)
        const targetEl = anchorId ? document.getElementById(anchorId) : null
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' })
          if (anchorId === 'main-content') targetEl.focus({ preventScroll: true })
        }
        return
      }
      const next = (raw || fallbackHash).replace(/^#/, '') || '/'
      setHash(next)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [initialHash])

  /**
   * Plain-path navigation.
   *
   * Every public page now has two equivalent URLs: the crawlable document
   * (`/services/whatsapp-automation`, server-rendered by src/app/[...path]) and
   * the in-app route (the hash the SPA already understands). Anchors are
   * emitted as real paths so crawlers and no-JS visitors can follow them; this
   * delegated handler then keeps a click inside the running app instead of
   * forcing a full document load, and pushes the hash form so deep links and the
   * back button keep working exactly as before.
   */
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      if (anchor.getAttribute('target') && anchor.getAttribute('target') !== '_self') return
      if (anchor.hasAttribute('download')) return
      // A path we cannot render in-app (e.g. /api/...) must do a real request.
      const [rawPath] = href.split('#')
      const cleanPath = rawPath.split('?')[0].replace(/\/+$/, '') || '/'
      if (cleanPath !== '/' && !resolvePublicRoute(cleanPath.split('/').filter(Boolean))) return
      event.preventDefault()
      const target = cleanPath === '/' ? '#/' : `#${cleanPath}`
      if (window.location.hash === target) {
        setHash(cleanPath)
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      } else {
        window.location.hash = target
      }
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [])

  const { section, param, parts } = useMemo(() => parseHash(hash), [hash])
  const isAdmin = section === 'admin'

  // Synchronize document title, description, canonical URL, OpenGraph, and robots on every SPA route transition
  useEffect(() => {
    if (isAdmin) {
      document.title = 'Operator Command Center | TECH360'
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow')
      return
    }
    const route = resolvePublicRoute(parts)
    if (!route) {
      document.title = 'Page not found | TECH360'
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow')
      return
    }
    // Blog posts sync their own database-resolved title inside BlogPostView once loaded
    if (route.kind !== 'blog-post') {
      document.title = route.path === '/' ? route.title : `${route.title} | TECH360`
      upsertMeta('meta[name="description"]', 'name', 'description', route.description)
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', document.title)
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', route.description)
    }
    const canonicalUrl = route.path === '/' ? SITE_URL : `${SITE_URL}${route.path}`
    upsertCanonical(canonicalUrl)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    upsertMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      route.noIndex ? 'noindex, nofollow' : 'index, follow',
    )
  }, [parts, isAdmin])

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
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          const main = document.getElementById('main-content')
          main?.focus()
          main?.scrollIntoView({ behavior: 'smooth' })
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#063B8F] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>
      {isAdmin ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0B1220] text-slate-300">Loading command center…</div>}>
          <AdminApp onExit={() => navigate('#/')} />
        </Suspense>
      ) : (
        <>
          <ScrollProgressBar />
          <SiteHeader currentHash={hash} />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <PublicView
              section={section}
              param={param}
              navigate={navigate}
              initialBlogPost={initialBlogPost}
            />
          </main>
          <BackToTop />
          <SiteFooter />
          <ChatWidget />
        </>
      )}
      {consent === null && !isAdmin && <ConsentBanner onDecide={decide} />}
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}
