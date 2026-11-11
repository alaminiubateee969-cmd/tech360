#!/usr/bin/env node
/**
 * TECH360 — industry hero art generator.
 *
 * WHY THIS EXISTS
 * Before this script, `src/data/industry-images.ts` mapped all 20 industry
 * slugs onto 9 shared stock photographs: nine industries pointed at the same
 * "business" photo, retail duplicated eCommerce, schools duplicated education,
 * and so on. Every industry page therefore looked like every other one.
 *
 * Each entry below is a DISTINCT scene drawn in the site's own diagram
 * language (flat panels, brand palette, one accent per sector) with the
 * industry's own vocabulary in the labels. Nothing here is a photograph, so:
 *   - no stock licence is claimed or needed,
 *   - no real person, brand or institution is depicted,
 *   - the labels are English-only and live in this file, not in a bitmap.
 *
 * USAGE
 *   node scripts/generate-industry-heroes.mjs [--check]
 *
 * `--check` verifies every committed file matches this source of truth.
 */
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'images', 'industries')

const W = 1600
const H = 900

const C = {
  navy: '#063B8F',
  ink: '#0B1F33',
  cyan: '#009FE3',
  cyanSoft: '#E3F4FD',
  green: '#18B83A',
  greenSoft: '#E8F8EC',
  amber: '#F59E0B',
  amberSoft: '#FEF3E2',
  violet: '#6D5BD0',
  violetSoft: '#EEEBFB',
  teal: '#0E8F8F',
  tealSoft: '#E2F4F4',
  rose: '#C2417A',
  roseSoft: '#FBE8F1',
  slate: '#526173',
  slateSoft: '#F1F6FA',
  line: '#E2E8F0',
  white: '#FFFFFF',
}

const FONT = 'DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const text = (x, y, v, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 18}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? 'start'}" opacity="${o.opacity ?? 1}">${esc(v)}</text>`

const panel = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 16}" fill="${o.fill ?? C.white}" stroke="${o.stroke ?? C.line}" stroke-width="${o.sw ?? 1.5}" opacity="${o.opacity ?? 1}"/>`

const bar = (x, y, w, fill = C.line, h = 9, r = 4.5) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`

const pill = (x, y, label, o = {}) => {
  const size = o.size ?? 14
  const w = Math.round(label.length * size * 0.58 + 26)
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${o.h ?? 30}" rx="${(o.h ?? 30) / 2}" fill="${o.fill ?? C.cyanSoft}"/>` +
    text(x + w / 2, y + (o.h ?? 30) / 2 + size * 0.36, label, {
      size,
      weight: 600,
      fill: o.color ?? C.navy,
      anchor: 'middle',
    })
  )
}

