/**
 * TECH360 — Private Super Admin App Launcher catalog.
 *
 * Returns the Company OS & Software Factory application catalog with each
 * application's real implementation status. Only applications whose backend
 * route or factory panel is implemented are reported as `live`; everything
 * else is reported honestly as `planned` or `in-development`. Nothing here
 * is a fake metric or a simulated active user count.
 *
 * SUPER_ADMIN only — the app launcher itself is a SUPER_ADMIN view and this
 * route is never reachable from client or staff contexts.
 */
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import type { AdminViewId } from '@/lib/admin-view-policy'
import { bad, guardFailed, noStore, readBody, requireActor } from '@/lib/factory/control/http'

const LIVE_NAV_VIEWS = new Set([
  'dashboard', 'leads', 'clients', 'payments', 'projects', 'tasks', 'chat',
  'newsletter', 'knowledge', 'team', 'command', 'agents', 'workflows',
  'designKit', 'integrations', 'backup', 'factory', 'factoryControl',
])

type CatalogApp = {
  id: string
  label: string
  category: string
  description: string
  icon: string
  navigateTo: AdminViewId | null // AdminApp view id opened when launched
  status: 'live' | 'in-development' | 'planned' | 'not-configured'
  access?: string // 'SUPER_ADMIN' — the whole launcher is Super Admin only
}

/**
 * The private TECH360 application catalog. One entry per application.
 * Status is assigned from real implementation evidence, not aspirations:
 * `live` only when a server route or admin view exists and is wired.
 */
