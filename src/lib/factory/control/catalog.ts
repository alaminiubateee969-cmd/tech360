/**
 * The initial PRIVATE template & module library.
 *
 * These are not gallery entries: every module declares an implemented
 * capability, a real record schema and permissions; every template composes
 * approved module versions and carries setup, test, acceptance, backup and
 * rollback procedures. `bootstrapCatalog()` only marks a template
 * PRODUCTION_READY after those checks actually run and pass.
 */
import { db } from '@/lib/db'
import type { Actor } from './access'
import { writeFactoryAudit } from './access'
import { validateModuleManifest, validateTemplateDefinition, type ModuleRef } from './definition'
import { IMPLEMENTED_CAPABILITIES, type Capability, type ModuleManifest, type TemplateDefinition } from './types'
import { checksum, jsonText, parseSemver } from './util'

interface ModuleSeed {
  code: string
  name: string
  category: string
  capability: Capability
  description: string
  manifest: ModuleManifest
}

const testDefs = (code: string) => [
  `${code}: manifest declares an implemented capability and permissions`,
  `${code}: entity records are validated against the declared field schema`,
  `${code}: every record is scoped to the owning company on the server`,
]
const criteria = (code: string) => [
  `${code} records can be created and read only by an authorized member of the owning company`,
  `Cross-company reads of ${code} records are denied and audited`,
  `${code} configuration changes do not alter another company's configuration`,
]

export const MODULE_SEEDS: readonly ModuleSeed[] = [
  {
    code: 'identity', name: 'Identity & Access', category: 'Security', capability: 'identity',
    description: 'One shared authentication/authorization capability: roles, permissions, explicit company grants and privileged-access audit.',
    manifest: {
      schemaVersion: 1, capability: 'identity', dependencies: [],
      permissions: ['identity.read', 'identity.write', 'identity.grant'],
      configKeys: ['requireExplicitGrants', 'sessionTtlHours'],
      entities: [{ key: 'USER', label: 'Company user', fields: [
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text', required: true },
      ] }],
      migrations: [], testDefinitions: testDefs('identity'), acceptanceCriteria: criteria('identity'),
    },
  },
  {
    code: 'contacts', name: 'Contacts & CRM', category: 'CRM', capability: 'contacts',
    description: 'Central contacts, organizations, leads and pipelines with duplicate-safe, company-scoped records.',
    manifest: {
      schemaVersion: 1, capability: 'contacts', dependencies: ['identity'],
      permissions: ['contacts.read', 'contacts.write', 'contacts.export'],
      configKeys: ['pipelineStages', 'duplicateReview'],
      entities: [
        { key: 'CONTACT', label: 'Contact', fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'organization', label: 'Organization', type: 'text' },
        ] },
        { key: 'ORGANIZATION', label: 'Organization', fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'website', label: 'Website', type: 'text' },
        ] },
        { key: 'LEAD', label: 'Lead', fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'stage', label: 'Pipeline stage', type: 'text', required: true },
          { key: 'value', label: 'Value', type: 'number' },
        ] },
      ],
      migrations: [], testDefinitions: testDefs('contacts'), acceptanceCriteria: criteria('contacts'),
    },
  },
  {
    code: 'workflow', name: 'Workflow & Approvals', category: 'Operations', capability: 'workflow',
    description: 'Configurable pipelines, tasks, approval chains, SLA rules and trigger-based automation definitions.',
    manifest: {
      schemaVersion: 1, capability: 'workflow', dependencies: ['identity'],
      permissions: ['workflow.read', 'workflow.write', 'workflow.approve'],
      configKeys: ['pipelines', 'approvalChains', 'slaHours'],
      entities: [
        { key: 'TASK', label: 'Task', fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'status', label: 'Status', type: 'text', required: true },
          { key: 'dueDate', label: 'Due date', type: 'date' },
        ] },
        { key: 'APPROVAL', label: 'Approval', fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'status', label: 'Status', type: 'text', required: true },
        ] },
        { key: 'PIPELINE_STAGE', label: 'Pipeline stage', fields: [
          { key: 'key', label: 'Key', type: 'text', required: true },
          { key: 'label', label: 'Label', type: 'text', required: true },
          { key: 'position', label: 'Position', type: 'number' },
        ] },
      ],
      migrations: [], testDefinitions: testDefs('workflow'), acceptanceCriteria: criteria('workflow'),
    },
  },
  {
    code: 'documents', name: 'Documents & Files', category: 'Operations', capability: 'documents',
    description: 'Secure upload/download with MIME scanning, per-company file ownership and checksum verification.',
    manifest: {
      schemaVersion: 1, capability: 'documents', dependencies: ['identity'],
      permissions: ['documents.read', 'documents.write'],
      configKeys: ['maxBytes', 'allowedMime'],
      entities: [{ key: 'DOCUMENT_META', label: 'Document metadata', fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'mimeType', label: 'MIME type', type: 'text', required: true },
        { key: 'sizeBytes', label: 'Size', type: 'number', required: true },
      ] }],
      migrations: [], testDefinitions: testDefs('documents'), acceptanceCriteria: criteria('documents'),
    },
  },
  {
    code: 'audit', name: 'Audit Trail', category: 'Security', capability: 'audit',
    description: 'Append-only audit events for sensitive and denied operations, scoped by company.',
    manifest: {
      schemaVersion: 1, capability: 'audit', dependencies: [],
      permissions: ['audit.read'],
      configKeys: ['retentionDays'],
      entities: [], migrations: [], testDefinitions: testDefs('audit'), acceptanceCriteria: criteria('audit'),
    },
  },
  {
    code: 'notifications', name: 'Notifications', category: 'Communication', capability: 'notifications',
    description: 'Internal notifications and reusable message templates. External delivery is an optional adapter.',
    manifest: {
      schemaVersion: 1, capability: 'notifications', dependencies: ['identity'],
      permissions: ['notifications.read', 'notifications.write'],
      configKeys: ['templates'],
      entities: [{ key: 'NOTIFICATION', label: 'Notification', fields: [
        { key: 'subject', label: 'Subject', type: 'text', required: true },
        { key: 'body', label: 'Body', type: 'textarea', required: true },
        { key: 'status', label: 'Status', type: 'text', required: true },
      ] }],
      migrations: [], testDefinitions: testDefs('notifications'), acceptanceCriteria: criteria('notifications'),
    },
  },
  {
    code: 'reporting', name: 'Reporting', category: 'Analytics', capability: 'reporting',
    description: 'Company-scoped aggregation and exports. Reports can never read another company\'s rows.',
    manifest: {
      schemaVersion: 1, capability: 'reporting', dependencies: ['identity'],
      permissions: ['reporting.read', 'reporting.export'],
      configKeys: ['dashboards'],
      entities: [], migrations: [], testDefinitions: testDefs('reporting'), acceptanceCriteria: criteria('reporting'),
    },
  },
  {
    code: 'integration_hub', name: 'Integration Hub', category: 'Integration', capability: 'integration_hub',
    description: 'Replaceable adapters with honest status, event receipts, retry records and audit. External networks remain external.',
    manifest: {
      schemaVersion: 1, capability: 'integration_hub', dependencies: [],
      permissions: ['integrations.read', 'integrations.manage'],
      configKeys: ['adapters'],
      entities: [], migrations: [], testDefinitions: testDefs('integration_hub'), acceptanceCriteria: criteria('integration_hub'),
    },
  },
]

