/**
 * Public agent tools — the single implementation behind every agent surface.
 *
 * The same five read-only tools are exposed three ways:
 *
 *  1. MCP over Streamable HTTP          → `src/app/api/mcp/route.ts`
 *  2. WebMCP in the browser             → `src/components/site/WebMCPTools.tsx`
 *  3. Markdown content negotiation     → `src/lib/agent-content.ts` (same data)
 *
 * Keeping one implementation means a tool can never return different facts
 * depending on which surface an agent used.
 *
 * Safety rules (enforced by tests/agent-readiness.test.ts):
 *  - Read-only. No tool writes, sends a message, or mutates a record.
 *  - No CRM entities, invoices, customer records, credentials or secrets.
 *  - Every input is validated against a closed JSON schema before use; unknown
 *    properties are rejected rather than ignored.
 *  - Faults return a structured error, never a fabricated answer.
 *
 * Pure data + pure functions: no DB, no Node-only APIs, safe in the edge proxy
 * and in the browser bundle.
 */

import { FAQS, INDUSTRIES, SERVICES } from '@/data/site'
import { COMPANY } from '@/lib/constants'
import { PUBLIC_CONTACT, SITE_URL } from '@/lib/site-contact'

export type AgentToolResult =
  | { ok: true; text: string; data: unknown }
  | { ok: false; error: { code: AgentToolErrorCode; message: string } }

export type AgentToolErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'LIMIT_EXCEEDED'
  | 'INTERNAL'

export type AgentToolDefinition = {
  name: string
  title: string
  description: string
  /** Closed JSON Schema for the arguments. Used for validation AND exposure. */
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties: false
  }
  /** Annotations (MCP tool annotations / WebMCP hints). */
  annotations: { readOnlyHint: true; destructiveHint: false; idempotentHint: true; openWorldHint: false }
  run: (args: Record<string, unknown>) => AgentToolResult
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const TEXT_OF = (value: unknown) => ({ content: [{ type: 'text' as const, text: String(value) }] })

/** MCP-compatible `content` envelope for a successful tool result. */
export function toMcpContent(result: AgentToolResult) {
  if (result.ok) return { content: [{ type: 'text' as const, text: result.text }], isError: false }
  return {
    content: [{ type: 'text' as const, text: `Error (${result.error.code}): ${result.error.message}` }],
    isError: true,
  }
}

/* ------------------------------------------------------------------ */
/* Argument validation                                                */
/* ------------------------------------------------------------------ */

function readString(
  args: Record<string, unknown>,
  key: string,
  { max = 120, required = false }: { max?: number; required?: boolean } = {},
): { value?: string; error?: string } {
  const raw = args[key]
  if (raw === undefined || raw === null || raw === '') {
    return required ? { error: `Missing required argument "${key}".` } : { value: undefined }
  }
  if (typeof raw !== 'string') return { error: `Argument "${key}" must be a string.` }
  const value = raw.trim()
  if (value.length > max) return { error: `Argument "${key}" exceeds ${max} characters.` }
  return { value }
}

function readLimit(args: Record<string, unknown>, min: number, max: number, fallback: number): { value: number; error?: string } {
  const raw = args.limit
  if (raw === undefined || raw === null || raw === '') return { value: fallback }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw)) {
    return { value: fallback, error: 'Argument "limit" must be an integer.' }
  }
  if (raw < min || raw > max) return { value: fallback, error: `Argument "limit" must be between ${min} and ${max}.` }
  return { value: raw }
}

const invalid = (message: string): AgentToolResult => ({ ok: false, error: { code: 'INVALID_ARGUMENT', message } })

/* ------------------------------------------------------------------ */
/* Tool 1 — search public services                                     */
/* ------------------------------------------------------------------ */

function scoreService(query: string, haystack: string[]): number {
  const q = query.toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)
  const joined = haystack.join(' ').toLowerCase()
  let score = 0
  if (joined.includes(q)) score += 5
  for (const term of terms) {
    if (joined.includes(term)) score += 2
  }
  return score
}

