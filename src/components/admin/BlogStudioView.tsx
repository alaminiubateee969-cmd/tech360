'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  Eye,
  FileEdit,
  Globe2,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api, useApi, fmtDateShort, type BlogPostRow, type BlogListResponse } from '@/lib/admin-client'
import { DataTable, type Column } from './shared/DataTable'
import { KpiCard, SectionCard, EmptyState } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { INPUT } from './shared/styles'

interface EditorState {
  id: string | null
  title: string
  slug: string
  excerpt: string
  category: string
  author: string
  tags: string
  content: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'
  scheduleAt: string // datetime-local value for scheduled publishing
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  category: 'Engineering',
  author: 'Tech360 Team',
  tags: '',
  content: '',
  status: 'DRAFT',
  scheduleAt: '',
}

const CATEGORY_SUGGESTIONS = ['Engineering', 'Automation', 'Architecture', 'Security', 'Process', 'Business', 'AI & Agents']

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2001) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isFutureLocalDatetime(value: string): boolean {
  if (!value) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now()
}

export function BlogStudioView() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BlogPostRow | null>(null)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (debounced) params.set('q', debounced)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    const qs = params.toString()
    return `/api/admin/blog${qs ? `?${qs}` : ''}`
  }, [debounced, statusFilter])

  const { data, loading, error, refresh } = useApi<BlogListResponse>(url)

  useEffect(() => {
    setWordCount(editor.content.trim() ? editor.content.trim().split(/\s+/).length : 0)
  }, [editor.content])

  const stats = data?.stats ?? { total: 0, published: 0, drafts: 0, views: 0 }

  function openNew() {
    setEditor(EMPTY_EDITOR)
    setEditorOpen(true)
  }

  async function openEdit(post: BlogPostRow) {
    setBusy(true)
    try {
      const res = await api.blogGet(post.id)
      const p = res.post
      setEditor({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? '',
        category: p.category ?? 'Engineering',
        author: p.author,
        tags: parseTags(p.tags),
        content: p.content ?? '',
        status: (p.status === 'PUBLISHED' ? 'PUBLISHED' : p.status === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT'),
        scheduleAt: p.status === 'SCHEDULED' ? toLocalInputValue(p.publishedAt) : '',
      })
      setEditorOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load post')
    } finally {
      setBusy(false)
    }
  }

  async function saveEditor(mode: 'draft' | 'publish' | 'schedule' | 'save' = 'save') {
    const status = mode === 'draft' ? 'DRAFT' : mode === 'publish' ? 'PUBLISHED' : mode === 'schedule' ? 'SCHEDULED' : editor.status
    if (editor.title.trim().length < 5) {
      toast.error('Title must be at least 5 characters.')
      return
    }
    if (editor.content.trim().length < 100) {
      toast.error('Content must be at least 100 characters (currently ' + editor.content.trim().length + ').')
      return
    }
    if (status === 'SCHEDULED' && !isFutureLocalDatetime(editor.scheduleAt)) {
      toast.error('Pick a valid future date & time to schedule this post.')
      return
    }
    setBusy(true)
    try {
      const tags = editor.tags.split(',').map((t) => t.trim()).filter(Boolean)
      const body: Record<string, unknown> = {
        title: editor.title,
        slug: editor.slug.trim() || undefined,
        excerpt: editor.excerpt,
        category: editor.category,
        author: editor.author,
        tags,
        content: editor.content,
        status,
      }
      if (status === 'SCHEDULED') body.publishedAt = new Date(editor.scheduleAt).toISOString()
      const res = editor.id ? await api.blogUpdate(editor.id, body) : await api.blogCreate({
        title: editor.title,
        content: editor.content,
        status,
        excerpt: editor.excerpt || undefined,
        category: editor.category,
        author: editor.author,
        tags,
        slug: editor.slug.trim() || undefined,
        publishedAt: status === 'SCHEDULED' ? new Date(editor.scheduleAt).toISOString() : undefined,
      })
      toast.success(
        status === 'SCHEDULED'
          ? `Scheduled — goes live ${new Date(editor.scheduleAt).toLocaleString()}.`
          : editor.id ? (status === 'PUBLISHED' ? 'Post updated and published.' : 'Post saved.') : 'Post created.',
      )
      void res
      setEditorOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function quickToggle(post: BlogPostRow) {
    setBusy(true)
    try {
      await api.blogUpdate(post.id, { status: post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' })
      toast.success(post.status === 'PUBLISHED' ? `"${post.title.slice(0, 40)}" unpublished.` : `"${post.title.slice(0, 40)}" is live.`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status change failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await api.blogDelete(deleteTarget.id)
      toast.success('Post deleted.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<BlogPostRow>[] = [
    {
      key: 'title',
      header: 'Post',
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-200">{p.title}</p>
          <p className="truncate text-[11px] text-slate-500">/{p.slug} · {p.author}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (p) => <span className="text-xs text-slate-400">{p.category ?? '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'views',
      header: <span className="inline-flex items-center gap-1"><Eye className="size-3" aria-hidden="true" /> Views</span>,
      cell: (p) => <span className="tabular-nums text-xs text-slate-300">{p.views.toLocaleString()}</span>,
      thClassName: 'text-right',
      className: 'text-right hidden sm:table-cell',
    },
    {
      key: 'published',
      header: 'Published',
      cell: (p) => (
        <span className="text-xs text-slate-400">
          {p.status === 'SCHEDULED' && p.publishedAt && new Date(p.publishedAt).getFullYear() > 2001
            ? (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <CalendarClock className="size-3" aria-hidden="true" /> {fmtDateShort(p.publishedAt)}
              </span>
            )
            : p.status === 'PUBLISHED' && p.publishedAt && new Date(p.publishedAt).getFullYear() > 2000
              ? fmtDateShort(p.publishedAt)
              : '—'}
        </span>
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => openEdit(p)}
            aria-label={`Edit ${p.title}`}
            className="size-8 p-0 text-slate-400 hover:text-[#009FE3]"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => quickToggle(p)}
            aria-label={p.status === 'PUBLISHED' ? `Unpublish ${p.title}` : p.status === 'SCHEDULED' ? `Publish ${p.title} now (skip the schedule)` : `Publish ${p.title}`}
            title={p.status === 'SCHEDULED' ? 'Publish now — skips the scheduled time' : undefined}
            className="size-8 p-0 text-slate-400 hover:text-emerald-400"
          >
            {p.status === 'PUBLISHED' ? <FileEdit className="size-3.5" aria-hidden="true" /> : <Globe2 className="size-3.5" aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setDeleteTarget(p)}
            aria-label={`Delete ${p.title}`}
            className="size-8 p-0 text-slate-400 hover:text-red-400"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
          {p.status === 'PUBLISHED' ? (
            <a
              href={`#/blog/${p.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-[#009FE3]"
              aria-label={`View ${p.title} on the site`}
            >
              <Send className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ),
      thClassName: 'text-right',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total Posts" value={stats.total} icon={Newspaper} tone="accent" loading={loading} />
        <KpiCard label="Published" value={stats.published} icon={Globe2} tone="green" loading={loading} />
        <KpiCard label="Scheduled" value={stats.scheduled ?? 0} icon={CalendarClock} tone="amber" loading={loading} sub="Auto-publish at their time" />
        <KpiCard label="Drafts" value={stats.drafts} icon={FileEdit} tone="slate" loading={loading} />
        <KpiCard label="Total Views" value={stats.views.toLocaleString()} icon={Eye} tone="slate" loading={loading} />
      </div>

      <SectionCard
        title="Blog Studio"
        description="Write, edit, schedule and publish insights. Scheduled posts go live automatically at their authored time; drafts stay private."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="border-slate-700">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </Button>
            <Button size="sm" onClick={openNew} className="bg-[#009FE3] text-white hover:bg-[#009FE3]/85">
              <Plus className="size-3.5" aria-hidden="true" /> New Post
            </Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, category or author…"
              className="pl-8"
              aria-label="Search posts"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="DRAFT">Drafts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <EmptyState icon={X} title="Could not load posts" description={error} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.posts}
            loading={loading}
            rowKey={(p) => p.id}
            empty={
              <EmptyState
                icon={Newspaper}
                title={query || statusFilter !== 'ALL' ? 'No posts match your filters' : 'No posts yet'}
                description={
                  query || statusFilter !== 'ALL'
                    ? 'Try a different search or clear the status filter.'
                    : 'Create your first insight post — drafts stay private until you publish.'
                }
                action={
                  <Button size="sm" onClick={openNew} className="bg-[#009FE3] text-white hover:bg-[#009FE3]/85">
                    <Plus className="size-3.5" aria-hidden="true" /> New Post
                  </Button>
                }
              />
            }
            aria-label="Blog posts"
          />
        )}
      </SectionCard>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => !busy && setEditorOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-[#0B1F33] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100">{editor.id ? 'Edit Post' : 'New Post'}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {editor.id ? 'Changes are audited. Publishing stamps the real publish time.' : 'Start as a draft — publish when it is ready to go live.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="post-title" className="text-xs text-slate-400">Title *</Label>
              <Input
                id="post-title"
                value={editor.title}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                placeholder="e.g. Why scope discipline saves SME budgets"
                className={INPUT}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="post-slug" className="text-xs text-slate-400">Slug (auto if empty)</Label>
                <Input
                  id="post-slug"
                  value={editor.slug}
                  onChange={(e) => setEditor({ ...editor, slug: e.target.value })}
                  placeholder="auto-generated-from-title"
                  className={`${INPUT} font-mono text-xs`}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="post-category" className="text-xs text-slate-400">Category</Label>
                <Input
                  id="post-category"
                  value={editor.category}
                  onChange={(e) => setEditor({ ...editor, category: e.target.value })}
                  list="category-suggestions"
                  placeholder="Engineering"
                  className={INPUT}
                />
                <datalist id="category-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="post-author" className="text-xs text-slate-400">Author</Label>
                <Input
                  id="post-author"
                  value={editor.author}
                  onChange={(e) => setEditor({ ...editor, author: e.target.value })}
                  placeholder="Tech360 Team"
                  className={INPUT}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="post-tags" className="text-xs text-slate-400">Tags (comma separated)</Label>
                <Input
                  id="post-tags"
                  value={editor.tags}
                  onChange={(e) => setEditor({ ...editor, tags: e.target.value })}
                  placeholder="crm, automation, process"
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="post-excerpt" className="text-xs text-slate-400">Excerpt (auto if empty)</Label>
              <Textarea
                id="post-excerpt"
                value={editor.excerpt}
                onChange={(e) => setEditor({ ...editor, excerpt: e.target.value })}
                placeholder="One or two sentences shown on the blog list…"
                className={`${INPUT} min-h-[60px]`}
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="post-content" className="text-xs text-slate-400">Content * (Markdown: ## headings, **bold**, lists)</Label>
                <span className="text-[11px] tabular-nums text-slate-500">{wordCount} words · {editor.content.length} chars</span>
              </div>
              <Textarea
                id="post-content"
                value={editor.content}
                onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                placeholder={'## Section heading\n\nWrite the insight here…\n\n- Point one\n- Point two'}
                className={`${INPUT} min-h-[280px] font-mono text-xs leading-relaxed`}
              />
              {editor.content.length > 0 && editor.content.length < 100 ? (
                <p className="text-[11px] text-amber-400">Minimum 100 characters — currently {editor.content.length}.</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="post-schedule" className="flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                Schedule publish (optional)
              </Label>
              <Input
                id="post-schedule"
                type="datetime-local"
                value={editor.scheduleAt}
                onChange={(e) => setEditor({ ...editor, scheduleAt: e.target.value })}
                className={`${INPUT} sm:max-w-[260px]`}
                aria-describedby="post-schedule-hint"
              />
              <p id="post-schedule-hint" className="text-[11px] text-slate-500">
                {editor.scheduleAt && isFutureLocalDatetime(editor.scheduleAt)
                  ? `Goes live automatically ${new Date(editor.scheduleAt).toLocaleString()} — the autonomous loop publishes it and notifies the team.`
                  : 'Pick a future date & time, then press Schedule — the post goes live by itself at that moment.'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)} disabled={busy} className="border-slate-700">
              Cancel
            </Button>
            {editor.id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveEditor('draft')}
                disabled={busy}
                className="border-slate-700"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <FileEdit className="size-3.5" aria-hidden="true" />}
                Save Draft
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveEditor('schedule')}
              disabled={busy || !isFutureLocalDatetime(editor.scheduleAt)}
              title={isFutureLocalDatetime(editor.scheduleAt) ? 'Auto-publish at the chosen time' : 'Set a future date & time above first'}
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CalendarClock className="size-3.5" aria-hidden="true" />}
              Schedule
            </Button>
            <Button size="sm" onClick={() => saveEditor('publish')} disabled={busy} className="bg-[#009FE3] text-white hover:bg-[#009FE3]/85">
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Globe2 className="size-3.5" aria-hidden="true" />}
              {editor.id ? (editor.status === 'PUBLISHED' ? 'Save (Published)' : 'Publish Now') : 'Publish Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !busy && !open && setDeleteTarget(null)}>
        <DialogContent className="border-slate-800 bg-[#0B1F33] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Delete post?</DialogTitle>
            <DialogDescription className="text-slate-500">
              “{deleteTarget?.title}” will be permanently removed{deleteTarget?.status === 'PUBLISHED' ? ' from the public site' : ''}. The deletion is audited.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={busy} className="border-slate-700">
              Keep Post
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function parseTags(raw?: string | null): string {
  if (!raw) return ''
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.join(', ') : ''
  } catch {
    return ''
  }
}