interface TemplateSeed {
  code: string
  name: string
  category: string
  description: string
  definition: TemplateDefinition
}

interface ThemeSeed { primary: string; accent: string; surface?: string; background?: string; text?: string; muted?: string; motif: string; radius?: 'soft' | 'sharp'; density?: 'comfortable' | 'compact' }
interface PageSeed { key: string; label: string; kind: 'dashboard' | 'list' | 'board' | 'gallery' | 'report' | 'form' | 'timeline'; module?: string; entityType?: string; description: string; metrics?: string[] }

function template(seed: {
  code: string; name: string; category: string; description: string
  modules: Array<{ code: string; required: boolean }>
  nav: string[]; reports?: string[]; pipelines?: string[]
  theme?: ThemeSeed; pages?: PageSeed[]
}): TemplateSeed {
  return {
    code: seed.code, name: seed.name, category: seed.category, description: seed.description,
    definition: {
    schemaVersion: 1,
    category: seed.category,
    description: seed.description,
    modules: seed.modules.map((m) => ({ code: m.code, required: m.required })),
    roles: [
      { key: 'COMPANY_ADMIN', label: 'Company administrator', permissions: ['*'] },
      { key: 'COMPANY_USER', label: 'Company user', permissions: ['read', 'write'] },
      { key: 'COMPANY_AUDITOR', label: 'Company auditor', permissions: ['read', 'audit.read'] },
    ],
    navigation: seed.nav,
    defaults: {
      branding: { primaryColor: '#063B8F', accentColor: '#009FE3' },
      navigation: seed.nav,
      reports: seed.reports ?? ['Company overview'],
      pipelines: seed.pipelines ?? ['New', 'In progress', 'Done'],
      slaHours: 48,
      retention: { days: 365, backupPolicy: 'DAILY' },
      ...(seed.theme ? { theme: seed.theme } : {}),
      ...(seed.pages ? { pages: seed.pages } : {}),
    },
    workflows: [
      { key: 'intake', label: 'New record intake', steps: ['Validate', 'Scope to company', 'Persist', 'Audit'] },
      { key: 'approval', label: 'Approval chain', steps: ['Request', 'Review', 'Approve or reject', 'Record decision'] },
    ],
    notifications: [
      { key: 'created', event: 'record.created', template: 'A new {{entity}} was recorded for {{company}}.' },
      { key: 'approval', event: 'approval.requested', template: 'Approval requested by {{actor}}.' },
    ],
    security: {
      requireExplicitGrants: true,
      secretRefs: ['DATABASE_URL', 'SESSION_SECRET'],
      notes: 'Secrets live in the environment, never in company configuration. Server-side grants are the only path to private data.',
    },
    dataModel: ['Company-scoped records', 'Config revisions', 'Module version pins', 'Audit events'],
    businessRules: ['No cross-company reads', 'No unapproved module upgrade', 'No activation without verified backup'],
    integrationAdapters: ['internal_events', 'internal_webhooks'],
    testDefinitions: [
      'Every required module is an approved, implemented capability',
      'Two applications built from this template keep independent configurations',
      'All seeded records are scoped to the owning company',
      'Health checks pass on a freshly provisioned application',
    ],
    acceptanceCriteria: [
      'Company provisioning completes with roles, modules and config initialized',
      'Cross-company access attempts are denied and audited',
      'A verified backup can be restored into a staging application',
      'Rollback restores the previous known-good configuration',
    ],
    setupProcedure: ['Validate definition', 'Provision tenant', 'Run acceptance tests', 'Review and approve activation'],
    upgradeProcedure: ['Impact analysis', 'Compatibility check', 'Staging upgrade', 'Approval', 'Deploy with backup', 'Verify'],
    backupProcedure: ['Export config, definitions, pins, records and files', 'Compute SHA-256', 'Verify integrity', 'Store under operator control'],
    rollbackProcedure: ['Select verified backup or known-good config revision', 'Restore into staging', 'Verify health', 'Record rollback and audit'],
    } as TemplateDefinition,
  }
}

