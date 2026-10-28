'use client'

import { Crown, Download, ExternalLink, FileText, Mail, MapPin, Phone, Printer, ShieldCheck, UserCog } from 'lucide-react'

import { ADMIN_ROLES, OFFICIAL_INFO } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Official Info — every official TECH360 LLC fact on one screen,
 * framed like the company pad. Same data as /api/official-info and
 * the shareable PDF (OFFICIAL_INFO in src/lib/constants.ts).
 */
export function OfficialInfoView() {
  const contacts = [
    { icon: MapPin, label: 'Registered address', value: OFFICIAL_INFO.address },
    { icon: Phone, label: 'Phone (official pad)', value: OFFICIAL_INFO.padPhone },
    { icon: Phone, label: 'Phone (platform)', value: OFFICIAL_INFO.phone },
    { icon: Mail, label: 'Email (official pad)', value: OFFICIAL_INFO.padEmail },
    { icon: Mail, label: 'Email (platform)', value: OFFICIAL_INFO.email },
  ]

  return (
    <div className="space-y-5">
      {/* Pad header */}
      <div className="overflow-hidden rounded-xl bg-white text-[#0B1F33] shadow">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5">
          <img src="/brand/tech360-logo-original.jpg" alt="TECH360 LLC — official letterhead" className="h-12 w-auto" width={48} height={48} />
          <div className="text-right">
            <p className="text-lg font-black tracking-[0.14em]">TECH360</p>
            <p className="text-[10px] font-bold tracking-[0.22em] text-[#009FE3]">{OFFICIAL_INFO.tagline}</p>
            <p className="text-[10px] text-slate-500">{OFFICIAL_INFO.servicesLine}</p>
          </div>
        </div>
        <p className="px-6 pt-2 text-right text-[11px] leading-relaxed text-slate-500">
          <b className="text-[#0B1F33]">{OFFICIAL_INFO.legalName}</b> · Missouri LLC {OFFICIAL_INFO.missouriLLC} · EIN {OFFICIAL_INFO.ein}
          <br />
          {OFFICIAL_INFO.address}
        </p>
        <div className="mx-6 mb-2 mt-3 h-[5px] rounded bg-gradient-to-r from-[#063B8F] via-[#009FE3] to-[#18B83A]" aria-hidden="true" />
        <div className="flex justify-between px-6 pb-3 text-[9px] uppercase tracking-[0.16em] text-slate-400">
          <span>Official company document</span>
          <span>Official Information</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-[#009FE3] hover:bg-[#063B8F]">
          <a href={OFFICIAL_INFO.officialInfoPdf} target="_blank" rel="noreferrer">
            <Download className="size-4" aria-hidden="true" /> Official Info PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={OFFICIAL_INFO.letterheadPdf} target="_blank" rel="noreferrer">
            <FileText className="size-4" aria-hidden="true" /> Letterhead PDF (pad)
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={OFFICIAL_INFO.officialInfoDoc} target="_blank" rel="noreferrer">
            <Printer className="size-4" aria-hidden="true" /> Print sheet
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={OFFICIAL_INFO.liveSite} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden="true" /> Live site
          </a>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p><b className="text-slate-900">Legal name:</b> {OFFICIAL_INFO.legalName}</p>
            <p><b className="text-slate-900">Entity:</b> {OFFICIAL_INFO.entityType}</p>
            <p><b className="text-slate-900">Missouri LLC No.:</b> {OFFICIAL_INFO.missouriLLC} · <b>EIN:</b> {OFFICIAL_INFO.ein}</p>
            <p><b className="text-slate-900">Motto:</b> {OFFICIAL_INFO.motto}</p>
            <p><b className="text-slate-900">Pad line:</b> {OFFICIAL_INFO.padTagline}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Official contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm text-slate-600">
            {contacts.map((c) => (
              <p key={c.label} className="flex items-start gap-2">
                <c.icon className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                <span>
                  <b className="text-slate-900">{c.label}:</b>{' '}
                  {c.value}
                </span>
              </p>
            ))}
            <p className="text-xs text-slate-400">Pad prints {OFFICIAL_INFO.padWebsite} · platform runs on www.{OFFICIAL_INFO.website} — both published, never conflated.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services (official pad)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICIAL_INFO.padServices.map((s) => (
              <div key={s.name} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-slate-500">{s.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-[#009FE3]" aria-hidden="true" /> Console logins — Super Admin &amp; Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Login: <a href={OFFICIAL_INFO.adminLoginPath} className="font-medium text-[#009FE3] underline underline-offset-2">{OFFICIAL_INFO.adminLoginPath}</a>
            {' '}· Client portal: <a href={OFFICIAL_INFO.clientPortalPath} className="font-medium text-[#009FE3] underline underline-offset-2">{OFFICIAL_INFO.clientPortalPath}</a>
            {' '}· First accounts seeded from server env (<code>ADMIN_EMAIL</code> / <code>STAFF_ADMIN_EMAIL</code>) — passwords are never printed here. Create more under <b>Team → Create user</b>.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {ADMIN_ROLES.map((r) => (
              <div key={r.role} className="rounded-lg border p-4">
                <p className="flex items-center gap-2 font-semibold">
                  {r.role === 'SUPER_ADMIN' ? (
                    <Crown className="size-4 text-[#009FE3]" aria-hidden="true" />
                  ) : (
                    <UserCog className="size-4 text-[#18B83A]" aria-hidden="true" />
                  )}
                  {r.label}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{r.role}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.summary}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                  {r.can.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
