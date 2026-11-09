import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

/**
 * AUTHENTICATED design-system registry for the operator console.
 *
 * The Design Kit surface (operators only, `/design-kit`) renders the real
 * production components; this endpoint publishes the machine-readable token
 * and component inventory behind it so the console, generated documents and
 * future tooling read ONE source instead of scraping the rendered page.
 *
 * ACCESS: ADMIN and above, matching `VIEW_MIN_ROLE.designKit`.
 * No public route returns this payload.
 */

const COLOR_TOKENS = [
  { name: 'Brand blue', value: '#063B8F', use: 'Primary actions, headings, footer' },
  { name: 'Accent cyan', value: '#009FE3', use: 'Focus rings, links, highlights' },
  { name: 'Success green', value: '#18B83A', use: 'Confirmations, delivered states' },
  { name: 'Warning amber', value: '#F59E0B', use: 'Pending / needs attention' },
  { name: 'Danger red', value: '#EF4444', use: 'Failures, refusals, destructive' },
  { name: 'Ink', value: '#0B1F33', use: 'Body copy on light surfaces' },
  { name: 'Surface', value: '#F7FAFC', use: 'Page background' },
  { name: 'Hairline', value: '#E2E8F0', use: 'Borders and dividers' },
] as const

const ACTION_COMPONENTS = [
  { name: 'PrimaryLink', use: 'One primary action per screen', minTarget: '44px' },
  { name: 'SecondaryLink', use: 'Tonal supporting action', minTarget: '44px' },
  { name: 'OutlineLink', use: 'Bordered secondary action', minTarget: '44px' },
  { name: 'GhostLink', use: 'Tertiary text action', minTarget: '44px' },
  { name: 'ChatButton', use: 'Opens the on-site live support chat', minTarget: '44px' },
  { name: 'AIAssistantLink', use: 'Legacy alias for the chat entry point', minTarget: '44px' },
  { name: 'CardLinkAffordance', use: 'Non-anchor affordance inside a linked card', minTarget: 'n/a' },
] as const

const DIAGRAM_COMPONENTS = [
  { name: 'CloudArchitectureDiagram', use: 'Deployment and infrastructure topology' },
  { name: 'DevLifecycleDiagram', use: 'Delivery lifecycle and review gates' },
  { name: 'QualityChecklistDiagram', use: 'Acceptance and QA checkpoints' },
  { name: 'SecurityArchitectureDiagram', use: 'Trust boundaries and control layers' },
  { name: 'LeadFunnel', use: 'Enquiry-to-engagement funnel' },
  { name: 'PortalSignInSequence', use: 'One-time-code sign-in sequence' },
  { name: 'ProjectSwimlane', use: 'Cross-role project execution swimlane' },
] as const

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      requestedBy: { email: g.user.email, role: g.user.role },
      accessibleVia: '/api/admin/design-kit',
      renderedAt: '/design-kit (authenticated console view)',
      typography: {
        family: 'Inter / system UI stack',
        scale: ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'],
        rules: [
          'One h1 per page; sections use h2 and subsections use h3.',
          'Body copy never drops below 12px, and never below 14px for paragraphs.',
          'Tracking tightens above text-3xl; uppercase eyebrows use tracking-[0.2em].',
        ],
      },
      colorTokens: COLOR_TOKENS,
      actionComponents: ACTION_COMPONENTS,
      diagramComponents: DIAGRAM_COMPONENTS,
      spacing: { base: '4px', radii: ['rounded-lg', 'rounded-xl', 'rounded-2xl'], containers: ['max-w-3xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl'] },
      accessibility: [
        'Every interactive control has a visible focus ring and a 44px minimum touch target.',
        'Colour is never the only signal — icons and labels carry the meaning too.',
        'Motion respects prefers-reduced-motion; no scroll-jacking.',
        'Landmarks: one main#main-content per page, labelled nav regions, skip link first in the tab order.',
      ],
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    },
  )
}
