// ============================================================
// TECH360 — Core constants & domain configuration
// ============================================================

import { PUBLIC_CONTACT } from '@/lib/site-contact'

export const COMPANY = {
  legalName: 'TECH360 LLC',
  brand: 'Tech360',
  domain: 'bdtech360.com',
  url: PUBLIC_CONTACT.url,
  automationUrl: 'https://automation.bdtech360.com',
  missouriLLC: 'LC014737249',
  ein: '98-1940053',
  address: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
  email: PUBLIC_CONTACT.email,
  phone: '+1 (816) 380-8660',
  /**
   * Public contact — single source of truth.
   * Owner decision 2026-10-24: no public WhatsApp number or wa.me link is
   * published anywhere. Public enquiries arrive by webchat, the contact form
   * and email only.
   */
  publicEmail: PUBLIC_CONTACT.email,

  founded: 2021,
} as const

// ------------------------------------------------------------
// OFFICIAL INFO — exactly as printed on the owner-issued
// company pad (TECH360_Official_A4_Letterhead.pdf, kept in
// public/official/ + public/brand/), plus the platform
// contacts in live use. Single source for the login screen,
// the Official Info document (/api/official-info), the admin
// Official Info view, and the shareable PDF generator script
// (scripts/generate-official-info-pdf.py mirrors this data).
// NOTE: the pad prints tech360.com / info@tech360.com while
// the operating platform runs on bdtech360.com — both are
// published, labelled, and never conflated.
// ------------------------------------------------------------
export const OFFICIAL_INFO = {
  legalName: 'TECH360 LLC',
  brand: 'TECH360',
  tagline: 'CONNECT · INNOVATE · GROW',
  padTagline: 'INNOVATE · AUTOMATE · TRANSFORM · SECURE',
  motto: 'Smart Solutions for a Digital Tomorrow',
  missouriLLC: 'LC014737249',
  ein: '98-1940053',
  entityType: 'Missouri Limited Liability Company (Sole Member)',
  addressLines: ['117 S Lexington St Ste 100', 'Harrisonville, MO 64701, USA'],
  address: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
  // As printed on the official pad
  padPhone: '+1 (347) 433 1200',
  padWebsite: 'www.tech360.com',
  padEmail: 'info@tech360.com',
  // Platform contacts in live use
  phone: '+1 (816) 380-8660',
  email: 'info@bdtech360.com',
  website: 'bdtech360.com',
  websiteUrl: 'https://bdtech360.com',
  liveSite: 'https://tech360.space-z.ai',
  servicesLine: 'Web | Cloud | AI | Data | Tech',
  padServices: [
    { name: 'Digital Solutions', note: 'Innovative & Scalable' },
    { name: 'Website Design', note: 'Modern & Responsive' },
    { name: 'SEO Optimization', note: 'Rank Higher, Grow Faster' },
    { name: 'Tech Integration', note: 'Seamless & Efficient' },
    { name: 'Global Connectivity', note: 'Anywhere, Anytime' },
    { name: 'Cloud Services', note: 'Secure & Reliable' },
  ],
  adminLoginPath: '/#/admin',
  clientPortalPath: '/#/portal',
  letterheadPdf: '/official/TECH360_Official_A4_Letterhead.pdf',
  officialInfoPdf: '/official/TECH360-Official-Info.pdf',
  officialInfoDoc: '/api/official-info',
} as const

/** Console roles that sign in at /#/admin — one login, role decides access. */
export const ADMIN_ROLES = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    summary: 'Full control: team & roles, settings, feature/payment switches, internal operations, approvals, logs, official documents.',
    can: ['Create / disable Admin, Manager & Staff accounts', 'Feature & payment-gateway governance', 'Final approvals, refunds & handovers', 'Internal automation, operations center, audit logs'],
  },
  {
    role: 'ADMIN',
    label: 'Admin',
    summary: 'Operations: clients, projects, content, internal automation and day-to-day delivery — without Super-Admin-only governance.',
    can: ['Manage clients, projects & payments (view)', 'Content Studio & Software Factory', 'Reports, media & feeds', 'Cannot change roles, switches or gateway credentials'],
  },
] as const

export const TRACKING = {
  metaPixelId: '957513230517009',
  gtmId: 'GTM-TM87LDXK',
} as const

