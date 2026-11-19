'use client'

import { useEffect, useState } from 'react'
import { Eye, RotateCcw, Upload, FileText, ShieldCheck, Settings2, Image as ImageIcon, Stamp, Download } from 'lucide-react'
import { fetchJson, useApi } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Branding = {
  pageSize: 'A4' | 'LETTER' | 'A3'
  headerSpacingMm: number
  footerSpacingMm: number
  contentMarginMm: number
  headerAsset: string
  footerAsset: string
  letterheadAsset: string
  companyProfileCoverAsset: string
  proposalCoverAsset: string
  logoAsset: string
  sealAsset: string
  sealEnabledSOW: boolean
  sealEnabledInvoice: boolean
  sealPosition: 'bottom-right' | 'watermark' | 'signature-side'
  sealOpacity: number
  sealSizeMm: number
  legalName: string
  address: string
  email: string
  phone: string
  domain: string
  websiteDisplay: string
  tagline: string
  servicesLine: string
  version: number
  updatedAt: string
  updatedBy: string | null
}

const SAMPLE_TYPES = [
  { value: 'WORK_PROPOSAL', label: 'Work Proposal (cover, no seal)' },
  { value: 'COMPANY_PROFILE', label: 'Company Profile (cover, no seal)' },
  { value: 'COVER_LETTER', label: 'Cover Letter (letterhead, no seal)' },
  { value: 'SOW', label: 'Scope of Work (with seal)' },
  { value: 'INVOICE', label: 'Invoice (with seal)' },
  { value: 'OFFICIAL_LETTER', label: 'Official Letter (no seal)' },
  { value: 'TERMS', label: 'Terms & Conditions (no seal)' },
  { value: 'PRIVACY', label: 'Privacy Policy (no seal)' },
  { value: 'REFUND', label: 'Refund Policy (no seal)' },
] as const

