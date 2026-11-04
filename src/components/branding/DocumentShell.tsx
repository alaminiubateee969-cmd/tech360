'use client'

import { useEffect, useState } from 'react'
import type { DocumentBrandingConfig } from '@/lib/document-branding'
import { getDefaultBranding } from '@/lib/document-branding'

export function useBranding(): DocumentBrandingConfig {
  const [branding, setBranding] = useState<DocumentBrandingConfig>(getDefaultBranding())
  useEffect(() => {
    fetch('/api/admin/branding', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.branding) setBranding(d.branding) })
      .catch(() => {})
  }, [])
  return branding
}

// Reusable letterhead header for React documents — consumes branding config, never hardcoded per-page
export function LetterheadHeader({ docKind, branding }: { docKind: string; branding?: DocumentBrandingConfig }) {
  const b = branding ?? getDefaultBranding()
  return (
    <div data-print="pad" aria-hidden="true">
      <div className="flex items-start justify-between gap-6">
        <img src={b.logoAsset} alt="" className="h-12 w-auto rounded-md" />
        <div className="text-right">
          <div className="text-[17px] font-black tracking-[0.14em] text-[#0B1F33]">TECH360</div>
          <div className="mt-0.5 text-[9px] font-bold tracking-[0.22em] text-[#009FE3]">{b.tagline}</div>
          <div className="mt-0.5 text-[8.5px] tracking-[0.05em] text-[#7C8DA0]">{b.servicesLine}</div>
          <div className="mt-1.5 text-[9.5px] leading-[1.6] text-[#526173]">
            <b className="text-[#0B1F33] tracking-wide">{b.legalName}</b>
            <br />
            {b.email}
          </div>
        </div>
      </div>
      <div className="pad-rule" />
      <div className="pad-sub">
        <span>Official company document</span>
        <span>{docKind}</span>
      </div>
    </div>
  )
}

export function LetterheadFooter({ note, branding }: { note: string; branding?: DocumentBrandingConfig }) {
  const b = branding ?? getDefaultBranding()
  return (
    <div data-print="pad" className="pad-footer-line" aria-hidden="true">
      <span>{b.legalName} · {b.domain} · {b.email}</span>
      <span>{note}</span>
    </div>
  )
}

// Circular seal — ONLY rendered for allowed types via isSealAllowedFor check
export function DocumentSeal({ type, branding }: { type: 'SOW' | 'INVOICE'; branding?: DocumentBrandingConfig }) {
  const b = branding ?? getDefaultBranding()
  const allowed = type === 'SOW' ? b.sealEnabledSOW : b.sealEnabledInvoice
  if (!allowed) return null
  return (
    <div className="flex justify-end mt-4">
      <img src={b.sealAsset} alt="TECH360 LLC Official Seal — Harrisonville Missouri" style={{ width: `${b.sealSizeMm}mm`, height: `${b.sealSizeMm}mm` }} className="object-contain opacity-92" />
    </div>
  )
}