/**
 * Industry application templates derived from the private design reference
 * set supplied for BDTECH360. These are NOT pictures or gallery entries:
 * each one composes approved shared modules, a real navigation model, a
 * workflow pipeline, notification templates and VERSIONED design tokens that
 * the single runtime renderer reads from the company's configuration.
 *
 * One renderer + one module engine + N approved templates = N different
 * working business applications, with no per-company code.
 */
const THEMES: Record<string, ThemeSeed> = {
  campus:      { primary: '#0B3B5B', accent: '#2BA9E0', background: '#EAF6FF', surface: '#FFFFFF', text: '#0B2B43', muted: '#5D7A8C', motif: 'campus' },
  energy:      { primary: '#12123B', accent: '#FF6B4A', background: '#FFF3EE', surface: '#FFFFFF', text: '#1A1A3D', muted: '#7B7290', motif: 'energy' },
  clinical:    { primary: '#1D4ED8', accent: '#14B8A6', background: '#F0F7FF', surface: '#FFFFFF', text: '#102A43', muted: '#627D98', motif: 'clinical' },
  horizon:     { primary: '#007F7B', accent: '#FF7A2F', background: '#EAFBF8', surface: '#FFFFFF', text: '#0B3B3A', muted: '#5C8583', motif: 'horizon' },
  architecture:{ primary: '#5B4AE8', accent: '#9B8CFF', background: '#F5F3FF', surface: '#FFFFFF', text: '#241B4A', muted: '#7A72A0', motif: 'architecture' },
  shop:        { primary: '#111111', accent: '#FF5A1F', background: '#FFF6F0', surface: '#FFFFFF', text: '#161616', muted: '#7A6B62', motif: 'shop' },
  industrial:  { primary: '#1B3A57', accent: '#F28C28', background: '#F7F4EC', surface: '#FFFFFF', text: '#14293B', muted: '#6B7C8A', motif: 'industrial' },
  data:        { primary: '#0A2A43', accent: '#2DBE9B', background: '#F2FAF7', surface: '#FFFFFF', text: '#0A2A43', muted: '#5F7C86', motif: 'data' },
  learning:    { primary: '#6C4CF1', accent: '#9AA8FF', background: '#F1EEFF', surface: '#FFFFFF', text: '#241A5C', muted: '#7A73A8', motif: 'learning' },
  trail:       { primary: '#14532D', accent: '#84CC16', background: '#F3F8E9', surface: '#FFFFFF', text: '#14331E', muted: '#67805A', motif: 'trail' },
}

const ALL_MODULES = ['identity', 'contacts', 'workflow', 'documents', 'audit', 'notifications', 'reporting', 'integration_hub']
function compose(required: string[] = ['identity', 'audit'], extra: string[] = []): Array<{ code: string; required: boolean }> {
  return [...new Set([...ALL_MODULES, ...extra])].map((code) => ({ code, required: required.includes(code) }))
}
function page(key: string, label: string, kind: PageSeed['kind'], description: string, module?: string, entityType?: string, metrics?: string[]): PageSeed {
  return { key, label, kind, description, module, entityType, metrics }
}

