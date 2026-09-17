'use client'

// ============================================================
// TECH360 — Admin console data layer
// Fetch wrapper (CSRF aware) + typed endpoint helpers + useApi hook.
// Every value displayed in the admin console comes from these APIs.
// ============================================================

import { useCallback, useEffect, useState } from 'react'

// ------------------------------------------------------------
// CSRF + fetch
// ------------------------------------------------------------

export function getCsrf(): string {
  const m = document.cookie.match(/(?:^|; )t360_csrf=([^;]+)/)
  return m ? m[1] : ''
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

function extractError(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.error === 'string' && d.error) return d.error
    if (typeof d.message === 'string' && d.message) return d.message
  }
  return `Request failed (${status})`
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['x-csrf-token'] = getCsrf()
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) throw new ApiError(extractError(data, res.status), res.status, data)
  return ((data ?? {}) as T)
}

// ------------------------------------------------------------
// useApi — tiny SWR-ish hook (AbortController aware)
// ------------------------------------------------------------

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

interface ApiCache<T> {
  url: string | null
  tick: number
  data: T | null
  error: string | null
}

export function useApi<T>(url: string | null): ApiState<T> {
  const [tick, setTick] = useState(0)
  const [cache, setCache] = useState<ApiCache<T>>({ url: null, tick: 0, data: null, error: null })

  useEffect(() => {
    if (!url) return
    const ctrl = new AbortController()
    let active = true
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        let json: unknown = null
        try {
          json = await res.json()
        } catch {
          json = null
        }
        if (!res.ok) throw new Error(extractError(json, res.status))
        return json
      })
      .then((json) => {
        if (active) setCache({ url, tick, data: (json ?? {}) as T, error: null })
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        setCache({ url, tick, data: null, error: e instanceof Error ? e.message : 'Request failed' })
      })
    return () => {
      active = false
      ctrl.abort()
    }
  }, [url, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const fresh = cache.url === url && cache.tick === tick
  return {
    data: fresh ? cache.data : null,
    loading: url !== null && !fresh,
    error: fresh ? cache.error : null,
    refresh,
  }
}

// ------------------------------------------------------------
// Types (mirror of the frozen API contract / Prisma models)
// ------------------------------------------------------------

export interface AdminUser {
  email: string
  name?: string | null
  role?: string | null
  mustChangePassword?: boolean
}
export interface MeResponse { user: AdminUser }
export interface LoginResponse {
  ok?: boolean
  user?: AdminUser
  error?: string
}

export interface DashboardStats {
  totalLeads: number
  newLeads: number
  qualifiedLeads: number
  clients: number
  activeProjects: number
  projectsAwaitingApproval: number
  paymentPending: number
  paidProjects: number
  outstandingReceivables: number
  completedProjects: number
  openTasks: number
  unreadCommunications: number
  failedAutomations: number
  pendingAdminApprovals: number
}
export interface StageCount { stage: string; count: number }
export interface MonthRevenue { month: string; paid: number }
export interface RecentLead {
  id: string
  clientId: string
  name: string
  businessName?: string | null
  businessType?: string | null
  source?: string | null
  pipelineStage?: string | null
  status?: string | null
  createdAt?: string | null
}
export interface RecentActivity {
  at?: string | null
  type?: string | null
  text?: string | null
  actor?: string | null
  clientId?: string | null
}
export interface DashboardResponse {
  stats: DashboardStats
  pipeline: StageCount[]
  revenueByMonth: MonthRevenue[]
  recentLeads: RecentLead[]
  recentActivity: RecentActivity[]
}

export interface NotificationItem {
  id: string
  type: string // APPROVAL | ERROR | LEAD | PAYMENT | DELIVERY | SYSTEM
  title: string
  body?: string | null
  severity: string // INFO | WARNING | CRITICAL
  read: boolean
  link?: string | null
  createdAt: string
}
export interface NotificationsResponse {
  notifications: NotificationItem[]
  unread: number
  severityCounts?: Record<string, number>
}

export interface KnowledgeStatusResponse {
  ok?: boolean
  message?: string
  doc?: KnowledgeDoc
}

// ---------------- Blog Studio ----------------
export interface BlogPostRow {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  category?: string | null
  author: string
  status: string
  views: number
  coverImage?: string | null
  contentLength?: number
  tags?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  createdAt?: string | null
  content?: string
}
export interface BlogListResponse {
  posts: BlogPostRow[]
  total: number
  stats: { total: number; published: number; scheduled?: number; drafts: number; views: number }
}
export interface BlogMutationResponse {
  ok?: boolean
  post?: BlogPostRow
  error?: string
}

