/** Opening the operator console must not bypass Super Admin-only data surfaces. */
export function commandRequiresSuperAdmin(action: string): boolean {
  return ['search_memory', 'search_knowledge', 'show_dcc'].includes(action)
}