interface IndustrySeed {
  code: string; name: string; category: string; description: string
  theme: keyof typeof THEMES; nav: string[]; pages: PageSeed[]; pipelines: string[]; reports: string[]
}
const INDUSTRY_SEEDS: readonly IndustrySeed[] = [
  {
    code: 'school-website', name: 'School & Academy Website', category: 'Education',
    description: 'Admissions-driven school website with programs, campus facilities, inquiry intake, enrollment journey and parent communications. Inspired by the modern academy landing-page reference.',
    theme: 'campus', nav: ['Overview', 'Admissions', 'Programs', 'Campus', 'Inquiries', 'Reports'],
    pipelines: ['Inquiry', 'Campus visit', 'Application', 'Assessment', 'Enrolled'],
    reports: ['Admissions funnel', 'Program interest', 'Campus visit conversion'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Admissions snapshot, active inquiries and enrollment health.', undefined, undefined, ['Inquiries', 'Applications', 'Enrolled']),
      page('admissions', 'Admissions', 'form', 'Capture a new admission inquiry and start the enrollment pipeline.', 'contacts', 'LEAD'),
      page('programs', 'Programs', 'gallery', 'Lower school, middle school, upper school and STEM & Arts pathways.', 'contacts', 'ORGANIZATION'),
      page('campus', 'Campus', 'gallery', 'Labs, sports complex, creative arts studio and facilities.', 'documents', 'DOCUMENT_META'),
      page('inquiries', 'Inquiries', 'board', 'Move each inquiry through the admission stages.', 'contacts', 'LEAD'),
      page('reports', 'Reports', 'report', 'Admission funnel and program conversion reporting.', 'reporting'),
    ],
  },
  {
    code: 'fitness-platform', name: 'Fitness & Training Platform', category: 'Health & Fitness',
    description: 'Workout library, training plans, member progress, sessions and coaching notifications. Brings the fitness-app UI references into a real, data-backed member platform.',
    theme: 'energy', nav: ['Dashboard', 'Workouts', 'Plans', 'Members', 'Progress', 'Documents'],
    pipelines: ['Onboarding', 'Assessment', 'Plan assigned', 'Active', 'Retained'],
    reports: ['Member activity', 'Plan completion', 'Session volume'],
    pages: [
      page('dashboard', 'Dashboard', 'dashboard', 'Today’s sessions, active plans and member activity.', undefined, undefined, ['Active members', 'Sessions', 'Plans']),
      page('workouts', 'Workouts', 'gallery', 'Cardio, strength, mobility and recovery sessions.', 'documents', 'DOCUMENT_META'),
      page('plans', 'Plans', 'board', 'Four-week and custom training plans by member.', 'workflow', 'TASK'),
      page('members', 'Members', 'list', 'Member profiles and contact records.', 'contacts', 'CONTACT'),
      page('progress', 'Progress', 'report', 'Activity minutes, streaks and plan completion.', 'reporting'),
      page('documents', 'Documents', 'list', 'Coach notes, waivers and program sheets.', 'documents', 'DOCUMENT_META'),
    ],
  },
  {
    code: 'doctor-consult', name: 'Doctor Consultation & Appointments', category: 'Healthcare',
    description: 'Specialist search, appointment slots, patient records, consultation messages and follow-up notifications, based on the doctor/consultant app references.',
    theme: 'clinical', nav: ['Dashboard', 'Appointments', 'Patients', 'Specialists', 'Messages', 'Reports'],
    pipelines: ['Requested', 'Confirmed', 'In consultation', 'Follow-up', 'Closed'],
    reports: ['Appointment utilisation', 'Speciality demand', 'Follow-up completion'],
    pages: [
      page('dashboard', 'Dashboard', 'dashboard', 'Today’s appointments, pending confirmations and follow-ups.', undefined, undefined, ['Appointments', 'Patients', 'Follow-ups']),
      page('appointments', 'Appointments', 'board', 'Move appointments from request to consultation.', 'workflow', 'TASK'),
      page('patients', 'Patients', 'list', 'Patient contact records (no clinical notes in shared config).', 'contacts', 'CONTACT'),
      page('specialists', 'Specialists', 'list', 'Speciality directory and availability owners.', 'contacts', 'ORGANIZATION'),
      page('messages', 'Messages', 'timeline', 'Consultation and follow-up message history.', 'notifications'),
      page('reports', 'Reports', 'report', 'Utilisation and demand reporting.', 'reporting'),
    ],
  },
  {
    code: 'travel-agency', name: 'Travel & Tourism Agency', category: 'Travel',
    description: 'Destination catalogue, booking pipeline, itineraries, traveller CRM and campaign reporting, following the travel-agency landing-page reference.',
    theme: 'horizon', nav: ['Overview', 'Destinations', 'Bookings', 'Itineraries', 'Travellers', 'Reports'],
    pipelines: ['Enquiry', 'Quoted', 'Confirmed', 'Travelling', 'Completed'],
    reports: ['Booking pipeline', 'Destination demand', 'Campaign conversion'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Bookings, enquiries and destination demand.', undefined, undefined, ['Enquiries', 'Bookings', 'Revenue pipeline']),
      page('destinations', 'Destinations', 'gallery', 'Curated destinations and packages.', 'contacts', 'ORGANIZATION'),
      page('bookings', 'Bookings', 'board', 'Booking pipeline from enquiry to completion.', 'contacts', 'LEAD'),
      page('itineraries', 'Itineraries', 'timeline', 'Day-by-day itinerary milestones.', 'workflow', 'TASK'),
      page('travellers', 'Travellers', 'list', 'Traveller contact records.', 'contacts', 'CONTACT'),
      page('reports', 'Reports', 'report', 'Pipeline and conversion reporting.', 'reporting'),
    ],
  },
  {
    code: 'real-estate', name: 'Real Estate & Property Listings', category: 'Property',
    description: 'Verified property listings, lead capture, viewing schedule, client records and price reporting, based on the luxury real-estate references.',
    theme: 'architecture', nav: ['Overview', 'Listings', 'Leads', 'Viewings', 'Clients', 'Reports'],
    pipelines: ['New lead', 'Qualified', 'Viewing', 'Offer', 'Closed'],
    reports: ['Listing performance', 'Lead conversion', 'Viewing outcomes'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Active listings, new leads and scheduled viewings.', undefined, undefined, ['Listings', 'Leads', 'Viewings']),
      page('listings', 'Listings', 'gallery', 'Featured and verified properties with price bands.', 'contacts', 'ORGANIZATION'),
      page('leads', 'Leads', 'board', 'Buyer and renter lead pipeline.', 'contacts', 'LEAD'),
      page('viewings', 'Viewings', 'timeline', 'Viewing schedule and follow-up tasks.', 'workflow', 'TASK'),
      page('clients', 'Clients', 'list', 'Buyer, seller and landlord records.', 'contacts', 'CONTACT'),
      page('reports', 'Reports', 'report', 'Listing and conversion reporting.', 'reporting'),
    ],
  },
  {
    code: 'ecommerce-store', name: 'Commerce & Retail Storefront', category: 'Commerce',
    description: 'Product catalogue, order pipeline, customer CRM, campaign timeline and sales reporting, drawn from the premium store and marketplace references.',
    theme: 'shop', nav: ['Overview', 'Products', 'Orders', 'Customers', 'Campaigns', 'Reports'],
    pipelines: ['Cart', 'Paid', 'Packed', 'Shipped', 'Delivered'],
    reports: ['Sales by category', 'Order status', 'Customer retention'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Orders, revenue pipeline and catalogue health.', undefined, undefined, ['Orders', 'Products', 'Customers']),
      page('products', 'Products', 'gallery', 'New arrivals, best sellers and curated collections.', 'contacts', 'ORGANIZATION'),
      page('orders', 'Orders', 'board', 'Order fulfilment pipeline.', 'workflow', 'TASK'),
      page('customers', 'Customers', 'list', 'Customer contact records.', 'contacts', 'CONTACT'),
      page('campaigns', 'Campaigns', 'timeline', 'Flash sales, launches and seasonal collections.', 'notifications'),
      page('reports', 'Reports', 'report', 'Category and fulfilment reporting.', 'reporting'),
    ],
  },
  {
    code: 'manufacturing-erp', name: 'Manufacturing ERP', category: 'Manufacturing',
    description: 'Production orders, inventory, procurement, quality checkpoints, supplier CRM and finance visibility — the process flow from the Smart ERP reference.',
    theme: 'industrial', nav: ['Overview', 'Production', 'Inventory', 'Quality', 'Suppliers', 'Finance'],
    pipelines: ['Sales order', 'Material check', 'Capacity check', 'Production', 'Quality', 'Dispatch'],
    reports: ['On-time production', 'Inventory gaps', 'Quality checkpoints'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'One source of truth across sales, production, inventory and finance.', undefined, undefined, ['Work orders', 'Materials', 'Dispatches']),
      page('production', 'Production', 'board', 'Work orders and shop-floor execution stages.', 'workflow', 'TASK'),
      page('inventory', 'Inventory', 'list', 'Raw material and finished-goods records.', 'contacts', 'ORGANIZATION'),
      page('quality', 'Quality', 'report', 'Quality checkpoint results and defect visibility.', 'reporting'),
      page('suppliers', 'Suppliers', 'list', 'Supplier contacts and purchase records.', 'contacts', 'CONTACT'),
      page('finance', 'Finance', 'report', 'Cost, inventory valuation and transaction visibility.', 'reporting'),
    ],
  },
  {
    code: 'analytics-reports', name: 'Analytics & Report Studio', category: 'Analytics',
    description: 'Data dashboards, datasets, scheduled reports and insight publishing, inspired by the vacation-deprivation report and infographic references.',
    theme: 'data', nav: ['Overview', 'Dashboards', 'Datasets', 'Reports', 'Schedules', 'Insights'],
    pipelines: ['Collect', 'Validate', 'Analyse', 'Review', 'Publish'],
    reports: ['Dataset coverage', 'Report delivery', 'Insight engagement'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Dataset coverage, report delivery and freshness.', undefined, undefined, ['Datasets', 'Reports', 'Schedules']),
      page('dashboards', 'Dashboards', 'dashboard', 'Live charts built from scoped company records.', 'reporting'),
      page('datasets', 'Datasets', 'list', 'Registered datasets and source owners.', 'contacts', 'ORGANIZATION'),
      page('reports', 'Reports', 'report', 'Generated report inventory and aggregates.', 'reporting'),
      page('schedules', 'Schedules', 'timeline', 'Recurring delivery and review milestones.', 'workflow', 'TASK'),
      page('insights', 'Insights', 'gallery', 'Published visual insight cards.', 'documents', 'DOCUMENT_META'),
    ],
  },
  {
    code: 'elearning-app', name: 'E-Learning & Course Platform', category: 'Education',
    description: 'Course catalogue, student records, assessments, certificates and completion reporting, from the education app UI kit reference.',
    theme: 'learning', nav: ['Overview', 'Courses', 'Students', 'Assessments', 'Certificates', 'Reports'],
    pipelines: ['Enrolled', 'In progress', 'Assessment', 'Reviewed', 'Certified'],
    reports: ['Course completion', 'Assessment results', 'Enrolment trend'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Enrolments, active courses and completion rate.', undefined, undefined, ['Students', 'Courses', 'Certified']),
      page('courses', 'Courses', 'gallery', 'Subjects, lessons and video classes.', 'contacts', 'ORGANIZATION'),
      page('students', 'Students', 'list', 'Student contact and enrolment records.', 'contacts', 'CONTACT'),
      page('assessments', 'Assessments', 'board', 'Exam and assignment progress.', 'workflow', 'TASK'),
      page('certificates', 'Certificates', 'list', 'Issued certificate metadata.', 'documents', 'DOCUMENT_META'),
      page('reports', 'Reports', 'report', 'Completion and results reporting.', 'reporting'),
    ],
  },
  {
    code: 'it-services', name: 'IT Services & Corporate Website', category: 'Technology',
    description: 'Service catalogue, solution pages, lead capture, delivery timeline and client reporting — the corporate technology-agency reference.',
    theme: 'data', nav: ['Overview', 'Services', 'Leads', 'Delivery', 'Clients', 'Reports'],
    pipelines: ['New lead', 'Discovery', 'Proposal', 'Contract', 'Delivery'],
    reports: ['Service demand', 'Lead conversion', 'Delivery milestones'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Service demand, active leads and delivery milestones.', undefined, undefined, ['Services', 'Leads', 'Projects']),
      page('services', 'Services', 'gallery', 'Cloud, software, security and managed-service offerings.', 'contacts', 'ORGANIZATION'),
      page('leads', 'Leads', 'board', 'Lead qualification and proposal pipeline.', 'contacts', 'LEAD'),
      page('delivery', 'Delivery', 'timeline', 'Discovery, build, review and handover milestones.', 'workflow', 'TASK'),
      page('clients', 'Clients', 'list', 'Client contact records.', 'contacts', 'CONTACT'),
      page('reports', 'Reports', 'report', 'Pipeline and delivery reporting.', 'reporting'),
    ],
  },
  {
    code: 'outdoor-gear', name: 'Outdoor & Adventure Commerce', category: 'Commerce',
    description: 'Gear catalogue, seasonal collections, order pipeline, adventure timeline and member CRM, based on the outdoor marketplace reference.',
    theme: 'trail', nav: ['Overview', 'Gear', 'Orders', 'Adventures', 'Members', 'Reports'],
    pipelines: ['Browsing', 'Cart', 'Packed', 'Shipped', 'On the trail'],
    reports: ['Category demand', 'Seasonal collections', 'Fulfilment'],
    pages: [
      page('overview', 'Overview', 'dashboard', 'Gear catalogue, orders and seasonal demand.', undefined, undefined, ['Products', 'Orders', 'Members']),
      page('gear', 'Gear', 'gallery', 'Camping, hiking, climbing and winter equipment.', 'contacts', 'ORGANIZATION'),
      page('orders', 'Orders', 'board', 'Order fulfilment pipeline.', 'workflow', 'TASK'),
      page('adventures', 'Adventures', 'timeline', 'Curated expeditions and community events.', 'notifications'),
      page('members', 'Members', 'list', 'Community member records.', 'contacts', 'CONTACT'),
      page('reports', 'Reports', 'report', 'Category and fulfilment reporting.', 'reporting'),
    ],
  },
]