// ---------------- Reviews & Referrals ----------------
export interface ReviewRow {
  id: string
  clientId: string
  clientName: string
  businessName?: string | null
  country?: string | null
  projectCode?: string | null
  projectName?: string | null
  rating?: number | null
  content?: string | null
  published: boolean
  consent: boolean
  status: string
  moderatedBy?: string | null
  moderatedAt?: string | null
  createdAt: string
}
export interface ReferralRow {
  id: string
  clientId: string
  clientName: string
  businessName?: string | null
  name?: string | null
  contact?: string | null
  notes?: string | null
  status: string
  convertedClientId?: string | null
  convertedClientIdCode?: string | null
  convertedClientName?: string | null
  convertedAt?: string | null
  createdAt: string
}
export interface ReferralConvertResponse {
  ok?: boolean
  message?: string
  clientId?: string
  clientRowId?: string
  referral?: ReferralRow
  error?: string
}
export interface ReviewsResponse {
  reviews: ReviewRow[]
  referrals: ReferralRow[]
  stats: Record<string, number>
}
export interface ReviewModerateResponse {
  ok?: boolean
  review?: ReviewRow
  error?: string
}

// ---------------- CEO Report archive ----------------
export interface ReportRow {
  id: string
  title: string
  trigger: string
  generatedBy: string
  agentRuns: number
  durationMs?: number | null
  createdAt: string
}
export interface ReportArchiveResponse {
  reports: ReportRow[]
  total: number
  stats: { scheduled: number; manual: number }
  latest?: (ReportRow & { hasContent?: boolean }) | null
}
export interface CeoReportResponse {
  report?: string
  id?: string
  agentRuns?: number
  durationMs?: number
  generatedAt?: string
  error?: string
}

// ---------------- Public reviews (site) ----------------
export interface PublicReview {
  id: string
  name: string
  businessName?: string | null
  country?: string | null
  projectName?: string | null
  serviceType?: string | null
  rating: number
  content: string
  date: string
}
export interface PublicReviewsResponse {
  reviews: PublicReview[]
  count: number
}

export interface ClientRow {
  id: string
  clientId: string
  name: string
  businessName?: string | null
  businessType?: string | null
  status?: string | null
  pipelineStage?: string | null
  source?: string | null
  createdAt?: string | null
  lastActivity?: string | null
}
export interface ClientsResponse {
  clients: ClientRow[]
  total: number
  page: number
}

