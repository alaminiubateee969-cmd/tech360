import { hasRole } from '@/lib/access-policy'

/** The shared console navigation contract. API guards remain authoritative. */
export type AdminViewId =
  | 'dashboard' | 'ops' | 'leads' | 'clients' | 'approvals' | 'communications' | 'chat'
  | 'payments' | 'projects' | 'reviews' | 'agents' | 'command' | 'memory' | 'newsletter' | 'seo' | 'marketing'
  | 'knowledge' | 'content' | 'blog' | 'analytics' | 'logs' | 'n8n' | 'reports' | 'settings' | 'team'
  | 'factory' | 'media' | 'feeds' | 'telephony' | 'prompts'
  | 'models' | 'skills' | 'departments' | 'tasks' | 'workflows' | 'integrations' | 'backup' | 'dcc'
  | 'workforce' | 'pipeline'

export const VIEW_MIN_ROLE: Record<AdminViewId, 'STAFF' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN'> = {
  dashboard: 'STAFF',
  ops: 'SUPER_ADMIN',
  leads: 'STAFF',
  clients: 'STAFF',
  approvals: 'MANAGER',
  communications: 'STAFF',
  chat: 'STAFF',
  payments: 'MANAGER',
  projects: 'MANAGER',
  reviews: 'MANAGER',
  agents: 'ADMIN',
  command: 'ADMIN',
  memory: 'SUPER_ADMIN',
  newsletter: 'MANAGER',
  seo: 'MANAGER',
  marketing: 'STAFF',
  prompts: 'STAFF',
  knowledge: 'SUPER_ADMIN',
  content: 'ADMIN',
  blog: 'MANAGER',
  analytics: 'MANAGER',
  logs: 'SUPER_ADMIN',
  n8n: 'SUPER_ADMIN',
  reports: 'MANAGER',
  settings: 'SUPER_ADMIN',
  team: 'SUPER_ADMIN',
  factory: 'ADMIN',
  media: 'STAFF',
  feeds: 'STAFF',
  telephony: 'STAFF',
  models: 'SUPER_ADMIN',
  skills: 'SUPER_ADMIN',
  departments: 'SUPER_ADMIN',
  tasks: 'SUPER_ADMIN',
  workflows: 'SUPER_ADMIN',
  integrations: 'SUPER_ADMIN',
  backup: 'SUPER_ADMIN',
  dcc: 'SUPER_ADMIN',
  workforce: 'SUPER_ADMIN',
  pipeline: 'MANAGER',
}

const ROLE_VIEWS: Record<string, readonly AdminViewId[]> = {
  FINANCE: ['dashboard', 'clients', 'payments', 'approvals', 'reports'],
  PROJECT_MANAGER: ['dashboard', 'leads', 'clients', 'approvals', 'communications', 'chat', 'projects', 'pipeline', 'reports'],
  DEVELOPER: ['dashboard', 'clients', 'communications', 'chat', 'projects'],
  SALES: ['dashboard', 'leads', 'clients', 'communications', 'chat', 'telephony', 'marketing', 'prompts'],
  SUPPORT: ['dashboard', 'leads', 'clients', 'communications', 'chat', 'telephony', 'marketing', 'prompts'],
  AUDITOR: ['dashboard', 'leads', 'clients', 'payments', 'projects', 'reports'],
}

/** Used by BOTH sidebar navigation and dashboard tiles; unknown views fail closed. */
export function canAccessAdminView(role: string | null | undefined, view: string): boolean {
  if (!role) return false
  if (Object.prototype.hasOwnProperty.call(ROLE_VIEWS, role)) {
    return ROLE_VIEWS[role].includes(view as AdminViewId)
  }
  if (!Object.prototype.hasOwnProperty.call(VIEW_MIN_ROLE, view)) return false
  return hasRole({ role }, VIEW_MIN_ROLE[view as AdminViewId])
}