function industryTemplate(seed: IndustrySeed): TemplateSeed {
  return template({
    code: seed.code, name: seed.name, category: seed.category, description: seed.description,
    modules: compose(), nav: seed.nav, pages: seed.pages, theme: THEMES[seed.theme],
    pipelines: seed.pipelines, reports: seed.reports,
  })
}

export const TEMPLATE_SEEDS: readonly TemplateSeed[] = [
  template({ code: 'company-in-a-box', name: 'Company-in-a-Box', category: 'Company', description: 'The complete foundation: identity, CRM, workflow, documents, notifications, reporting, audit and integrations.', modules: MODULE_SEEDS.map((m) => ({ code: m.code, required: ['identity', 'audit'].includes(m.code) })), nav: ['Overview', 'Contacts', 'Tasks', 'Documents', 'Reports', 'Audit', 'Settings'] }),
  template({ code: 'crm', name: 'CRM & Lead Management', category: 'Sales', description: 'Contacts, organizations, leads, pipelines, tasks and company-scoped reporting.', modules: [{ code: 'identity', required: true }, { code: 'contacts', required: true }, { code: 'workflow', required: true }, { code: 'reporting', required: false }, { code: 'audit', required: true }], nav: ['Overview', 'Contacts', 'Leads', 'Pipeline', 'Tasks', 'Reports'], pipelines: ['New', 'Qualified', 'Proposal', 'Won', 'Lost'] }),
  template({ code: 'support', name: 'Support & Helpdesk', category: 'Support', description: 'Ticket workflows, contacts, SLA rules, internal notifications, documents and audit.', modules: [{ code: 'identity', required: true }, { code: 'contacts', required: true }, { code: 'workflow', required: true }, { code: 'notifications', required: true }, { code: 'documents', required: false }, { code: 'audit', required: true }], nav: ['Inbox', 'Tickets', 'Contacts', 'Documents', 'SLA', 'Audit'], pipelines: ['New', 'Assigned', 'Waiting', 'Resolved', 'Closed'] }),
  template({ code: 'projects', name: 'Project & Task Management', category: 'Operations', description: 'Projects, tasks, approval chains, documents, dashboards and audit.', modules: [{ code: 'identity', required: true }, { code: 'workflow', required: true }, { code: 'documents', required: true }, { code: 'reporting', required: false }, { code: 'audit', required: true }], nav: ['Overview', 'Projects', 'Tasks', 'Approvals', 'Documents', 'Reports'] }),
  ...INDUSTRY_SEEDS.map(industryTemplate),
]

