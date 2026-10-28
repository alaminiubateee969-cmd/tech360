import { FACTORY_MODULES, FACTORY_VERTICALS, type FactoryBrief, type FactoryModule, type FactoryVertical } from './blueprint'

export const FACTORY_DELIVERY_FORMAT = 'SOURCE_ZIP' as const

export type FactoryScopeManifest = {
  applicationName: string
  vertical: FactoryVertical
  modules: FactoryModule[]
  language: FactoryBrief['language']
  currency: string
  primaryColor: string
  deliveryFormat: typeof FACTORY_DELIVERY_FORMAT
  hostingAndDeployment: string
  clientResponsibilities: string
}

export type FactoryScopeManifestResult =
  | { ok: true; manifest: FactoryScopeManifest }
  | { ok: false; error: string }

function text(value: unknown, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Validate the structured software-delivery terms included in the client SOW. */
export function normalizeFactoryScopeManifest(value: unknown): FactoryScopeManifestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'A structured factoryManifest is required.' }
  }
  const raw = value as Record<string, unknown>
  const applicationName = text(raw.applicationName, 80)
  const vertical = String(raw.vertical ?? '').trim().toLowerCase()
  const language = String(raw.language ?? '').trim().toUpperCase()
  const currency = text(raw.currency, 3).toUpperCase()
  const primaryColor = text(raw.primaryColor, 7).toUpperCase()
  const deliveryFormat = String(raw.deliveryFormat ?? '').trim().toUpperCase()
  const hostingAndDeployment = text(raw.hostingAndDeployment, 1200)
  const clientResponsibilities = text(raw.clientResponsibilities, 800)

  if (!applicationName) return { ok: false, error: 'factoryManifest.applicationName is required.' }
  if (!(FACTORY_VERTICALS as readonly string[]).includes(vertical)) {
    return { ok: false, error: 'factoryManifest.vertical must be a supported factory vertical.' }
  }
  if (!['EN', 'BN', 'BOTH'].includes(language)) {
    return { ok: false, error: 'factoryManifest.language must be EN, BN, or BOTH.' }
  }
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'factoryManifest.currency must be a three-letter currency code.' }
  if (!/^#[0-9A-F]{6}$/.test(primaryColor)) return { ok: false, error: 'factoryManifest.primaryColor must be a six-digit hex color.' }
  if (deliveryFormat !== FACTORY_DELIVERY_FORMAT) {
    return { ok: false, error: 'This factory currently supports SOURCE_ZIP handover only; live hosting/deployment is not provided by this workflow.' }
  }
  if (hostingAndDeployment.length < 20) {
    return { ok: false, error: 'factoryManifest.hostingAndDeployment must state where and how the source package will be hosted or deployed.' }
  }
  if (clientResponsibilities.length < 20) {
    return { ok: false, error: 'factoryManifest.clientResponsibilities must state the customer’s hosting/account responsibilities.' }
  }
  if (!Array.isArray(raw.modules) || raw.modules.length === 0) {
    return { ok: false, error: 'factoryManifest.modules must list the explicitly approved factory modules.' }
  }
  const moduleValues = raw.modules.map((item) => String(item).trim().toLowerCase())
  if (moduleValues.some((item) => !(FACTORY_MODULES as readonly string[]).includes(item))) {
    return { ok: false, error: 'factoryManifest.modules contains an unsupported factory module.' }
  }
  const modules = [...new Set(moduleValues)] as FactoryModule[]
  if (modules.length !== moduleValues.length) {
    return { ok: false, error: 'factoryManifest.modules must not contain duplicates.' }
  }

  return {
    ok: true,
    manifest: {
      applicationName,
      vertical: vertical as FactoryVertical,
      modules,
      language: language as FactoryBrief['language'],
      currency,
      primaryColor,
      deliveryFormat: FACTORY_DELIVERY_FORMAT,
      hostingAndDeployment,
      clientResponsibilities,
    },
  }
}

export function factoryBriefMatchesScopeManifest(
  brief: FactoryBrief,
  manifest: FactoryScopeManifest,
): boolean {
  const sameModules =
    brief.modules.length === manifest.modules.length &&
    brief.modules.every((module) => manifest.modules.includes(module))
  return (
    brief.appName.trim().toLowerCase() === manifest.applicationName.trim().toLowerCase() &&
    brief.vertical === manifest.vertical &&
    sameModules &&
    brief.language === manifest.language &&
    brief.currency.toUpperCase() === manifest.currency &&
    brief.primaryColor.toUpperCase() === manifest.primaryColor &&
    brief.notes.trim().length === 0
  )
}

export function factoryManifestFromScopeContent(content: string): FactoryScopeManifestResult {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    return normalizeFactoryScopeManifest(parsed?.factoryManifest)
  } catch {
    return { ok: false, error: 'The approved scope content is not valid JSON.' }
  }
}