export const searchPublicServices: AgentToolDefinition = {
  name: 'search_public_services',
  title: 'Search public services',
  description:
    `Search the ${SERVICES.length} publicly published TECH360 engineering services by keyword (title, tagline, capabilities, technology). Returns service titles, one-line descriptions and canonical URLs. Read-only; no pricing or availability is implied.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keyword or phrase, e.g. "crm", "whatsapp", "dashboard".', maxLength: 120 },
      limit: { type: 'number', description: 'Maximum results to return (1-21). Defaults to 5.', minimum: 1, maximum: 21 },
    },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  run: (args) => {
    const query = readString(args, 'query', { max: 120, required: true })
    if (query.error) return invalid(query.error)
    const limit = readLimit(args, 1, SERVICES.length, 5)
    if (limit.error) return invalid(limit.error)

    const q = query.value as string
    const ranked = SERVICES.map((service) => ({
      service,
      score: scoreService(q, [service.title, service.tagline, service.problem, ...service.features, ...service.tech]),
    }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.service.title.localeCompare(b.service.title))
      .slice(0, limit.value)

    if (ranked.length === 0) {
      return {
        ok: true,
        text: `No published TECH360 service matched "${q}". Full catalogue: ${SITE_URL}/services`,
        data: { query: q, matches: [] },
      }
    }

    const matches = ranked.map((row) => ({
      slug: row.service.slug,
      title: row.service.title,
      tagline: row.service.tagline,
      url: `${SITE_URL}/services/${row.service.slug}`,
    }))

    return {
      ok: true,
      text: matches.map((m) => `${m.title} — ${m.tagline} (${m.url})`).join('\n'),
      data: { query: q, matches },
    }
  },
}

/* ------------------------------------------------------------------ */
/* Tool 2 — list public products                                       */
/* ------------------------------------------------------------------ */

/**
 * "Products" are the named, identifiable systems TECH360 builds and the
 * published platform pillars. Nothing is invented: the list is derived from the
 * service catalogue and the platform data used by /platform.
 */
const PRODUCT_CATEGORIES: { category: string; slugs: string[] }[] = [
  { category: 'eCommerce', slugs: ['ecommerce-platforms'] },
  { category: 'Client portal', slugs: ['client-portals'] },
  { category: 'CRM', slugs: ['custom-crm-development', 'whatsapp-ai-sales-crm'] },
  { category: 'Dashboard & reporting', slugs: ['business-dashboards', 'database-systems'] },
  { category: 'Automation', slugs: ['n8n-workflow-automation', 'ai-agent-systems', 'ai-business-automation'] },
  { category: 'Messaging', slugs: ['whatsapp-automation', 'whatsapp-cloud-api-integration', 'email-automation', 'sms-automation'] },
]

export const listPublicProducts: AgentToolDefinition = {
  name: 'list_public_products',
  title: 'List public products',
  description:
    'List the software products TECH360 publishes (eCommerce, client portal, CRM, dashboards, automation and messaging systems) with category and canonical URL. Optionally filter by category. Read-only; no prices, licences or availability claims.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional category filter, e.g. "CRM" or "eCommerce".',
        maxLength: 60,
      },
    },
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  run: (args) => {
    const category = readString(args, 'category', { max: 60 })
    if (category.error) return invalid(category.error)

    const wanted = category.value?.toLowerCase()
    const groups = PRODUCT_CATEGORIES.filter((g) => !wanted || g.category.toLowerCase().includes(wanted))
    const products = groups.flatMap((group) =>
      group.slugs.flatMap((slug) => {
        const service = SERVICES.find((s) => s.slug === slug)
        return service
          ? [{ category: group.category, slug, title: service.title, description: service.tagline, url: `${SITE_URL}/services/${slug}` }]
          : []
      }),
    )

    if (products.length === 0) {
      return {
        ok: true,
        text: `No published product category matched "${category.value}". Categories: ${PRODUCT_CATEGORIES.map((g) => g.category).join(', ')}.`,
        data: { category: category.value ?? null, products: [] },
      }
    }

    return {
      ok: true,
      text: products.map((p) => `[${p.category}] ${p.title} — ${p.description} (${p.url})`).join('\n'),
      data: { category: category.value ?? null, products },
    }
  },
}

/* ------------------------------------------------------------------ */
/* Tool 3 — company information                                        */
/* ------------------------------------------------------------------ */

export const getCompanyInformation: AgentToolDefinition = {
  name: 'get_company_information',
  title: 'Company information',
  description:
    'Return verified public information about TECH360 LLC: legal name, what the company builds, registration details, public contact channels and the published delivery terms. Read-only.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ_ONLY,
  run: () => {
    const data = {
      legalName: 'TECH360 LLC',
      brand: 'Tech360',
      website: SITE_URL,
      email: PUBLIC_CONTACT.email,
      telephone: '+1 (816) 380-8660',
      address: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
      missouriLLC: COMPANY.missouriLLC,
      currency: 'USD',
      builds: [
        'Custom websites and enterprise websites',
        'eCommerce platforms',
        'Custom CRM systems',
        'Client portals',
        'Business dashboards',
        'Workflow automation and API integrations',
        'AI-assisted business systems (client-owned)',
      ],
      deliveryTerms:
        'Every engagement is governed by a written Scope of Work. An HTML preview is supplied before the applicable payment only where the agreed process includes one. Source code is handed over after all required payments are verified and cleared.',
      contactPage: `${SITE_URL}/contact`,
      aboutPage: `${SITE_URL}/about`,
      processPage: `${SITE_URL}/process`,
    }
    return {
      ok: true,
      text: [
        'TECH360 LLC (Tech360) — ' + data.website,
        'Builds: websites, eCommerce platforms, custom CRMs, client portals, dashboards, workflow automation and AI-assisted business systems.',
        'Registered: 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA (Missouri LLC ' + data.missouriLLC + ')',
        'Email: ' + data.email + ' · Telephone: ' + data.telephone,
        'Delivery: ' + data.deliveryTerms,
        'All amounts are in USD.',
      ].join('\n'),
      data,
    }
  },
}

/* ------------------------------------------------------------------ */
/* Tool 4 — public FAQ                                                 */
/* ------------------------------------------------------------------ */

export const getPublicFaq: AgentToolDefinition = {
  name: 'get_public_faq',
  title: 'Public FAQ',
  description:
    `Return published frequently asked questions (${FAQS.length} available) about scope, previews, payments, revisions and source ownership. Optionally filter by keyword and cap the number returned. Read-only.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Optional keyword filter across question and answer.', maxLength: 120 },
      limit: { type: 'number', description: `How many entries to return (1-${FAQS.length}). Defaults to 5.`, minimum: 1, maximum: FAQS.length },
    },
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  run: (args) => {
    const query = readString(args, 'query', { max: 120 })
    if (query.error) return invalid(query.error)
    const limit = readLimit(args, 1, FAQS.length, 5)
    if (limit.error) return invalid(limit.error)

    const wanted = query.value?.toLowerCase()
    const filtered = wanted
      ? FAQS.filter((f) => f.q.toLowerCase().includes(wanted) || f.a.toLowerCase().includes(wanted))
      : FAQS
    const rows = filtered.slice(0, limit.value)

    return {
      ok: true,
      text: rows.length
        ? rows.map((f, i) => `${i + 1}. Q: ${f.q}\nA: ${f.a}`).join('\n\n')
        : `No published FAQ matched "${query.value}". Full list: ${SITE_URL}/faq`,
      data: { query: query.value ?? null, total: filtered.length, faqs: rows },
    }
  },
}