/** A small, sector-specific glyph. Kept geometric so it renders identically anywhere. */
function glyph(kind, cx, cy, size, color) {
  const s = size
  const half = s / 2
  switch (kind) {
    case 'cart':
      return `<path d="M${cx - half} ${cy - half * 0.7} h${s * 0.2} l${s * 0.16} ${s * 0.55} h${s * 0.46} l${s * 0.16} ${-s * 0.4} h${-s * 0.62}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${cx - half * 0.35}" cy="${cy + half * 0.62}" r="${s * 0.09}" fill="${color}"/><circle cx="${cx + half * 0.3}" cy="${cy + half * 0.62}" r="${s * 0.09}" fill="${color}"/>`
    case 'cap':
      return `<path d="M${cx - half} ${cy - half * 0.15} L${cx} ${cy - half * 0.65} L${cx + half} ${cy - half * 0.15} L${cx} ${cy + half * 0.35} Z" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linejoin="round"/><path d="M${cx + half * 0.55} ${cy} v${half * 0.62}" stroke="${color}" stroke-width="${s * 0.09}" stroke-linecap="round"/>`
    case 'pulse':
      return `<path d="M${cx - half} ${cy} h${s * 0.24} l${s * 0.14} ${-half * 0.7} l${s * 0.18} ${half * 1.4} l${s * 0.14} ${-half * 0.7} h${s * 0.3}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'house':
      return `<path d="M${cx - half} ${cy} L${cx} ${cy - half * 0.8} L${cx + half} ${cy} v${half * 0.75} h${-s} Z" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linejoin="round"/>`
    case 'fork':
      return `<path d="M${cx - half * 0.55} ${cy - half} v${s * 0.42} a${s * 0.16} ${s * 0.16} 0 0 0 ${s * 0.32} 0 v${-s * 0.42}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/><path d="M${cx - half * 0.39} ${cy - half * 0.2} v${s * 0.72}" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/><path d="M${cx + half * 0.5} ${cy - half} c${s * 0.3} ${s * 0.2} ${s * 0.3} ${s * 0.5} 0 ${s * 0.7} v${half * 0.3}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/>`
    case 'briefcase':
      return `<rect x="${cx - half}" y="${cy - half * 0.55}" width="${s}" height="${s * 0.72}" rx="${s * 0.09}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><path d="M${cx - half * 0.35} ${cy - half * 0.55} v${-half * 0.3} h${half * 0.7} v${half * 0.3}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/>`
    case 'scale':
      return `<path d="M${cx} ${cy - half * 0.85} v${s * 0.85}" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/><path d="M${cx - half} ${cy - half * 0.45} h${s}" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/><path d="M${cx - half * 0.65} ${cy + half * 0.5} a${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.36} 0 Z" fill="none" stroke="${color}" stroke-width="${s * 0.09}"/><path d="M${cx + half * 0.29} ${cy + half * 0.5} a${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.36} 0 Z" fill="none" stroke="${color}" stroke-width="${s * 0.09}"/>`
    case 'truck':
      return `<rect x="${cx - half}" y="${cy - half * 0.5}" width="${s * 0.58}" height="${s * 0.62}" rx="${s * 0.06}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><path d="M${cx - half * 0.42} ${cy + half * 0.12} h${s * 0.5}" stroke="${color}" stroke-width="${s * 0.09}"/><circle cx="${cx - half * 0.45}" cy="${cy + half * 0.62}" r="${s * 0.1}" fill="${color}"/><circle cx="${cx + half * 0.45}" cy="${cy + half * 0.62}" r="${s * 0.1}" fill="${color}"/><path d="M${cx - half + s * 0.58} ${cy - half * 0.15} h${s * 0.28} v${s * 0.27} h${-s * 0.28}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linejoin="round"/>`
    case 'gear':
      return `<circle cx="${cx}" cy="${cy}" r="${half * 0.42}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><g stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315]
        .map((deg) => {
          const rad = (deg * Math.PI) / 180
          return `<path d="M${cx + Math.cos(rad) * half * 0.62} ${cy + Math.sin(rad) * half * 0.62} L${cx + Math.cos(rad) * half * 0.92} ${cy + Math.sin(rad) * half * 0.92}"/>`
        })
        .join('')}</g>`
    case 'chart':
      return `<path d="M${cx - half} ${cy + half * 0.7} h${s}" stroke="${color}" stroke-width="${s * 0.09}" stroke-linecap="round"/><rect x="${cx - half * 0.75}" y="${cy - half * 0.1}" width="${s * 0.16}" height="${s * 0.8}" rx="${s * 0.05}" fill="${color}" opacity="0.55"/><rect x="${cx - half * 0.3}" y="${cy - half * 0.55}" width="${s * 0.16}" height="${s}" rx="${s * 0.05}" fill="${color}" opacity="0.8"/><rect x="${cx + half * 0.15}" y="${cy - half * 0.35}" width="${s * 0.16}" height="${s * 0.7}" rx="${s * 0.05}" fill="${color}"/>`
    case 'chip':
      return `<rect x="${cx - half * 0.6}" y="${cy - half * 0.6}" width="${s * 0.6}" height="${s * 0.6}" rx="${s * 0.07}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><g stroke="${color}" stroke-width="${s * 0.09}" stroke-linecap="round"><path d="M${cx - half * 0.35} ${cy - half * 0.6} v${-half * 0.25}"/><path d="M${cx + half * 0.35} ${cy - half * 0.6} v${-half * 0.25}"/><path d="M${cx - half * 0.35} ${cy + half} v${half * 0.0}"/><path d="M${cx + half * 0.35} ${cy + half} v${half * 0.0}"/><path d="M${cx - half * 0.6} ${cy - half * 0.15} h${-half * 0.25}"/><path d="M${cx + half} ${cy - half * 0.15} h${half * 0.0}"/></g>`
    case 'shield':
      return `<path d="M${cx} ${cy - half} L${cx + half * 0.8} ${cy - half * 0.62} v${half * 0.7} c0 ${half * 0.55} ${-half * 0.45} ${half * 0.85} ${-half * 0.8} ${half} c${-half * 0.35} ${-half * 0.15} ${-half * 0.8} ${-half * 0.45} ${-half * 0.8} ${-half} v${-half * 0.7} Z" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linejoin="round"/>`
    case 'store':
      return `<path d="M${cx - half} ${cy - half * 0.55} h${s} l${half * 0.15} ${half * 0.5} h${-s * 1.3} Z" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linejoin="round"/><path d="M${cx - half * 0.8} ${cy - half * 0.05} v${half * 0.85} h${s * 0.8} v${-half * 0.85}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linejoin="round"/>`
    case 'users':
      return `<circle cx="${cx - half * 0.32}" cy="${cy - half * 0.35}" r="${s * 0.2}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><circle cx="${cx + half * 0.45}" cy="${cy - half * 0.2}" r="${s * 0.16}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><path d="M${cx - half * 0.85} ${cy + half * 0.75} c0 ${-half * 0.55} ${half * 0.35} ${-half * 0.75} ${half * 0.62} ${-half * 0.75} s${half * 0.62} ${half * 0.2} ${half * 0.62} ${half * 0.75}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/><path d="M${cx + half * 0.05} ${cy + half * 0.75} c0 ${-half * 0.42} ${half * 0.28} ${-half * 0.6} ${half * 0.48} ${-half * 0.6} s${half * 0.48} ${half * 0.18} ${half * 0.48} ${half * 0.6}" fill="none" stroke="${color}" stroke-width="${s * 0.1}" stroke-linecap="round"/>`
    case 'globe':
      return `<circle cx="${cx}" cy="${cy}" r="${half * 0.85}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/><ellipse cx="${cx}" cy="${cy}" rx="${half * 0.36}" ry="${half * 0.85}" fill="none" stroke="${color}" stroke-width="${s * 0.08}"/><path d="M${cx - half * 0.85} ${cy} h${s * 0.85}" stroke="${color}" stroke-width="${s * 0.08}"/>`
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${half * 0.7}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/>`
  }
}

/**
 * Sector definitions. Each industry gets its own accent, glyph, headline data
 * vocabulary and a motif variant so no two heroes look alike.
 */
const INDUSTRIES = [
  {
    slug: 'ecommerce',
    sector: 'COMMERCE',
    title: 'eCommerce',
    glyph: 'cart',
    tone: C.cyan,
    soft: C.cyanSoft,
    variant: 'board',
    stats: [
      { label: 'Checkout', value: 'Catalogue → order' },
      { label: 'Payments', value: 'Verified capture' },
      { label: 'Fulfilment', value: 'Tracking synced' },
    ],
    steps: ['Cart & checkout', 'Payment capture', 'Order routing', 'Returns'],
    details: ['Catalogue and cart', 'Verified payment capture', 'Order routed to fulfilment', 'Return and refund log'],
  },
  {
    slug: 'retail',
    sector: 'COMMERCE',
    title: 'Retail',
    glyph: 'store',
    tone: C.violet,
    soft: C.violetSoft,
    variant: 'board',
    stats: [
      { label: 'Stores', value: 'POS connected' },
      { label: 'Stock', value: 'Replenishment' },
      { label: 'Loyalty', value: 'One profile' },
    ],
    steps: ['Point of sale', 'Stock & replenishment', 'Promotions', 'Store reporting'],
    details: ['Store point of sale', 'Stock and replenishment', 'Promotion rules applied', 'Store-level reporting'],
  },
  {
    slug: 'restaurants-food',
    sector: 'COMMERCE',
    title: 'Restaurants & Food',
    glyph: 'fork',
    tone: C.amber,
    soft: C.amberSoft,
    variant: 'board',
    stats: [
      { label: 'Orders', value: 'Dine-in & delivery' },
      { label: 'Kitchen', value: 'Ticket routing' },
      { label: 'Costs', value: 'Recipe margins' },
    ],
    steps: ['Order intake', 'Kitchen tickets', 'Delivery hand-off', 'Waste & cost log'],
    details: ['Dine-in and delivery intake', 'Kitchen ticket routing', 'Delivery hand-off', 'Waste and cost log'],
  },
  {
    slug: 'education',
    sector: 'EDUCATION',
    title: 'Education',
    glyph: 'cap',
    tone: C.cyan,
    soft: C.cyanSoft,
    variant: 'timeline',
    stats: [
      { label: 'Admissions', value: 'Enquiry → enrolled' },
      { label: 'Academics', value: 'Records & results' },
      { label: 'Guardians', value: 'Parent portal' },
    ],
    steps: ['Enquiry', 'Application', 'Enrolment', 'Progression'],
    details: ['Enquiry and application', 'Admission decision', 'Enrolment recorded', 'Progression and results'],
  },
  {
    slug: 'schools-training',
    sector: 'EDUCATION',
    title: 'Schools & Training',
    glyph: 'users',
    tone: C.teal,
    soft: C.tealSoft,
    variant: 'timeline',
    stats: [
      { label: 'Cohorts', value: 'Scheduled terms' },
      { label: 'Attendance', value: 'Daily records' },
      { label: 'Certificates', value: 'Issued on completion' },
    ],
    steps: ['Enrol cohort', 'Schedule classes', 'Track attendance', 'Issue certificates'],
    details: ['Cohort enrolment', 'Class scheduling', 'Daily attendance', 'Certificate issue'],
  },
  {
    slug: 'healthcare',
    sector: 'HEALTHCARE',
    title: 'Healthcare',
    glyph: 'pulse',
    tone: C.green,
    soft: C.greenSoft,
    variant: 'board',
    stats: [
      { label: 'Appointments', value: 'Scheduled & recalled' },
      { label: 'Records', value: 'Controlled access' },
      { label: 'Consent', value: 'Explicit capture' },
    ],
    steps: ['Booking', 'Consultation', 'Prescription', 'Recall'],
    details: ['Appointment booking', 'Consultation record', 'Prescription issued', 'Recall scheduled'],
  },
  {
    slug: 'hospitals-clinics',
    sector: 'HEALTHCARE',
    title: 'Hospitals & Clinics',
    glyph: 'shield',
    tone: C.navy,
    soft: C.cyanSoft,
    variant: 'layers',
    stats: [
      { label: 'Departments', value: 'Role-based access' },
      { label: 'Audit', value: 'Every record change' },
      { label: 'Referrals', value: 'Tracked hand-offs' },
    ],
    steps: ['Registration', 'Triage', 'Treatment', 'Discharge summary'],
    details: ['Patient registration', 'Triage priority', 'Treatment record', 'Discharge summary'],
  },
  {
    slug: 'real-estate',
    sector: 'PROPERTY',
    title: 'Real Estate',
    glyph: 'house',
    tone: C.slate,
    soft: C.slateSoft,
    variant: 'grid',
    stats: [
      { label: 'Listings', value: 'Enquiry to viewing' },
      { label: 'Offers', value: 'Documented' },
      { label: 'Closings', value: 'Milestone tracked' },
    ],
    steps: ['Listing', 'Viewing', 'Offer', 'Completion'],
    details: ['Listing published', 'Viewing scheduled', 'Offer documented', 'Completion milestones'],
  },
  {
    slug: 'construction',
    sector: 'PROPERTY',
    title: 'Construction',
    glyph: 'gear',
    tone: C.amber,
    soft: C.amberSoft,
    variant: 'layers',
    stats: [
      { label: 'Sites', value: 'Progress recorded' },
      { label: 'Variations', value: 'Approved in writing' },
      { label: 'Safety', value: 'Checklist gates' },
    ],
    steps: ['Tender', 'Site setup', 'Milestones', 'Defects'],
    details: ['Tender priced', 'Site mobilisation', 'Milestone sign-off', 'Defects resolution'],
  },
  {
    slug: 'agencies',
    sector: 'SERVICES',
    title: 'Agencies',
    glyph: 'briefcase',
    tone: C.violet,
    soft: C.violetSoft,
    variant: 'grid',
    stats: [
      { label: 'Briefs', value: 'Scoped & versioned' },
      { label: 'Resourcing', value: 'Capacity view' },
      { label: 'Billing', value: 'Timesheet to invoice' },
    ],
    steps: ['Brief', 'Estimate', 'Deliver', 'Invoice'],
    details: ['Brief scoped', 'Estimate approved', 'Work delivered', 'Invoice raised'],
  },
  {
    slug: 'professional-services',
    sector: 'SERVICES',
    title: 'Professional Services',
    glyph: 'briefcase',
    tone: C.teal,
    soft: C.tealSoft,
    variant: 'grid',
    stats: [
      { label: 'Engagements', value: 'Scope controlled' },
      { label: 'Time', value: 'Captured per matter' },
      { label: 'Clients', value: 'Single record' },
    ],
    steps: ['Intake', 'Engagement letter', 'Delivery', 'Billing'],
    details: ['Client intake', 'Engagement letter', 'Matter delivery', 'Billing and collection'],
  },
  {
    slug: 'marketing-agencies',
    sector: 'SERVICES',
    title: 'Marketing Agencies',
    glyph: 'chart',
    tone: C.rose,
    soft: C.roseSoft,
    variant: 'board',
    stats: [
      { label: 'Campaigns', value: 'Planned & approved' },
      { label: 'Creative', value: 'Review workflow' },
      { label: 'Reporting', value: 'Scheduled exports' },
    ],
    steps: ['Plan', 'Produce', 'Approve', 'Report'],
    details: ['Campaign plan', 'Creative production', 'Review and approval', 'Performance report'],
  },
  {
    slug: 'local-businesses',
    sector: 'SERVICES',
    title: 'Local Businesses',
    glyph: 'store',
    tone: C.green,
    soft: C.greenSoft,
    variant: 'grid',
    stats: [
      { label: 'Enquiries', value: 'Captured centrally' },
      { label: 'Bookings', value: 'Deposit verified' },
      { label: 'Reviews', value: 'Requested after job' },
    ],
    steps: ['Enquiry', 'Quote', 'Job booked', 'Follow-up'],
    details: ['Enquiry captured', 'Quote sent', 'Job booked', 'Review requested'],
  },
  {
    slug: 'international-smes',
    sector: 'SERVICES',
    title: 'International SMEs',
    glyph: 'globe',
    tone: C.cyan,
    soft: C.cyanSoft,
    variant: 'layers',
    stats: [
      { label: 'Currencies', value: 'USD reporting' },
      { label: 'Entities', value: 'Isolated tenants' },
      { label: 'Time zones', value: 'Scheduled jobs' },
    ],
    steps: ['Entity setup', 'Localisation', 'Reporting', 'Handover'],
    details: ['Entity provisioning', 'Localisation applied', 'Consolidated reporting', 'Handover pack'],
  },
  {
    slug: 'finance',
    sector: 'FINANCE',
    title: 'Finance',
    glyph: 'chart',
    tone: C.navy,
    soft: C.cyanSoft,
    variant: 'layers',
    stats: [
      { label: 'Controls', value: 'Dual approval' },
      { label: 'Reconciliation', value: 'Audited trail' },
      { label: 'Reporting', value: 'Period close' },
    ],
    steps: ['Origination', 'Approval', 'Settlement', 'Reconciliation'],
    details: ['Origination', 'Dual approval', 'Settlement', 'Reconciliation'],
  },
  {
    slug: 'logistics',
    sector: 'OPERATIONS',
    title: 'Logistics',
    glyph: 'truck',
    tone: C.teal,
    soft: C.tealSoft,
    variant: 'timeline',
    stats: [
      { label: 'Shipments', value: 'Status reconciled' },
      { label: 'Routes', value: 'Planned & tracked' },
      { label: 'Exceptions', value: 'Escalated' },
    ],
    steps: ['Booking', 'Pickup', 'In transit', 'Proof of delivery'],
    details: ['Shipment booked', 'Pickup confirmed', 'In-transit status', 'Proof of delivery'],
  },
  {
    slug: 'travel-hospitality',
    sector: 'OPERATIONS',
    title: 'Travel & Hospitality',
    glyph: 'globe',
    tone: C.rose,
    soft: C.roseSoft,
    variant: 'timeline',
    stats: [
      { label: 'Bookings', value: 'Availability synced' },
      { label: 'Guests', value: 'Preference record' },
      { label: 'Partners', value: 'Commission tracked' },
    ],
    steps: ['Enquiry', 'Availability', 'Confirmation', 'Stay / trip'],
    details: ['Enquiry received', 'Availability checked', 'Booking confirmed', 'Trip or stay record'],
  },
  {
    slug: 'manufacturing',
    sector: 'OPERATIONS',
    title: 'Manufacturing',
    glyph: 'gear',
    tone: C.navy,
    soft: C.slateSoft,
    variant: 'layers',
    stats: [
      { label: 'Planning', value: 'Demand to schedule' },
      { label: 'Quality', value: 'Inspection gates' },
      { label: 'Maintenance', value: 'Planned & logged' },
    ],
    steps: ['Demand plan', 'Production order', 'Quality gate', 'Dispatch'],
    details: ['Demand planned', 'Production order', 'Inspection gate', 'Dispatch recorded'],
  },
  {
    slug: 'legal-services',
    sector: 'SERVICES',
    title: 'Legal Services',
    glyph: 'scale',
    tone: C.navy,
    soft: C.slateSoft,
    variant: 'grid',
    stats: [
      { label: 'Matters', value: 'Conflict-checked' },
      { label: 'Deadlines', value: 'Diarised' },
      { label: 'Documents', value: 'Version controlled' },
    ],
    steps: ['Intake', 'Conflict check', 'Matter work', 'Billing'],
    details: ['Matter intake', 'Conflict check', 'Matter work', 'Billing and time'],
  },
  {
    slug: 'technology-companies',
    sector: 'TECHNOLOGY',
    title: 'Technology Companies',
    glyph: 'chip',
    tone: C.cyan,
    soft: C.cyanSoft,
    variant: 'board',
    stats: [
      { label: 'Releases', value: 'Staged promotion' },
      { label: 'Support', value: 'Ticket SLAs' },
      { label: 'Billing', value: 'Subscription metered' },
    ],
    steps: ['Roadmap', 'Build', 'Release', 'Support'],
    details: ['Roadmap item', 'Build and review', 'Staged release', 'Support handover'],
  },
]

const defs = `
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#F7FAFC"/><stop offset="100%" stop-color="#E9F1F8"/>
  </linearGradient>
  <linearGradient id="heroInk" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0B1F33"/><stop offset="100%" stop-color="#063B8F"/>
  </linearGradient>
</defs>`

function header(industry) {
  return (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>` +
    pill(96, 84, industry.sector, { fill: industry.soft, color: industry.tone, size: 14 }) +
    text(96, 182, industry.title, { size: 58, weight: 800, fill: C.ink }) +
    text(96, 224, 'Operating system blueprint', { size: 21, fill: C.slate }) +
    `<circle cx="${W - 150}" cy="150" r="86" fill="${industry.soft}"/>` +
    glyph(industry.glyph, W - 150, 150, 96, industry.tone) +
    text(96, H - 56, 'Illustrative architecture diagram — not a client system or measured result.', {
      size: 15,
      fill: C.slate,
      opacity: 0.9,
    })
  )
}

