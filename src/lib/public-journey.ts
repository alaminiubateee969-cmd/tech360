/**
 * TECH360 — the PUBLIC customer journey.
 *
 * Seven steps a prospective or current client can verify from the outside:
 * what happens, who does it, and what they receive at the end of it.
 *
 * This is deliberately separate from the internal operator pipeline
 * (`src/lib/pipeline/spec-copy.ts`, 11 stages, 13 message variants). That
 * specification includes internal approval mechanics, message-by-message
 * wording and CRM save rules that are part of TECH360's operating system,
 * not part of the public offer. `/api/pipeline/public` returns THIS list.
 *
 * Pure data — safe for any runtime, including the edge proxy.
 */

export type PublicJourneyStep = {
  number: number
  key: string
  title: string
  description: string
  delivers: string
}

export const PUBLIC_JOURNEY: readonly PublicJourneyStep[] = [
  {
    number: 1,
    key: 'ENQUIRY',
    title: 'You send an enquiry',
    description:
      'Use the on-site chat or the project form. Tell us the problem, the constraints you already know about, and how you want to be contacted.',
    delivers: 'A written acknowledgement and a named contact for your enquiry.',
  },
  {
    number: 2,
    key: 'DISCOVERY',
    title: 'We confirm the requirement',
    description:
      'A short discovery conversation establishes scope, the systems involved, the people who must approve, and any third-party providers that need access.',
    delivers: 'A documented requirement summary you can correct before anything is quoted.',
  },
  {
    number: 3,
    key: 'PROPOSAL',
    title: 'You receive a written proposal',
    description:
      'The proposal sets out deliverables, price in USD, schedule, revision allowance, payment milestones, support and ownership terms.',
    delivers: 'A proposal document with explicit inclusions and exclusions.',
  },
  {
    number: 4,
    key: 'SOW',
    title: 'You approve the Scope of Work',
    description:
      'Work begins only against an approved Scope of Work. Discussion, a proposal draft or a verbal agreement does not replace that approval.',
    delivers: 'An approved Scope of Work that governs the engagement.',
  },
  {
    number: 5,
    key: 'PREVIEW',
    title: 'You review the deliverable',
    description:
      'Where the agreed process includes an HTML preview, you review the visual design and the elements actually shown before the applicable payment step. A preview is a design review, not proof that backend systems are complete.',
    delivers: 'A reviewable preview and a dated approval record where one is included.',
  },
  {
    number: 6,
    key: 'PAYMENT',
    title: 'Payment is verified and cleared',
    description:
      'Milestones are invoiced as agreed. Payment counts as received only once cleared funds can be verified against transaction records or provider confirmation.',
    delivers: 'Invoices, receipts and a verified payment record.',
  },
  {
    number: 7,
    key: 'HANDOVER',
    title: 'Delivery and source-code handover',
    description:
      'After all required payments have been received and cleared, and unless the agreement says otherwise, source code and agreed files are handed over with the documentation needed to run the system.',
    delivers: 'Delivered system, handover documentation and the agreed source code.',
  },
] as const

/** The two delivery promises that appear on public surfaces. */
export const PUBLIC_DELIVERY_PROMISES = [
  'HTML Preview Before Payment — where the approved Scope of Work includes a preview.',
  'Source Code After Full Payment — after all required payments are verified and cleared.',
] as const
