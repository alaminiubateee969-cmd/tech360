'use client'

import { useState } from 'react'
import { FileSearch, FileUp, Loader2, RefreshCw, Search, ShieldCheck, Upload } from 'lucide-react'

import {
  api,
  fmtBytes,
  fmtDate,
  getCsrf,
  parseMaybeJson,
  prettify,
  useApi,
  type KnowledgeDoc,
  type KnowledgeResponse,
} from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { StatusBadge } from './shared/StatusBadge'
import { ACCENT, CARD, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CLASSIFICATIONS = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE'] as const

function uploadKnowledge(
  file: File,
  title: string,
  classification: string,
  onProgress: (pct: number) => void,
): Promise<{ ok?: boolean; doc?: KnowledgeDoc; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/knowledge/upload')
    xhr.setRequestHeader('x-csrf-token', getCsrf())
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data: { ok?: boolean; doc?: KnowledgeDoc; error?: string } | null = null
      try {
        data = JSON.parse(xhr.responseText) as { ok?: boolean; doc?: KnowledgeDoc; error?: string }
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data ?? {})
      else reject(new Error(data?.error ?? `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed — network error.'))
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    fd.append('classification', classification)
    xhr.send(fd)
  })
}

function classificationBadge(c?: string | null) {
  const s = (c ?? '').toUpperCase()
  const cls =
    s === 'PUBLIC'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : s === 'PRIVATE'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
        : s === 'CONFIDENTIAL'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {prettify(c)}
    </span>
  )
}

export function KnowledgeView() {
  const { data, loading, error, refresh } = useApi<KnowledgeResponse>('/api/admin/knowledge')
  const docs = data?.docs ?? []

  // upload state
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [classification, setClassification] = useState<string>('PRIVATE')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  // search state
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Array<Record<string, unknown>> | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  async function doUpload(e: React.FormEvent) {
    e.preventDefault()
    if (uploading) return
    if (!file) {
      toast.error('Select a file to upload.')
      return
    }
    if (!title.trim()) {
      toast.error('A document title is required.')
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      const res = await uploadKnowledge(file, title.trim(), classification, setProgress)
      if (res.error) toast.warning(`Server message: ${res.error}`)
      else toast.success('Document uploaded — scanning and indexing will proceed.')
      setFile(null)
      setTitle('')
      setProgress(0)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function doSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searching || !query.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      const res = await api.knowledgeSearch(query.trim())
      setResults(res.results ?? [])
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Classified documents scanned, indexed, and searchable by the AI workforce. Quarantined or unscanned documents are never used by agents."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh documents"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Documents" description="Every document with its classification and scan verdict" className="xl:col-span-2" contentClassName="p-0">
          {error ? (
            <div role="alert" className="p-4 text-sm text-red-400">Could not load documents: {error}</div>
          ) : null}
          <DataTable
            columns={[
              { key: 'title', header: 'Title', cell: (d) => <span className="font-medium text-slate-200">{d.title || '—'}</span> },
              { key: 'filename', header: 'File', cell: (d) => <span className="font-mono text-xs text-slate-500">{d.filename || '—'}</span> },
              { key: 'class', header: 'Class', cell: (d) => classificationBadge(d.classification) },
              { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
              { key: 'size', header: 'Size', cell: (d) => <span className="tabular-nums text-slate-400">{fmtBytes(d.size)}</span> },
              {
                key: 'scan',
                header: 'Scan Verdict',
                className: 'max-w-[200px] whitespace-normal',
                cell: (d) => {
                  if (!d.scanResult) return <span className="text-xs text-slate-600">Not scanned yet</span>
                  const parsed = parseMaybeJson(d.scanResult)
                  if (parsed && typeof parsed === 'object') {
                    const o = parsed as Record<string, unknown>
                    const verdict = o.verdict ?? o.status ?? o.clean
                    if (verdict !== undefined) {
                      const ok = verdict === true || String(verdict).toUpperCase() === 'CLEAN'
                      return (
                        <span className={cn('text-xs', ok ? 'text-emerald-400' : 'text-amber-400')}>
                          {ok ? 'Clean' : String(verdict)}
                        </span>
                      )
                    }
                    return <span className="text-xs text-slate-500">See details</span>
                  }
                  return <span className="text-xs text-slate-500">{String(d.scanResult)}</span>
                },
              },
              { key: 'created', header: 'Uploaded', cell: (d) => <span className="text-xs text-slate-500">{fmtDate(d.createdAt)}</span> },
            ]}
            rows={docs}
            loading={loading}
            rowKey={(d) => d.id}
            empty={<EmptyState icon={FileUp} title="No documents yet" description="Upload company knowledge to make it available to the AI workforce." />}
            aria-label="Knowledge documents"
            maxHeightClass="max-h-[70vh]"
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Upload Document" description="Multipart upload with virus scan + classification">
            <form onSubmit={doUpload} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="kb-file" className="text-xs text-slate-400">File</Label>
                <label
                  htmlFor="kb-file"
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-700 bg-slate-950/60 px-3 py-3 text-xs text-slate-500 hover:border-[#009FE3]/50 hover:text-slate-300',
                    uploading && 'pointer-events-none opacity-50',
                  )}
                >
                  <Upload className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {file ? `${file.name} · ${fmtBytes(file.size)}` : 'Choose a file (pdf, txt, docx, md…)'}
                  </span>
                </label>
                <input
                  id="kb-file"
                  type="file"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-title" className="text-xs text-slate-400">Title</Label>
                <Input
                  id="kb-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document title"
                  className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-class" className="text-xs text-slate-400">Classification</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger id="kb-class" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {CLASSIFICATIONS.map((c) => (
                      <SelectItem key={c} value={c}>{prettify(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {uploading ? <Progress value={progress} aria-label="Upload progress" className="h-1.5" /> : null}
              <Button type="submit" disabled={uploading} className="w-full font-semibold" style={{ background: ACCENT }}>
                {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                {uploading ? `Uploading… ${progress}%` : 'Upload'}
              </Button>
              <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600">
                <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                Files are scanned on arrival. HIGHLY_SENSITIVE documents are excluded from agent retrieval by policy.
              </p>
            </form>
          </SectionCard>

          <SectionCard title="Semantic Search" description="Query the indexed knowledge">
            <form onSubmit={doSearch} className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search knowledge…"
                  aria-label="Knowledge search query"
                  className="h-9 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
                />
              </div>
              <Button type="submit" disabled={searching || !query.trim()} className="w-full" variant="outline" aria-label="Search">
                {searching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileSearch className="size-4" aria-hidden="true" />}
                Search
              </Button>
            </form>
            {searchError ? (
              <p role="alert" className="mt-2 text-xs text-red-400">{searchError}</p>
            ) : null}
            {results !== null ? (
              <div className={cn('mt-3 max-h-80 space-y-2 overflow-auto', SCROLL_THIN)} aria-live="polite">
                {results.length === 0 ? (
                  <p className="text-xs text-slate-500">No matching passages found for this query.</p>
                ) : (
                  results.map((r, i) => {
                    const excerpt =
                      (typeof r.excerpt === 'string' && r.excerpt) ||
                      (typeof r.content === 'string' && r.content) ||
                      (typeof r.text === 'string' && r.text) ||
                      ''
                    const label =
                      (typeof r.title === 'string' && r.title) ||
                      (typeof r.document === 'string' && r.document) ||
                      (typeof r.filename === 'string' && r.filename) ||
                      `Result ${i + 1}`
                    return (
                      <div key={i} className={cn(CARD, 'p-2.5')}>
                        <p className="text-xs font-medium text-slate-300">{label}</p>
                        {excerpt ? (
                          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-500">{excerpt}</p>
                        ) : (
                          <JsonView value={r} maxHeightClass="max-h-28" />
                        )}
                        {r.score !== undefined ? (
                          <p className="mt-1 text-[10px] text-slate-600">score: {String(r.score)}</p>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