// ------------------------------------------------------------
// Lead pipeline (first message → final delivery → closure)
// ------------------------------------------------------------
export const PIPELINE_STAGES = [
  'NEW',
  'CONTACTED',
  'BUSINESS_IDENTIFIED',
  'PLAN_RECOMMENDED',
  'SCOPE_COLLECTION',
  'SCOPE_REVIEW',
  'FINAL_SCOPE',
  'CLIENT_APPROVAL',
  'PAYMENT_PENDING',
  'PROJECT_ACTIVE',
  'DEVELOPMENT',
  'CLIENT_REVIEW',
  'FINAL_PAYMENT',
  'DELIVERY',
  'HANDOVER',
  'PASSWORD_CHANGE',
  'REVIEW_REQUESTED',
  'REFERRAL_REQUESTED',
  'COMPLETED',
  'CLOSED',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const PIPELINE_LABELS: Record<string, string> = {
  NEW: 'New Lead',
  CONTACTED: 'Contacted',
  BUSINESS_IDENTIFIED: 'Business Identified',
  PLAN_RECOMMENDED: 'Plan Recommended',
  SCOPE_COLLECTION: 'Scope Collection',
  SCOPE_REVIEW: 'Scope Review',
  FINAL_SCOPE: 'Final Scope',
  CLIENT_APPROVAL: 'Client Approval',
  PAYMENT_PENDING: 'Payment Pending',
  PROJECT_ACTIVE: 'Project Active',
  DEVELOPMENT: 'Development',
  CLIENT_REVIEW: 'Client Review',
  FINAL_PAYMENT: 'Final Payment',
  DELIVERY: 'Delivery',
  HANDOVER: 'Handover',
  PASSWORD_CHANGE: 'Password Change',
  REVIEW_REQUESTED: 'Review Requested',
  REFERRAL_REQUESTED: 'Referral Requested',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
}

export const COMM_CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS', 'FACEBOOK', 'MESSENGER', 'INSTAGRAM', 'LINKEDIN', 'X', 'WEB', 'PORTAL'] as const
export type CommChannel = (typeof COMM_CHANNELS)[number]

export const SENSITIVE_APPROVAL_TYPES = [
  'FINAL_SCOPE_SEND',
  'PAYMENT_INSTRUCTION',
  'REFUND',
  'SOURCE_HANDOVER',
  'CREDENTIAL_OP',
  'DELETION',
  'SOCIAL_PUBLISH',
  'LEGAL_COMM',
  'SENSITIVE_COMM',
  'AGENT_CREATE',
  // A communication-pipeline message the policy requires an admin to
  // approve before it reaches the client.
  'PIPELINE_MESSAGE',
] as const

export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINANCE',
  'PROJECT_MANAGER',
  'MANAGER',
  'DEVELOPER',
  'SALES',
  'SUPPORT',
  'MARKETING',
  'DESIGNER',
  'AUDITOR',
  'STAFF',
] as const

// Role hierarchy (higher = more authority). Shared by server guard() and
// client-side role-gated navigation — single source of truth.
// AUDITOR holds rank 2 for read visibility, while guard() strictly blocks all
// mutating methods for read-only roles.
export const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  FINANCE: 2,
  PROJECT_MANAGER: 2,
  MANAGER: 2,
  AUDITOR: 2,
  DEVELOPER: 1,
  SALES: 1,
  SUPPORT: 1,
  // Delivery craft roles: staff-level console access, no finance or governance.
  MARKETING: 1,
  DESIGNER: 1,
  STAFF: 1,
}
export type Role = (typeof ROLES)[number]

export const SESSION_COOKIE = 't360_session'
export const CSRF_COOKIE = 't360_csrf'
export const SESSION_TTL_HOURS = 12

export const BUSINESS_TYPES = [
  'eCommerce', 'Education', 'Schools & Training', 'Healthcare', 'Hospitals & Clinics',
  'Real Estate', 'Restaurants & Food', 'Agencies', 'Professional Services',
  'Marketing Agencies', 'Local Business', 'International SME', 'Finance', 'Retail',
  'Logistics', 'Travel & Hospitality', 'Construction', 'Manufacturing', 'Legal Services',
  'Technology Company', 'Other',
] as const

export const PROJECT_TYPES = [
  'Business Website', 'Enterprise Website', 'eCommerce Platform', 'Custom CRM', 'WhatsApp-First AI Sales CRM', 'Client Portal',
  'Business Dashboard', 'WhatsApp Automation', 'Email/SMS Automation', 'n8n Workflow Automation',
  'AI Agent System', 'API Integration', 'Database System', 'Cloud Deployment',
  'Maintenance & Support', 'Digital Transformation', 'Other',
] as const

export const BUDGET_RANGES = [
  'Under $500', '$500 - $1,000', '$1,000 - $5,000', '$5,000 - $10,000',
  '$10,000 - $25,000', '$25,000 - $50,000', '$50,000+', 'To be discussed',
] as const

// Journey actions (each maps to a stage transition + automation)
export const JOURNEY_ACTIONS = [
  'INTAKE',              // first message (any channel) → create client + lead
  'DETECT_BUSINESS',     // AI business detection
  'RECOMMEND_PLAN',      // AI plan recommendation
  'ASK_SCOPE_QUESTIONS', // AI scope discovery questions
  'SUBMIT_SCOPE',        // client submits requirements
  'AI_SCOPE_REVIEW',     // AI review + recommended updates + draft SOW
  'ADMIN_SCOPE_APPROVAL',// admin approves draft → final SOW
  'SEND_FINAL_SCOPE',    // WhatsApp + email (approval-gated)
  'CLIENT_SCOPE_DECISION',// approve / revision / clarification
  'REQUEST_MEETING',     // only if client asks
  'GENERATE_PREVIEW',    // HTML preview
  'PREVIEW_VIEWED',      // tracking
  'PREVIEW_DECISION',    // approve / revision
  'REQUEST_PAYMENT',     // payment instructions (approval-gated)
  'RECORD_PAYMENT',      // record + verify
  'START_PROJECT',       // project active + tasks
  'COMPLETE_TASKS',      // dev/testing progress
  'CLIENT_REVIEW',       // client review + corrections
  'FINAL_PAYMENT',       // final payment verification
  'PREPARE_HANDOVER',    // source package (payment-gated)
  'RELEASE_HANDOVER',    // release + download (approval-gated)
  'PASSWORD_CHANGE',     // password change confirmation
  'DELIVERY_CONFIRM',    // client confirmation
  'REQUEST_REVIEW',      // optional review request
  'REQUEST_REFERRAL',    // optional referral request
  'CLOSE_PROJECT',       // closure
] as const
export type JourneyAction = (typeof JOURNEY_ACTIONS)[number]