export function DocumentBrandingView() {
  const { data, loading, error, refresh } = useApi<{ branding: Branding; history: Branding[]; defaults: Branding }>('/api/admin/branding')
  const mutate = refresh
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string>('SOW')
  // form mirrors branding
  const b = data?.branding

  async function update(patch: Partial<Branding>) {
    if (!b) return
    setSaving(true)
    try {
      const res = await fetchJson<{ branding: Branding; changed: string[] }>('/api/admin/branding', { method: 'PUT', body: patch })
      toast.success(`Branding updated: ${(res.changed ?? Object.keys(patch)).join(', ')} — v${res.branding.version}`)
      await mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function upload(assetType: 'header' | 'footer' | 'letterhead' | 'seal' | 'logo' | 'company-profile-cover' | 'proposal-cover', file: File) {
    setUploading(assetType)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('assetType', assetType)
      const csrf = document.cookie.split('; ').find(c => c.startsWith('t360_csrf='))?.split('=')[1] ?? ''
      const res = await fetch('/api/admin/branding', { method: 'POST', body: fd, headers: { 'x-csrf-token': csrf } })
      const data = await res.json() as { ok?: boolean; error?: string; publicUrl?: string; branding?: Branding }
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      toast.success(`${assetType} uploaded → ${data.publicUrl}`)
      await mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally { setUploading(null) }
  }

  async function restore() {
    if (!confirm('Restore the approved default TECH360 letterhead template? This bumps branding version.')) return
    setSaving(true)
    try {
      const res = await fetchJson<{ branding: Branding }>('/api/admin/branding', { method: 'DELETE' })
      toast.success(`Restored approved default template — v${res.branding.version}`)
      await mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
  if (error) return <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">Failed to load branding: {error}. Super Admin only.</div>
  if (!b) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight"><Settings2 className="size-5 text-[#009FE3]" /> Document Branding</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">Super Admin → Settings → Document Branding · Single source of truth for ALL official TECH360 documents. TECH360 letterhead is permanent branding. Circular seal ONLY on SOW &amp; Invoice when enabled. Every change is versioned — old documents retain their original branding snapshot.</p>
          <p className="mt-1 text-xs text-slate-500">Current version <b>v{b.version}</b> · {new Date(b.updatedAt).toLocaleString()} {b.updatedBy ? `by ${b.updatedBy}` : ''} · {b.pageSize} · header {b.headerSpacingMm}mm · footer {b.footerSpacingMm}mm</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restore} disabled={saving}><RotateCcw className="size-4" /> Restore default</Button>
          <Button variant="outline" asChild><a href={`/api/admin/branding/preview?type=${previewType}`} target="_blank" rel="noreferrer"><Eye className="size-4" /> Preview</a></Button>
        </div>
      </div>

      {/* Branding status card — header/footer/seal assets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="size-4 text-[#009FE3]" /> Header Asset</CardTitle><CardDescription className="text-xs">Top letterhead bar (black with TECH360 + contacts)</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <img src={b.headerAsset} alt="Header preview" className="h-14 w-full rounded border object-contain bg-black p-1" onError={e => (e.currentTarget.style.display='none')} />
            <p className="break-all text-xs font-mono text-slate-500">{b.headerAsset}</p>
            <Label htmlFor="upload-header" className="text-xs">Upload / replace approved header</Label>
            <Input id="upload-header" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => { const f=e.target.files?.[0]; if(f) upload('header', f)}} />
            {uploading==='header' && <p className="text-xs text-amber-500">Uploading…</p>}
            <div className="flex items-center gap-2">
              <Label className="text-xs w-32">Header spacing (mm)</Label>
              <Input type="number" value={b.headerSpacingMm} min={0} max={50} onChange={e => update({ headerSpacingMm: Number(e.target.value) })} className="h-8" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="size-4 text-[#009FE3]" /> Footer Asset</CardTitle><CardDescription className="text-xs">Bottom letterhead bar</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <img src={b.footerAsset} alt="Footer preview" className="h-14 w-full rounded border object-contain bg-black p-1" onError={e => (e.currentTarget.style.display='none')} />
            <p className="break-all text-xs font-mono text-slate-500">{b.footerAsset}</p>
            <Label htmlFor="upload-footer" className="text-xs">Upload / replace approved footer</Label>
            <Input id="upload-footer" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => { const f=e.target.files?.[0]; if(f) upload('footer', f)}} />
            {uploading==='footer' && <p className="text-xs text-amber-500">Uploading…</p>}
            <div className="flex items-center gap-2">
              <Label className="text-xs w-32">Footer spacing (mm)</Label>
              <Input type="number" value={b.footerSpacingMm} min={0} max={50} onChange={e => update({ footerSpacingMm: Number(e.target.value) })} className="h-8" />
            </div>
          </CardContent>
        </Card>
        <Card className={b.sealEnabledSOW || b.sealEnabledInvoice ? 'border-amber-300/40' : ''}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Stamp className="size-4 text-[#063B8F]" /> Circular Seal</CardTitle><CardDescription className="text-xs">ONLY for SOW &amp; Invoice when enabled · never on legal/official letters</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <img src={b.sealAsset} alt="Seal preview" className="h-20 w-20 rounded-full border object-contain bg-white p-1 mx-auto" onError={e => (e.currentTarget.style.display='none')} />
            <p className="break-all text-xs font-mono text-slate-500 text-center">{b.sealAsset}</p>
            <Label htmlFor="upload-seal" className="text-xs">Upload / replace official seal</Label>
            <Input id="upload-seal" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => { const f=e.target.files?.[0]; if(f) upload('seal', f)}} />
            {uploading==='seal' && <p className="text-xs text-amber-500">Uploading…</p>}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Enable SOW seal</Label>
              <Switch checked={b.sealEnabledSOW} onCheckedChange={v => update({ sealEnabledSOW: v })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Enable Invoice seal</Label>
              <Switch checked={b.sealEnabledInvoice} onCheckedChange={v => update({ sealEnabledInvoice: v })} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-28">Seal size mm</Label>
              <Input type="number" value={b.sealSizeMm} min={10} max={120} onChange={e => update({ sealSizeMm: Number(e.target.value) })} className="h-8 w-20" />
              <span className="text-xs text-slate-500">{b.sealPosition} · {b.sealOpacity}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Owner-supplied page and cover art — applied by the document renderer */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="size-4 text-[#009FE3]" /> Full-page Letterhead</CardTitle><CardDescription className="text-xs">Permanent page artwork for official document PDFs, including public Terms &amp; Conditions printing</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <img src={b.letterheadAsset} alt="Full-page letterhead preview" className="max-h-72 w-full rounded border bg-white object-contain" />
            <p className="break-all text-xs font-mono text-slate-500">{b.letterheadAsset}</p>
            <Label htmlFor="upload-letterhead" className="text-xs">Replace full-page letterhead</Label>
            <Input id="upload-letterhead" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => { const f=e.target.files?.[0]; if(f) upload('letterhead', f)}} />
            {uploading==='letterhead' && <p className="text-xs text-amber-500">Uploading…</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="size-4 text-[#009FE3]" /> Company Profile Cover</CardTitle><CardDescription className="text-xs">Exact approved cover art used on Company Profile documents</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <img src={b.companyProfileCoverAsset} alt="Company Profile cover preview" className="max-h-72 w-full rounded border bg-white object-contain" />
            <p className="break-all text-xs font-mono text-slate-500">{b.companyProfileCoverAsset}</p>
            <Label htmlFor="upload-company-profile-cover" className="text-xs">Replace Company Profile cover</Label>
            <Input id="upload-company-profile-cover" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => { const f=e.target.files?.[0]; if(f) upload('company-profile-cover', f)}} />
            {uploading==='company-profile-cover' && <p className="text-xs text-amber-500">Uploading…</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="size-4 text-[#009FE3]" /> Project Proposal Cover</CardTitle><CardDescription className="text-xs">Exact approved cover art applied automatically to generated Business Proposals</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <img src={b.proposalCoverAsset} alt="Project Proposal cover preview" className="max-h-72 w-full rounded border bg-white object-contain" />
            <p className="break-all text-xs font-mono text-slate-500">{b.proposalCoverAsset}</p>
            <Label htmlFor="upload-proposal-cover" className="text-xs">Replace Project Proposal cover</Label>
            <Input id="upload-proposal-cover" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => { const f=e.target.files?.[0]; if(f) upload('proposal-cover', f)}} />
            {uploading==='proposal-cover' && <p className="text-xs text-amber-500">Uploading…</p>}
          </CardContent>
        </Card>
      </div>

      {/* Page & brand identity */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Page &amp; Brand Identity</CardTitle><CardDescription className="text-xs">Page size, margins, and legal identity printed on every document</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Default page size</Label>
              <Select value={b.pageSize} onValueChange={v => update({ pageSize: v as never })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210×297mm) — default</SelectItem>
                  <SelectItem value="LETTER">Letter (8.5×11″)</SelectItem>
                  <SelectItem value="A3">A3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content margin (mm)</Label>
              <Input type="number" value={b.contentMarginMm} min={0} max={50} onChange={e => update({ contentMarginMm: Number(e.target.value) })} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Legal identity</Label>
              <p className="text-xs font-mono text-slate-500">{b.legalName} · LLC {b.legalName} · EIN {b.phone}</p>
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <b>Non-negotiable rules:</b> TECH360 letterhead is permanent for all official docs. Circular seal is ONLY for SOW and Invoice (controlled by toggles above). Legal &amp; Policies and ordinary official letters NEVER show the seal. Changes bump branding version — previously generated documents retain their original snapshot.
          </div>
        </CardContent>
      </Card>

      {/* Preview & sample generation */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Eye className="size-4 text-[#009FE3]" /> Preview &amp; Sample Documents</CardTitle><CardDescription className="text-xs">Verify header/footer, spacing, seal rule, and multi-page rendering before publishing</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Preview type</Label>
            <Select value={previewType} onValueChange={setPreviewType}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SOW">SOW (with seal)</SelectItem>
                <SelectItem value="INVOICE">Invoice (with seal)</SelectItem>
                <SelectItem value="WORK_PROPOSAL">Proposal cover (no seal)</SelectItem>
                <SelectItem value="COMPANY_PROFILE">Company Profile cover (no seal)</SelectItem>
                <SelectItem value="COVER_LETTER">Cover Letter (no seal)</SelectItem>
                <SelectItem value="LETTER">Official Letter (no seal)</SelectItem>
                <SelectItem value="LEGAL">Legal Policy (no seal)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" asChild><a href={`/api/admin/branding/preview?type=${previewType}`} target="_blank" rel="noreferrer"><Eye className="size-4" /> Open preview</a></Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_TYPES.map(s => (
              <a key={s.value} href={`/api/admin/branding/sample?type=${s.value}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border p-3 text-xs hover:bg-slate-50">
                <FileText className="size-4 text-[#009FE3]" /> {s.label}
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-500">Sample docs generated via <code>/api/admin/branding/sample?type=...</code> use the live branding engine. Company Profile and proposals use their configured exact cover images; SOW &amp; Invoice show the circular seal when enabled. Cover letters, ordinary letters and legal policies never show the seal. Samples are recorded with the current branding version in the document audit index.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><a href="/api/admin/branding/sample?type=INVOICE" target="_blank" rel="noreferrer"><Download className="size-4" /> Sample Invoice (HTML)</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/api/admin/branding/sample?type=SOW" target="_blank" rel="noreferrer"><Download className="size-4" /> Sample SOW</a></Button>
          </div>
        </CardContent>
      </Card>

      {/* Version history */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-emerald-600" /> Version History &amp; Audit</CardTitle><CardDescription className="text-xs">Every branding save creates a versioned snapshot — old documents keep their original content</CardDescription></CardHeader>
        <CardContent>
          {data?.history && data.history.length>0 ? (
            <div className="space-y-2">
              {data.history.slice(0,5).map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded border p-2 text-xs">
                  <span>v{h.version} · {new Date(h.updatedAt).toLocaleString()} · {h.updatedBy ?? 'system'}</span>
                  <span className="font-mono text-slate-500">{h.pageSize} · {h.headerAsset.split('/').pop()} · seal {h.sealEnabledSOW?'SOW✓':'SOW✗'} {h.sealEnabledInvoice?'INV✓':'INV✗'}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">No history yet — first save will create an archive entry. Previously generated documents retain original approval records and are not overwritten when the global template changes.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