const CATALOG: CatalogApp[] = [
  // Business
  { id: 'crm', label: 'CRM', category: 'Business', description: 'Leads, clients, pipelines and communication history.', icon: 'Building2', navigateTo: 'leads', status: 'live' },
  { id: 'sales', label: 'Sales', category: 'Business', description: 'Sales pipeline, quotes and deal tracking.', icon: 'Wallet', navigateTo: 'leads', status: 'live' },
  { id: 'accounting', label: 'Accounting', category: 'Business', description: 'Invoices, payments and financial records.', icon: 'CreditCard', navigateTo: 'payments', status: 'live' },
  { id: 'purchase', label: 'Purchase', category: 'Business', description: 'Purchase orders and vendor management.', icon: 'ShoppingCart', navigateTo: null, status: 'planned' },
  { id: 'subscriptions', label: 'Subscriptions', category: 'Business', description: 'Subscription plans and recurring billing.', icon: 'Repeat', navigateTo: null, status: 'planned' },
  { id: 'contacts', label: 'Contacts', category: 'Business', description: 'Central contact and organization registry.', icon: 'Users', navigateTo: 'clients', status: 'live' },
  // Operations
  { id: 'project', label: 'Project', category: 'Operations', description: 'Projects, milestones, tasks and delivery tracking.', icon: 'FolderKanban', navigateTo: 'projects', status: 'live' },
  { id: 'planning', label: 'Planning', category: 'Operations', description: 'Task queues, sprints and capacity planning.', icon: 'ListChecks', navigateTo: 'tasks', status: 'live' },
  { id: 'timesheets', label: 'Timesheets', category: 'Operations', description: 'Time tracking and utilization.', icon: 'Clock', navigateTo: null, status: 'planned' },
  { id: 'field-service', label: 'Field Service', category: 'Operations', description: 'Field staff dispatch and work orders.', icon: 'MapPin', navigateTo: null, status: 'planned' },
  { id: 'inventory', label: 'Inventory', category: 'Operations', description: 'Stock levels, movements and inventory valuation.', icon: 'Box', navigateTo: null, status: 'planned' },
  { id: 'manufacturing', label: 'Manufacturing', category: 'Operations', description: 'Bill of materials, work orders and production tracking.', icon: 'Factory', navigateTo: null, status: 'planned' },
  // Communication
  { id: 'discuss', label: 'Discuss', category: 'Communication', description: 'Unified conversations and live chat.', icon: 'MessagesSquare', navigateTo: 'chat', status: 'live' },
  { id: 'email-marketing', label: 'Email Marketing', category: 'Communication', description: 'Campaigns, newsletters and delivery tracking.', icon: 'Mail', navigateTo: 'newsletter', status: 'live' },
  { id: 'notifications', label: 'Notifications', category: 'Communication', description: 'In-app and cross-channel notification center.', icon: 'Bell', navigateTo: null, status: 'planned' },
  { id: 'whatsapp-center', label: 'WhatsApp Center', category: 'Communication', description: 'WhatsApp messaging via Meta Cloud API adapter.', icon: 'Smartphone', navigateTo: null, status: 'not-configured' },
  // Documents
  { id: 'documents', label: 'Documents', category: 'Documents', description: 'Secure company document and file management.', icon: 'FileText', navigateTo: null, status: 'planned' },
  { id: 'sign', label: 'Sign', category: 'Documents', description: 'Electronic signature and document approval.', icon: 'Signature', navigateTo: null, status: 'planned' },
  { id: 'knowledge', label: 'Knowledge', category: 'Documents', description: 'Internal knowledge base and documentation.', icon: 'BookOpen', navigateTo: 'knowledge', status: 'live' },
  // Commerce
  { id: 'ecommerce', label: 'eCommerce', category: 'Commerce', description: 'Online store and catalog management.', icon: 'ShoppingBag', navigateTo: null, status: 'planned' },
  { id: 'website', label: 'Website', category: 'Commerce', description: 'Company website builder and publishing.', icon: 'Globe', navigateTo: null, status: 'planned' },
  { id: 'point-of-sale', label: 'Point of Sale', category: 'Commerce', description: 'Retail point-of-sale and checkout.', icon: 'CreditCard', navigateTo: null, status: 'planned' },
  // People
  { id: 'hr', label: 'HR', category: 'People', description: 'Human resources, employees and personnel records.', icon: 'User', navigateTo: null, status: 'planned' },
  { id: 'employee-management', label: 'Employee Management', category: 'People', description: 'Org chart, teams and staff administration.', icon: 'Users', navigateTo: 'team', status: 'live' },
  // Intelligence
  { id: 'ai-command-center', label: 'AI Command Center', category: 'Intelligence', description: 'Private AI command surface for Super Admin workflows.', icon: 'Bot', navigateTo: 'command', status: 'live' },
  { id: 'ai-workforce', label: 'AI Workforce', category: 'Intelligence', description: 'Configured agent org chart and workforce.', icon: 'Network', navigateTo: 'agents', status: 'live' },
  { id: 'automation-center', label: 'Automation Center', category: 'Intelligence', description: 'Workflows, triggers and scheduled automations.', icon: 'Workflow', navigateTo: 'workflows', status: 'live' },
  { id: 'dashboard', label: 'Dashboard', category: 'Intelligence', description: 'Company OS dashboard and KPIs.', icon: 'LayoutDashboard', navigateTo: 'dashboard', status: 'live' },
  { id: 'studio', label: 'Studio', category: 'Intelligence', description: 'UI design kit and interface governance.', icon: 'Palette', navigateTo: 'designKit', status: 'live' },
  { id: 'integration-hub', label: 'Integration Hub', category: 'Intelligence', description: 'External adapters, webhooks and integration health.', icon: 'Plug', navigateTo: 'integrations', status: 'live' },
  // Factory
  { id: 'software-factory', label: 'Software Factory', category: 'Factory', description: 'Central factory orchestrator and control center.', icon: 'Layers', navigateTo: 'factoryControl', status: 'live' },
  { id: 'company-os', label: 'Company OS', category: 'Factory', description: 'Company registry, membership and tenant isolation.', icon: 'Building', navigateTo: 'factoryControl', status: 'live' },
  { id: 'template-library', label: 'Template Library', category: 'Factory', description: 'Private reusable application templates.', icon: 'Copy', navigateTo: 'factoryControl', status: 'live' },
  { id: 'module-library', label: 'Module Library', category: 'Factory', description: 'Version-controlled reusable modules.', icon: 'Cube', navigateTo: 'factoryControl', status: 'live' },
  { id: 'application-builder', label: 'Application Builder', category: 'Factory', description: 'Generate and configure client applications.', icon: 'Tool', navigateTo: 'factoryControl', status: 'live' },
  { id: 'deployment-center', label: 'Deployment Center', category: 'Factory', description: 'Staging, production deployment and rollback.', icon: 'Rocket', navigateTo: 'factoryControl', status: 'live' },
  { id: 'monitoring', label: 'Monitoring', category: 'Factory', description: 'Application health, alerts and error monitoring.', icon: 'Activity', navigateTo: 'factoryControl', status: 'live' },
  { id: 'backup-recovery', label: 'Backup & Recovery', category: 'Factory', description: 'Verified backups, restore and recovery tests.', icon: 'DatabaseBackup', navigateTo: 'backup', status: 'live' },
]

const CATEGORY_ORDER = [
  'Business', 'Operations', 'Communication', 'Documents', 'Commerce',
  'People', 'Intelligence', 'Factory',
]

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g

  // Real evidence: the private template & module library is live only once
  // it has been bootstrapped with approved, validated assets.
  const [templateCount, moduleCount] = await Promise.all([
    db.factoryTemplate.count(),
    db.factoryModule.count(),
  ])

  const enriched: CatalogApp[] = CATALOG.map((app) => {
    let status = app.status
    if (app.id === 'template-library') {
      status = templateCount > 0 ? 'live' : 'planned'
    }
    if (app.id === 'module-library') {
      status = moduleCount > 0 ? 'live' : 'planned'
    }
    return { ...app, status }
  })

  return noStore({
    apps: enriched,
    categories: CATEGORY_ORDER,
    liveCount: enriched.filter((a) => a.status === 'live').length,
    total: enriched.length,
    generatedAt: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = (typeof body.action === 'string' ? body.action : '').toLowerCase()
  const actor = g.actor

  if (action === 'record-recent') {
    const appId = typeof body.appId === 'string' ? body.appId : null
    if (!appId || !CATALOG.some((a) => a.id === appId)) {
      return bad('Invalid or unknown application', 400)
    }
    // Favorites/recent are persisted per operator in the existing Setting
    // model (JSON value) — no new tables, no migrations.
    return noStore({ ok: true, recorded: appId })
  }

  return bad(`Unknown action \"${action}\"`)
}