/* Motif A — workflow board */
function variantBoard(ind) {
  const y = 300
  const bw = 300
  const gap = 40
  const startX = 96
  return (
    panel(96, y - 24, W - 192, 470, { fill: C.white, stroke: C.line, r: 22, sw: 2 }) +
    ind.steps
      .map((step, i) => {
        const x = startX + 24 + i * (bw + gap)
        return (
          panel(x, y + 30, bw, 300, { fill: C.slateSoft, stroke: C.line, r: 16 }) +
          `<rect x="${x}" y="${y + 30}" width="${bw}" height="7" rx="3.5" fill="${ind.tone}"/>` +
          text(x + 24, y + 78, `0${i + 1}`, { size: 15, weight: 800, fill: ind.tone }) +
          text(x + 24, y + 118, step, { size: 20, weight: 700, fill: C.ink }) +
          panel(x + 24, y + 140, bw - 48, 78, { fill: C.white, stroke: C.line, r: 12 }) +
          text(x + 40, y + 176, ind.details[i] ?? '', { size: 13, fill: C.slate }) +
          bar(x + 40, y + 188, Math.min(200, (ind.details[i]?.length ?? 10) * 6.4), C.line, 7) +
          pill(x + 24, y + 236, i === 0 ? 'Starts here' : 'Linked', {
            fill: ind.soft,
            color: ind.tone,
            size: 12,
            h: 26,
          })
        )
      })
      .join('') +
    ind.stats
      .map((stat, i) => {
        const x = 120 + i * 464
        return (
          text(x, y + 386, stat.label.toUpperCase(), { size: 12, weight: 700, fill: C.slate }) +
          text(x, y + 414, stat.value, { size: 18, weight: 700, fill: C.ink })
        )
      })
      .join('')
  )
}

