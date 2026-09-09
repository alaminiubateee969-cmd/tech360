// ============================================================
// TECH360 — Core constants & domain configuration
// ============================================================

export const COMPANY = {
  legalName: 'TECH360 LLC',
  brand: 'Tech360',
  domain: 'bdtech360.com',
  url: 'https://bdtech360.com',
  automationUrl: 'https://automation.bdtech360.com',
  missouriLLC: 'LC014737249',
  ein: '98-1940053',
  address: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
  email: 'info@bdtech360.com',
  whatsapp: '+8801327100297',
  whatsappLink: 'https://wa.me/8801327100297',
  phone: '+1 (816) 380-8660',
  founded: 2021,
} as const

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

export const COMM_CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'WEB', 'PORTAL'] as const
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
] as const

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] as const
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
  'Business Website', 'Enterprise Website', 'eCommerce Platform', 'Custom CRM', 'Client Portal',
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
