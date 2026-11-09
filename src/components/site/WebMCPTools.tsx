'use client'

import { useEffect } from 'react'
import { SERVICES, INDUSTRIES, FAQS } from '@/data/site'
import { COMPANY } from '@/lib/constants'

/**
 * WebMCP — in-browser agent tools.
 *
 * On page load, registers read-only tools through
 * `navigator.modelContext.registerTool()` (guarded: browsers without the
 * WebMCP API simply skip registration). Tools only expose public marketing
 * and contact information; they never mutate anything.
 */

type RegisteredTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => unknown
}

type ModelContextLike = {
  registerTool?: (tool: RegisteredTool) => unknown
}

const SITE = 'https://bdtech360.com'

function text(result: string) {
  return { content: [{ type: 'text' as const, text: result }] }
}

export default function WebMCPTools() {
  useEffect(() => {
    const nav = navigator as Navigator & { modelContext?: ModelContextLike }
    const mc = nav.modelContext
    if (!mc || typeof mc.registerTool !== 'function') return

    const tools: RegisteredTool[] = [
      {
        name: 'get_site_summary',
        description:
          'Return a short factual summary of TECH360 LLC: what the company does, where it is registered, and how to contact it. All amounts are USD.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: () =>
          text(
            [
              `TECH360 LLC (${COMPANY.domain})`,
              'Builds: enterprise websites, eCommerce platforms, custom CRMs, AI-assisted applications, and business automation.',
              `Registered: ${COMPANY.address}`,
              `Email: ${COMPANY.email}`,
              `Phone: ${COMPANY.phone}`,
              `Website: ${SITE}`,
              'Money amounts on this site are quoted in USD.',
            ].join('\n'),
          ),
      },
      {
        name: 'list_services',
        description: `List all ${SERVICES.length} TECH360 services with title, tagline, and URL. Optional "prefix" filters by title.`,
        inputSchema: {
          type: 'object',
          properties: { prefix: { type: 'string', description: 'Case-insensitive title prefix filter' } },
          additionalProperties: false,
        },
        execute: (args) => {
          const prefix = typeof args.prefix === 'string' ? args.prefix.toLowerCase() : ''
          const rows = SERVICES.filter((s) => s.title.toLowerCase().startsWith(prefix))
          return text(
            rows.map((s) => `${s.title} — ${s.tagline} (${SITE}/services/${s.slug})`).join('\n') || 'No matching services.',
          )
        },
      },
      {
        name: 'list_industries',
        description: `List all ${INDUSTRIES.length} industry solution patterns with title and URL. Optional "prefix" filters by title.`,
        inputSchema: {
          type: 'object',
          properties: { prefix: { type: 'string', description: 'Case-insensitive title prefix filter' } },
          additionalProperties: false,
        },
        execute: (args) => {
          const prefix = typeof args.prefix === 'string' ? args.prefix.toLowerCase() : ''
          const rows = INDUSTRIES.filter((i) => i.title.toLowerCase().startsWith(prefix))
          return text(
            rows.map((i) => `${i.title} — ${i.description} (${SITE}/industries/${i.slug})`).join('\n') ||
              'No matching industries.',
          )
        },
      },
      {
        name: 'list_faqs',
        description: `Return frequently asked questions and answers (default 5, max ${FAQS.length}). Optional "limit" adjusts the count.`,
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: `How many FAQs to return (1-${FAQS.length})` } },
          additionalProperties: false,
        },
        execute: (args) => {
          const limit = Math.max(1, Math.min(FAQS.length, typeof args.limit === 'number' ? Math.floor(args.limit) : 5))
          return text(
            FAQS.slice(0, limit)
              .map((f, idx) => `${idx + 1}. Q: ${f.q}\nA: ${f.a}`)
              .join('\n\n'),
          )
        },
      },
      {
        name: 'get_contact_info',
        description: 'Return TECH360 public contact details (email, phone, postal address, contact page URL).',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: () =>
          text(
            [
              `Company: ${COMPANY.legalName}`,
              `Email: ${COMPANY.email}`,
              `Phone: ${COMPANY.phone}`,
              `Address: ${COMPANY.address}`,
              `Contact form: ${SITE}/contact`,
            ].join('\n'),
          ),
      },
    ]

    for (const tool of tools) {
      try {
        mc.registerTool(tool)
      } catch {
        // Registration rejected (duplicate or API quirk) — continue with the rest.
      }
    }
  }, [])

  return null
}