export interface ClientRecord {
  id: string
  clientId: string
  name: string
  businessName?: string | null
  businessType?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  country?: string | null
  source?: string | null
  status?: string | null
  pipelineStage?: string | null
  score?: number | null
  preferredContact?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
export interface LeadRecord {
  requirements?: string | null
  budgetRange?: string | null
  projectType?: string | null
  interest?: string | null
  contactedAt?: string | null
  qualifiedAt?: string | null
  createdAt?: string | null
}
export interface CommunicationRecord {
  id: string
  clientId?: string | null
  channel?: string | null
  direction?: string | null
  recipient?: string | null
  sender?: string | null
  subject?: string | null
  body?: string | null
  messageType?: string | null
  templateName?: string | null
  providerMessageId?: string | null
  status?: string | null
  error?: string | null
  workflowId?: string | null
  agentCode?: string | null
  createdAt?: string | null
  sentAt?: string | null
}
export interface ScopeRecord {
  id: string
  version?: number | null
  status?: string | null
  summary?: string | null
  content?: string | null
  aiNotes?: string | null
  generatedBy?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  createdAt?: string | null
}
export interface PreviewRecord {
  id: string
  token?: string | null
  version?: number | null
  status?: string | null
  viewCount?: number | null
  createdAt?: string | null
  sentAt?: string | null
  viewedAt?: string | null
  approvedAt?: string | null
}
export interface PaymentRecord {
  id: string
  clientId?: string | null
  projectId?: string | null
  invoiceId?: string | null
  milestone?: string | null
  amount?: number | null
  currency?: string | null
  method?: string | null
  transactionId?: string | null
  status?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  notes?: string | null
  createdAt?: string | null
  client?: { clientId?: string; name?: string } | string | null
  invoice?: { number?: string } | null
}
export interface InvoiceRecord {
  id: string
  number?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  notes?: string | null
  issuedAt?: string | null
  dueAt?: string | null
}
export interface ProjectSummary {
  id: string
  code?: string | null
  name: string
  plan?: string | null
  status?: string | null
  currency?: string | null
  totalAmount?: number | null
  paidAmount?: number | null
  startedAt?: string | null
  deliveredAt?: string | null
  closedAt?: string | null
  createdAt?: string | null
  client?: { clientId?: string; name?: string } | string | null
}
export interface TaskRecord {
  id: string
  title: string
  description?: string | null
  status?: string | null
  priority?: string | null
  assigneeType?: string | null
  assigneeRef?: string | null
  order?: number | null
  dueAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
}
export interface MeetingRecord {
  id: string
  reason?: string | null
  status?: string | null
  channel?: string | null
  scheduledAt?: string | null
  bookingLink?: string | null
  notes?: string | null
  clientResponse?: string | null
  clientRespondedAt?: string | null
  createdAt?: string | null
}
export interface MemoryRecord {
  id: string
  scope?: string | null
  key?: string | null
  content?: string | null
  clientId?: string | null
  importance?: number | null
  hits?: number | null
  updatedAt?: string | null
  createdAt?: string | null
}
export interface AutomationLogRecord {
  id: string
  workflow?: string | null
  trigger?: string | null
  correlationId?: string | null
  status?: string | null
  attempts?: number | null
  durationMs?: number | null
  error?: string | null
  steps?: string | null
  input?: string | null
  output?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string | null
}
export interface AutomationRetryResponse {
  ok?: boolean
  message?: string
  status?: string
  attempts?: number
}
export interface TimelineEvent {
  at?: string | null
  type?: string | null
  text?: string | null
}
export interface ClientDetailResponse {
  client: ClientRecord
  lead?: LeadRecord | null
  communications?: CommunicationRecord[]
  scopes?: ScopeRecord[]
  previews?: PreviewRecord[]
  payments?: PaymentRecord[]
  invoices?: InvoiceRecord[]
  projects?: ProjectSummary[]
  meetings?: MeetingRecord[]
  memories?: MemoryRecord[]
  automationLogs?: AutomationLogRecord[]
  timeline?: TimelineEvent[]
  documents?: DocumentRecord[]
}

export interface DocumentRecord {
  id: string
  name: string
  mimeType: string
  size: number
  note?: string | null
  classification: string
  scanStatus: string // CLEAN | QUARANTINED | REJECTED
  scanResult?: { verdict?: string; notes?: string[]; sha256?: string; releasedBy?: string; rejectedBy?: string } | null
  direction: 'UPLOADED' | 'SHARED'
  uploadedBy?: string | null
  downloads: number
  at: string
}

export interface JourneyResponse {
  ok?: boolean
  result?: Record<string, unknown> | null
  message?: string
}
export interface JourneyActionInput {
  clientId: string
  action: string
  payload?: Record<string, unknown>
}

export interface ApprovalItem {
  id: string
  type?: string | null
  title: string
  description?: string | null
  client?: unknown
  clientId?: string | null
  agentCode?: string | null
  risk?: string | null
  status?: string | null
  createdAt?: string | null
  payload?: string | null
  result?: string | null
}
export interface ApprovalsResponse { approvals: ApprovalItem[] }
export interface ApprovalDecisionResponse {
  ok?: boolean
  result?: unknown
  message?: string
}

export interface CommunicationsResponse {
  comms: CommunicationRecord[]
  total?: number
  channelsStatus?: Record<string, string> | null
}
export interface CommSendResponse {
  ok?: boolean
  status?: string | null
  message?: string | null
  error?: string | null
}

export interface PaymentsResponse {
  payments?: PaymentRecord[]
  invoices?: InvoiceRecord[]
}
export interface PaymentMutationResponse {
  ok?: boolean
  payment?: PaymentRecord
  message?: string
}

export interface AgentRow {
  code: string
  name: string
  title?: string | null
  dept?: string | null
  status?: string | null
  executions?: number | null
  successRate?: number | null
  requiresApproval?: boolean | null
  level?: number | null
}
export interface DepartmentRow { code: string; name: string; category?: string | null }
export interface AgentsResponse {
  agents: AgentRow[]
  departments: DepartmentRow[]
}
export interface AgentFull extends AgentRow {
  purpose?: string | null
  systemPrompt?: string | null
  tools?: string | string[] | null
  permissions?: string | string[] | null
  model?: string | null
  dailyQuota?: number | null
  executionCount?: number | null
  successCount?: number | null
  failureCount?: number | null
}
export interface ExecutionRecord {
  id: string
  agentCode?: string | null
  status?: string | null
  tokensUsed?: number | null
  durationMs?: number | null
  input?: string | null
  output?: string | null
  error?: string | null
  workflow?: string | null
  createdAt?: string | null
}
export interface AgentDetailResponse { agent: AgentFull; executions?: ExecutionRecord[] }
export interface AgentRunResponse {
  ok?: boolean
  output?: string | null
  json?: unknown
  executionId?: string | null
  status?: string | null
  error?: string | null
  message?: string | null
}

export interface CommandResponse {
  reply?: string | null
  action?: string | null
  data?: unknown
  dataKind?: string | null
}

export interface MemoriesResponse { memories?: MemoryRecord[] }
export interface MemoryMutationResponse { ok?: boolean; message?: string }

export interface KnowledgeDoc {
  id: string
  title?: string | null
  filename?: string | null
  classification?: string | null
  status?: string | null
  size?: number | null
  scanResult?: string | null
  approvedBy?: string | null
  createdAt?: string | null
}
export interface KnowledgeResponse { docs?: KnowledgeDoc[] }
export interface KnowledgeSearchResponse {
  results?: Array<Record<string, unknown>>
  agent?: { ok?: boolean; executionId?: string; error?: string }
  aiRanked?: boolean
}

export interface ContentAsset {
  id: string
  type?: string | null
  language?: string | null
  title?: string | null
  content?: string | null
  status?: string | null
  durationSec?: number | null
  aspect?: string | null
  campaignId?: string | null
  createdAt?: string | null
}
export interface CampaignRecord {
  id: string
  name?: string | null
  goal?: string | null
  channel?: string | null
  status?: string | null
  createdAt?: string | null
}
export interface ContentResponse { assets?: ContentAsset[]; campaigns?: CampaignRecord[] }
export interface ContentGenerateResponse {
  ok?: boolean
  asset?: ContentAsset
  message?: string
}

export interface AnalyticsResponse {
  leadsTrend?: Array<{ date?: string | null; count?: number | null }>
  pipeline?: StageCount[]
  channelMix?: Array<Record<string, unknown>>
  agentActivity?: Array<Record<string, unknown>>
  period?: string | null
}

export interface AuditLogRecord {
  id: string
  actor?: string | null
  action?: string | null
  entityType?: string | null
  entityId?: string | null
  clientId?: string | null
  details?: string | null
  ip?: string | null
  createdAt?: string | null
}
export interface AuditLogsResponse { logs?: AuditLogRecord[]; total?: number; page?: number }
export interface ErrorLogRecord {
  id: string
  source?: string | null
  code?: string | null
  message?: string | null
  stack?: string | null
  correlationId?: string | null
  resolved?: boolean | null
  resolvedAt?: string | null
  createdAt?: string | null
}
export interface ErrorLogsResponse { logs?: ErrorLogRecord[] }

export interface N8nWorkflowRow {
  code: string
  name: string
  description?: string | null
  category?: string | null
  trigger?: string | null
  status?: string | null
  lastRunAt?: string | null
  lastRunStatus?: string | null
}
export interface N8nResponse { workflows?: N8nWorkflowRow[] }

export interface HealthResponse {
  status?: string | null
  db?: boolean | string | null
  agents?: number | null
  channels?: Record<string, boolean | string> | null
  version?: string | null
}

// ------------------------------------------------------------
// Typed endpoint helpers
// ------------------------------------------------------------

export const api = {
  me: () => fetchJson<MeResponse>('/api/auth/me'),
  login: (email: string, password: string) =>
    fetchJson<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJson<{ ok?: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
  logout: () => fetchJson<{ ok?: boolean }>('/api/auth/logout', { method: 'POST' }),

  journey: (input: JourneyActionInput) =>
    fetchJson<JourneyResponse>('/api/admin/journey', { method: 'POST', body: input }),
  approvalDecision: (id: string, decision: 'APPROVED' | 'REJECTED', note?: string) =>
    fetchJson<ApprovalDecisionResponse>(`/api/admin/approvals/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: { decision, note },
    }),
  sendCommunication: (body: { clientId: string; channel: string; subject?: string; body: string }) =>
    fetchJson<CommSendResponse>('/api/admin/communications/send', { method: 'POST', body }),
  recordPayment: (body: {
    clientId: string
    amount: number
    currency?: string
    method?: string
    transactionId?: string
    milestone?: string
    notes?: string
    invoiceNumber?: string
  }) => fetchJson<PaymentMutationResponse>('/api/admin/payments', { method: 'POST', body }),
  verifyPayment: (paymentId: string) =>
    fetchJson<{ ok?: boolean; message?: string }>('/api/admin/payments/verify', {
      method: 'POST',
      body: { paymentId },
    }),
  closeProject: (id: string) =>
    fetchJson<{ ok?: boolean; message?: string }>(`/api/admin/projects/${encodeURIComponent(id)}/close`, {
      method: 'POST',
    }),
  updateTask: (projectId: string, taskId: string, status: string, evidence?: string) =>
    fetchJson<{ ok?: boolean; message?: string }>(`/api/admin/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: { status, evidence },
    }),
  resolveError: (errorId: string, note?: string) =>
    fetchJson<{ ok?: boolean; message?: string }>(`/api/admin/logs/errors/${encodeURIComponent(errorId)}/resolve`, {
      method: 'POST',
      body: { note },
    }),
  meetingSchedule: (body: { clientId: string; scheduledAt: string; channel: string; reason?: string; bookingLink?: string; notes?: string }) =>
    fetchJson<{ ok?: boolean; message?: string; agent?: { ok?: boolean; agenda?: string } }>(`/api/admin/meetings`, {
      method: 'POST',
      body,
    }),
  meetingManage: (meetingId: string, action: 'COMPLETE' | 'CANCEL' | 'RESCHEDULE', body?: { notes?: string; scheduledAt?: string }) =>
    fetchJson<{ ok?: boolean; message?: string; status?: string }>(`/api/admin/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'PATCH',
      body: { action, ...body },
    }),
  docStatus: (docId: string, action: 'RELEASE' | 'REJECT') =>
    fetchJson<{ ok?: boolean; message?: string }>(`/api/admin/documents/${encodeURIComponent(docId)}/status`, {
      method: 'POST',
      body: { action },
    }),
  docShare: (clientId: string, file: File, note: string, classification: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('clientId', clientId)
    if (note) form.append('note', note)
    form.append('classification', classification)
    return fetch('/api/admin/documents', {
      method: 'POST',
      headers: { 'x-csrf-token': getCsrf() },
      body: form,
    }).then(async (res) => {
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data)
      return data ?? {}
    })
  },
  notifications: (opts?: { unread?: boolean; take?: number }) =>
    fetchJson<NotificationsResponse>(`/api/admin/notifications${opts?.unread ? '?unread=1' : ''}${opts?.take ? `${opts?.unread ? '&' : '?'}take=${opts.take}` : ''}`),
  markNotificationRead: (id: string) =>
    fetchJson<{ ok?: boolean; updated?: number }>('/api/admin/notifications/read', {
      method: 'POST',
      body: { id },
    }),
  markAllNotificationsRead: () =>
    fetchJson<{ ok?: boolean; updated?: number }>('/api/admin/notifications/read', {
      method: 'POST',
      body: { all: true },
    }),
  knowledgeStatus: (docId: string, status: string, note?: string) =>
    fetchJson<KnowledgeStatusResponse>(`/api/admin/knowledge/${encodeURIComponent(docId)}/status`, {
      method: 'POST',
      body: { status, note },
    }),
  runAgent: (code: string, input: string, expectJson = true) =>
    fetchJson<AgentRunResponse>(`/api/admin/agents/${encodeURIComponent(code)}/run`, {
      method: 'POST',
      body: { input, expectJson },
    }),
  createAgent: (purpose: string, description: string) =>
    fetchJson<{ ok?: boolean; message?: string }>('/api/admin/agents/create', {
      method: 'POST',
      body: { purpose, description },
    }),
  command: (sessionId: string, message: string) =>
    fetchJson<CommandResponse>('/api/admin/command', { method: 'POST', body: { sessionId, message } }),
  addMemory: (body: { scope: string; key: string; content: string; clientId?: string; importance?: number }) =>
    fetchJson<MemoryMutationResponse>('/api/admin/memory', { method: 'POST', body }),
  knowledgeSearch: (query: string) =>
    fetchJson<KnowledgeSearchResponse>('/api/admin/knowledge/search', { method: 'POST', body: { query } }),
  automationRetry: (id: string) =>
    fetchJson<AutomationRetryResponse>(`/api/admin/logs/automation/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
  generateContent: (body: {
    type: string
    topic: string
    params: { language?: string; aspect?: string; durationSec?: number }
  }) => fetchJson<ContentGenerateResponse>('/api/admin/content/generate', { method: 'POST', body }),
  ceoReport: () => fetchJson<{ report?: string }>('/api/admin/reports/ceo'),
  reportArchive: () => fetchJson<ReportArchiveResponse>('/api/admin/reports'),
  reportGet: (id: string) =>
    fetchJson<{ report: ReportRow & { content: string } }>(`/api/admin/reports/${encodeURIComponent(id)}`),
  generateCeoReport: () =>
    fetchJson<CeoReportResponse>('/api/admin/reports/ceo', { method: 'POST' }),

  // ---------------- Blog Studio ----------------
  blogList: (opts?: { q?: string; status?: string }) =>
    fetchJson<BlogListResponse>(`/api/admin/blog${buildBlogQuery(opts)}`),
  blogGet: (id: string) =>
    fetchJson<{ post: BlogPostRow }>(`/api/admin/blog/${encodeURIComponent(id)}`),
  blogCreate: (body: { title: string; content: string; status?: string; excerpt?: string; category?: string; author?: string; tags?: string[]; slug?: string; coverImage?: string; publishedAt?: string }) =>
    fetchJson<BlogMutationResponse>('/api/admin/blog', { method: 'POST', body }),
  blogUpdate: (id: string, body: Record<string, unknown>) =>
    fetchJson<BlogMutationResponse>(`/api/admin/blog/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  blogDelete: (id: string) =>
    fetchJson<{ ok?: boolean; error?: string }>(`/api/admin/blog/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ---------------- Reviews & Referrals ----------------
  reviews: (status?: string) =>
    fetchJson<ReviewsResponse>(`/api/admin/reviews${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  moderateReview: (id: string, action: 'PUBLISH' | 'REJECT') =>
    fetchJson<ReviewModerateResponse>(`/api/admin/reviews/${encodeURIComponent(id)}/moderate`, {
      method: 'POST',
      body: { action },
    }),
  referralStatus: (id: string, status: string, notes?: string) =>
    fetchJson<{ ok?: boolean; error?: string }>(`/api/admin/referrals/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: { status, notes },
    }),
  referralConvert: (id: string, body: { name?: string; contact?: string; email?: string; whatsapp?: string; message?: string }) =>
    fetchJson<ReferralConvertResponse>(`/api/admin/referrals/${encodeURIComponent(id)}/convert`, {
      method: 'POST',
      body,
    }),
}

function buildBlogQuery(opts?: { q?: string; status?: string }): string {
  const params: string[] = []
  if (opts?.q) params.push(`q=${encodeURIComponent(opts.q)}`)
  if (opts?.status) params.push(`status=${encodeURIComponent(opts.status)}`)
  return params.length > 0 ? `?${params.join('&')}` : ''
}

// ------------------------------------------------------------
// Formatting / defensive helpers
// ------------------------------------------------------------

export function fmtDate(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtDateShort(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtMoney(v?: number | null, currency = 'USD'): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v))
}

export function fmtBytes(n?: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** NOT_CONFIGURED → "Not Configured"; CLIENT_REVIEW → "Client Review" */
export function prettify(s?: string | null): string {
  if (!s) return '—'
  const special: Record<string, string> = {
    NOT_CONFIGURED: 'Not Configured',
    N8N: 'n8n',
  }
  if (special[s]) return special[s]
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Best-effort JSON parse for JSON-string DB columns. Returns null when not JSON. */
export function parseMaybeJson(s?: string | null): unknown {
  if (!s) return null
  try {
    const v = JSON.parse(s)
    return typeof v === 'object' && v !== null ? v : null
  } catch {
    return null
  }
}

/** Client fields arrive as a name string, a {clientId,name} object, or null. */
export function clientDisplayName(v: unknown): string {
  if (!v) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'object') {
    const o = v as { name?: unknown; clientId?: unknown }
    if (typeof o.name === 'string' && o.name) return o.name
    if (typeof o.clientId === 'string' && o.clientId) return o.clientId
  }
  return '—'
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