/* ------------------------------------------------------------------ */
/* Tool 5 — open the contact page                                      */
/* ------------------------------------------------------------------ */

/**
 * Deliberately narrow: this tool resolves the correct public contact URL and the
 * sanctioned enquiry channels. It cannot submit a form, send a message or create
 * a CRM record — an agent must hand control back to the human for that.
 */
export const openContactPage: AgentToolDefinition = {
  name: 'open_contact_page',
  title: 'Open contact page',
  description:
    'Return the canonical TECH360 contact page URL and the sanctioned public enquiry channels. Does not submit anything: an agent must hand control back to the user to send a message.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Optional short topic, e.g. "eCommerce project".', maxLength: 120 },
    },
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  run: (args) => {
    const topic = readString(args, 'topic', { max: 120 })
    if (topic.error) return invalid(topic.error)
    const data = {
      url: `${SITE_URL}/contact`,
      channels: ['project enquiry form at /contact', `email ${PUBLIC_CONTACT.email}`, 'on-site Live Support chat'],
      note: 'No message is sent by this tool. The user submits the enquiry themselves.',
      topic: topic.value ?? null,
    }
    return {
      ok: true,
      text: [
        `Contact page: ${data.url}`,
        'Channels: ' + data.channels.join('; '),
        'This tool does not send anything — the user submits the enquiry.',
      ].join('\n'),
      data,
    }
  },
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export const PUBLIC_AGENT_TOOLS: readonly AgentToolDefinition[] = [
  searchPublicServices,
  listPublicProducts,
  getCompanyInformation,
  getPublicFaq,
  openContactPage,
]

export const PUBLIC_AGENT_TOOL_NAMES = PUBLIC_AGENT_TOOLS.map((t) => t.name)

export function getAgentTool(name: string): AgentToolDefinition | undefined {
  return PUBLIC_AGENT_TOOLS.find((t) => t.name === name)
}

/** Tool descriptors with the transport-specific shape stripped. */
export function agentToolDescriptors() {
  return PUBLIC_AGENT_TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    annotations,
  }))
}

/** Industry lookup shared with the MCP endpoint (kept here to avoid a second copy). */
export function findIndustry(slug: string) {
  return INDUSTRIES.find((i) => i.slug === slug)
}

/** Re-exported so both transports stringify results identically. */
export const agentTextOf = TEXT_OF