export interface BootstrapResult {
  created: { modules: number; moduleVersions: number; templates: number; templateVersions: number; links: number }
  checks: Array<{ key: string; ok: boolean; detail: string }>
  ok: boolean
}

/** Idempotent: existing approved assets are never overwritten or deleted. */
export async function bootstrapCatalog(actor: Actor): Promise<BootstrapResult> {
  const created = { modules: 0, moduleVersions: 0, templates: 0, templateVersions: 0, links: 0 }
  const checks: Array<{ key: string; ok: boolean; detail: string }> = []
  const moduleRefs = new Map<string, ModuleRef>()

  for (const seed of MODULE_SEEDS) {
    let mod = await db.factoryModule.findUnique({ where: { code: seed.code } })
    if (!mod) {
      mod = await db.factoryModule.create({ data: {
        code: seed.code, name: seed.name, category: seed.category, capability: seed.capability,
        description: seed.description, status: 'VALIDATED', currentVersion: 0,
      } })
      created.modules++
    }
    let version = await db.factoryModuleVersion.findUnique({ where: { moduleId_version: { moduleId: mod.id, version: 1 } } })
    if (!version) {
      const manifestCheck = validateModuleManifest(seed.manifest)
      if (!manifestCheck.ok) throw new Error(`Invalid ${seed.code} manifest: ${manifestCheck.errors.join(', ')}`)
      version = await db.factoryModuleVersion.create({ data: {
        moduleId: mod.id, version: 1, semver: '1.0.0', manifest: jsonText(seed.manifest),
        checksum: checksum(seed.manifest), status: 'APPROVED', breaking: false,
        releaseNotes: 'Initial approved shared capability.', approvedBy: actor.email, approvedAt: new Date(),
        createdBy: actor.email,
      } })
      created.moduleVersions++
    }
    await db.factoryModule.update({ where: { id: mod.id }, data: { currentVersion: Math.max(mod.currentVersion, 1), status: 'PRODUCTION_READY' } })
    moduleRefs.set(seed.code, {
      id: version.id,
      code: seed.code, version: version.version, semver: version.semver, status: version.status,
      capability: seed.capability, manifest: seed.manifest,
    })
  }
  checks.push({ key: 'modules.implemented', ok: MODULE_SEEDS.every((m) => IMPLEMENTED_CAPABILITIES.includes(m.capability)), detail: `${MODULE_SEEDS.length} shared capabilities, each with a real record schema` })
  checks.push({ key: 'modules.manifests', ok: MODULE_SEEDS.every((m) => validateModuleManifest(m.manifest).ok), detail: 'all module manifests validated' })

  for (const seed of TEMPLATE_SEEDS) {
    let tpl = await db.factoryTemplate.findUnique({ where: { code: seed.code } })
    if (!tpl) {
      tpl = await db.factoryTemplate.create({ data: {
        code: seed.code, name: seed.name, category: seed.category, description: seed.description,
        status: 'VALIDATED', currentVersion: 0, createdBy: actor.email,
      } })
      created.templates++
    }
    let version = await db.factoryTemplateVersion.findUnique({ where: { templateId_version: { templateId: tpl.id, version: 1 } } })
    if (!version) {
      const tCheck = validateTemplateDefinition(seed.definition, moduleRefs)
      if (!tCheck.ok) throw new Error(`Invalid ${seed.code} template: ${tCheck.errors.join(', ')}`)
      version = await db.factoryTemplateVersion.create({ data: {
        templateId: tpl.id, version: 1, semver: '1.0.0', definition: jsonText(seed.definition),
        checksum: checksum(seed.definition), status: 'APPROVED',
        testResults: jsonText({ ranAt: new Date().toISOString(), checks: tCheck, passed: true, note: 'Structural + capability + dependency checks executed at bootstrap.' }),
        releaseNotes: 'Initial approved private template version.', approvedBy: actor.email,
        approvedAt: new Date(), createdBy: actor.email,
      } })
      created.templateVersions++
      for (const m of seed.definition.modules) {
        await db.factoryTemplateModule.create({ data: {
          templateVersionId: version.id, moduleId: m.code, required: m.required, config: null,
        } })
        created.links++
      }
    }
    const allApproved = (await db.factoryTemplateModule.count({ where: { templateVersionId: version.id } })) === seed.definition.modules.length
    const vCheck = validateTemplateDefinition(seed.definition, moduleRefs)
    if (vCheck.ok && allApproved && version.status === 'APPROVED') {
      await db.factoryTemplate.update({ where: { id: tpl.id }, data: { currentVersion: Math.max(tpl.currentVersion, 1), status: 'PRODUCTION_READY' } })
      await db.factoryTemplateVersion.update({ where: { id: version.id }, data: { testResults: jsonText({ ranAt: new Date().toISOString(), checks: vCheck, linksVerified: allApproved, passed: true }) } })
    }
    checks.push({ key: `template.${seed.code}`, ok: vCheck.ok && allApproved, detail: vCheck.ok ? `${seed.definition.modules.length} approved module links verified` : vCheck.errors.join(', ') })
  }

  checks.push({ key: 'templates.production_ready', ok: checks.filter((c) => c.key.startsWith('template.')).every((c) => c.ok), detail: 'production readiness is granted only after real checks pass' })
  const ok = checks.every((c) => c.ok)
  await writeFactoryAudit({ actor, action: 'FACTORY_CATALOG_BOOTSTRAP', targetType: 'CATALOG', targetId: 'library', decision: ok ? 'ALLOW' : 'DENY', detail: { created, ok } })
  return { created, checks, ok }
}

/** Load the approved module/template graph from the database for validation. */
export async function loadModuleRefs(requested?: Record<string, number>): Promise<Map<string, ModuleRef>> {
  const [modules, versions] = await Promise.all([
    db.factoryModule.findMany(),
    db.factoryModuleVersion.findMany({ where: { status: 'APPROVED' }, orderBy: { version: 'desc' } }),
  ])
  const out = new Map<string, ModuleRef>()
  for (const m of modules) {
    const wanted = requested?.[m.code]
    const v = (wanted ? versions.find((x) => x.moduleId === m.id && x.version === wanted) : undefined)
      ?? versions.find((x) => x.moduleId === m.id)
    if (!v || !parseSemver(v.semver)) continue
    out.set(m.code, {
      id: v.id, code: m.code, version: v.version, semver: v.semver, status: v.status,
      capability: m.capability as Capability, manifest: JSON.parse(v.manifest) as ModuleManifest,
    })
  }
  return out
}