/* Motif B — stage timeline */
function variantTimeline(ind) {
  const left = 236
  const right = W - 236
  const y = 392
  const panelTop = 300
  const panelH = 414
  return (
    panel(96, panelTop, W - 192, panelH, { fill: C.white, stroke: C.line, r: 22, sw: 2 }) +
    `<path d="M${left} ${y} H${right}" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M${left} ${y} H${left + ((right - left) * 3) / 4}" stroke="${ind.tone}" stroke-width="6" stroke-linecap="round"/>` +
    ind.steps
      .map((step, i) => {
        const cx = left + ((right - left) * i) / (ind.steps.length - 1)
        return (
          `<circle cx="${cx}" cy="${y}" r="19" fill="${C.white}" stroke="${ind.tone}" stroke-width="5"/>` +
          text(cx, y + 52, step, { size: 17, weight: 700, fill: C.ink, anchor: 'middle' }) +
          text(cx, y + 78, ind.details[i] ?? '', { size: 12.5, fill: C.slate, anchor: 'middle' }) +
          panel(cx - 116, y + 104, 232, 92, { fill: C.slateSoft, stroke: C.line, r: 12 }) +
          text(cx - 96, y + 132, `Stage ${i + 1} of ${ind.steps.length}`, {
            size: 12,
            weight: 700,
            fill: ind.tone,
          }) +
          bar(cx - 96, y + 148, 184, C.line, 8) +
          bar(cx - 96, y + 148, Math.round(184 * ((i + 1) / ind.steps.length)), ind.tone, 8) +
          text(cx - 96, y + 182, ind.stats[i]?.label ?? 'Tracked', { size: 11.5, fill: C.slate })
        )
      })
      .join('') +
    text(120, panelTop + panelH - 24, 'Each stage records who acted, when, and what changed.', {
      size: 13.5,
      fill: C.slate,
      opacity: 0.9,
    })
  )
}

/* Motif C — layered modules */
function variantLayers(ind) {
  const y = 300
  return (
    panel(96, y, W - 192, 486, { fill: C.white, stroke: C.line, r: 22, sw: 2 }) +
    ind.steps
      .map((step, i) => {
        const indent = 48 + i * 26
        const top = y + 34 + i * 104
        return (
          panel(96 + indent, top, W - 192 - indent * 2, 88, { fill: C.slateSoft, stroke: C.line, r: 14 }) +
          `<rect x="${96 + indent}" y="${top}" width="8" height="88" rx="4" fill="${ind.tone}"/>` +
          text(96 + indent + 32, top + 36, step, { size: 21, weight: 700, fill: C.ink }) +
          text(96 + indent + 32, top + 62, ind.details[i] ?? '', { size: 14, fill: C.slate }) +
          pill(W - 96 - indent - 200, top + 28, ind.stats[i]?.label ?? 'Module', {
            fill: ind.soft,
            color: ind.tone,
            size: 12,
            h: 26,
          })
        )
      })
      .join('') +
    text(120, y + 456, 'Every layer is versioned and handed over with the agreed Scope of Work.', {
      size: 14,
      fill: C.slate,
    })
  )
}

/* Motif D — module grid */
function variantGrid(ind) {
  const y = 300
  return (
    panel(96, y, W - 192, 470, { fill: C.white, stroke: C.line, r: 22, sw: 2 }) +
    ind.steps
      .map((step, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = 128 + col * 700
        const top = y + 32 + row * 208
        return (
          panel(x, top, 648, 180, { fill: C.slateSoft, stroke: C.line, r: 16 }) +
          `<circle cx="${x + 54}" cy="${top + 54}" r="26" fill="${ind.soft}"/>` +
          glyph(ind.glyph, x + 54, top + 54, 30, ind.tone) +
          text(x + 96, top + 48, step, { size: 20, weight: 700, fill: C.ink }) +
          text(x + 96, top + 76, ind.details[i] ?? '', { size: 15, fill: C.slate }) +
          bar(x + 32, top + 116, Math.min(430, (ind.details[i]?.length ?? 12) * 7.4), C.line, 8) +
          bar(x + 32, top + 136, Math.min(300, (ind.details[i]?.length ?? 12) * 5.2), C.line, 8) +
          pill(x + 470, top + 118, ind.stats[i]?.label ?? 'Module', {
            fill: ind.soft,
            color: ind.tone,
            size: 12,
            h: 26,
          })
        )
      })
      .join('')
  )
}

const VARIANTS = {
  board: variantBoard,
  timeline: variantTimeline,
  layers: variantLayers,
  grid: variantGrid,
}

function build(ind) {
  const motif = VARIANTS[ind.variant](ind)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs}${header(ind)}${motif}</svg>`
}

const check = process.argv.includes('--check')
mkdirSync(OUT, { recursive: true })

const NON_LATIN = /[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/u
let failed = false

for (const industry of INDUSTRIES) {
  const svg = build(industry)
  if (NON_LATIN.test(svg.replace(/<[^>]+>/g, ' '))) {
    console.error(`✗ ${industry.slug}: label text contains a non-Latin script`)
    failed = true
  }
  const rendered = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
  const target = join(OUT, `${industry.slug}-hero.png`)

  if (check) {
    const current = existsSync(target) ? readFileSync(target) : null
    if (!current || !current.equals(rendered)) {
      console.error(`✗ ${industry.slug}-hero.png is out of date — run: node scripts/generate-industry-heroes.mjs`)
      failed = true
    }
  } else {
    await sharp(rendered).toFile(target)
  }
}

if (!check) console.log(`✓ ${INDUSTRIES.length} industry heroes → public/images/industries/`)
if (failed) process.exit(1)
