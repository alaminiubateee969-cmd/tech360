import { gatewayConfigured } from '@/lib/ai-gateway/client'
import {
  openRouterConfigured,
  openAiConfigured,
  geminiConfigured,
  groqConfigured,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  FREE_MODEL_ROUTER,
} from '@/lib/agents/model-provider'
import { getZaiProviderStatus } from '@/lib/ai-provider'

export type AgentProviderKind =
  | 'ai-gateway'
  | 'openrouter'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'zai'
  | 'none'

export type AgentProviderStatus = {
  provider: AgentProviderKind
  state: 'CONFIGURED' | 'NOT_CONFIGURED' | 'MISCONFIGURED'
  configured: boolean
  detail: string
}

export interface AgentProviderCatalogEntry {
  kind: Exclude<AgentProviderKind, 'none'>
  name: string
  configured: boolean
  active: boolean
  defaultModel: string
  envKeys: string[]
  detail: string
}

type Environment = Record<string, string | undefined>

function normalizePreferredProvider(raw: string | undefined): AgentProviderKind | 'invalid' | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || v === 'auto') return null
  if (v === 'none' || v === 'off' || v === 'disabled') return 'none'
  if (v === 'ai-gateway' || v === 'gateway' || v === 'aigateway') return 'ai-gateway'
  if (v === 'openrouter') return 'openrouter'
  if (v === 'openai') return 'openai'
  if (v === 'gemini' || v === 'google' || v === 'google-gemini') return 'gemini'
  if (v === 'groq') return 'groq'
  if (v === 'zai') return 'zai'
  return 'invalid'
}

function isProviderConfigured(kind: Exclude<AgentProviderKind, 'none'>, env: Environment): boolean {
  switch (kind) {
    case 'ai-gateway':
      return gatewayConfigured(env)
    case 'openrouter':
      return openRouterConfigured(env)
    case 'openai':
      return openAiConfigured(env)
    case 'gemini':
      return geminiConfigured(env)
    case 'groq':
      return groqConfigured(env)
    case 'zai':
      return getZaiProviderStatus(env).configured
  }
}

const PRIORITY_ORDER: Array<Exclude<AgentProviderKind, 'none'>> = [
  'ai-gateway',
  'openrouter',
  'openai',
  'gemini',
  'groq',
  'zai',
]

/**
 * The execution policy used by runAgent AND its diagnostics.
 * An explicit global choice (including disabled/invalid/missing configuration)
 * cannot be overridden by a persisted agent model or another configured key.
 * Only automatic mode permits per-agent prefixes and priority selection.
 * Configuration is not a provider health check: only a real execution proves
 * that the upstream accepts a request. Never include endpoint values or keys.
 */
export function resolveAgentProvider(env: Environment = process.env, agentModel?: string): AgentProviderKind {
  const preferred = normalizePreferredProvider(env.AI_PROVIDER)
  if (preferred === 'none' || preferred === 'invalid') return 'none'
  if (preferred) return isProviderConfigured(preferred, env) ? preferred : 'none'

  const prefix = agentModel?.trim().match(/^(openai|gemini|groq|openrouter|ai-gateway|zai):(.+)$/i)
  if (prefix) {
    const kind = prefix[1].toLowerCase() as Exclude<AgentProviderKind, 'none'>
    return isProviderConfigured(kind, env) ? kind : 'none'
  }
  for (const kind of PRIORITY_ORDER) {
    if (isProviderConfigured(kind, env)) return kind
  }
  return 'none'
}

export function getAgentProviderStatus(env: Environment = process.env): AgentProviderStatus {
  const preferred = normalizePreferredProvider(env.AI_PROVIDER)
  if (preferred === 'none') {
    return {
      provider: 'none', state: 'NOT_CONFIGURED', configured: false,
      detail: 'AI execution is explicitly disabled by AI_PROVIDER; no provider requests will be sent.',
    }
  }
  if (preferred === 'invalid') {
    return {
      provider: 'none', state: 'MISCONFIGURED', configured: false,
      detail: 'AI_PROVIDER is not supported. Select ai-gateway, openrouter, openai, gemini, groq, zai, auto, or none; no provider requests will be sent.',
    }
  }
  const provider = resolveAgentProvider(env)
  if (preferred && provider === 'none') {
    return {
      provider, state: 'MISCONFIGURED', configured: false,
      detail: 'The provider selected by AI_PROVIDER has missing or invalid required configuration; automatic fallback is disabled.',
    }
  }
  if (provider === 'ai-gateway') {
    return {
      provider,
      state: 'CONFIGURED',
      configured: true,
      detail: 'AI Gateway configuration is present; upstream availability requires a successful execution.',
    }
  }
  if (provider === 'openrouter') {
    return {
      provider,
      state: 'CONFIGURED',
      configured: true,
      detail: 'OpenRouter key is configured; model availability and free-tier quotas require a successful execution.',
    }
  }
  if (provider === 'openai') {
    return {
      provider,
      state: 'CONFIGURED',
      configured: true,
      detail: 'OpenAI API key is configured; upstream model availability requires a successful execution.',
    }
  }
  if (provider === 'gemini') {
    return {
      provider,
      state: 'CONFIGURED',
      configured: true,
      detail: 'Google Gemini API key is configured; upstream model availability requires a successful execution.',
    }
  }
  if (provider === 'groq') {
    return {
      provider,
      state: 'CONFIGURED',
      configured: true,
      detail: 'Groq API key is configured; upstream model availability requires a successful execution.',
    }
  }
  const zai = getZaiProviderStatus(env)
  if (provider === 'zai') {
    return {
      provider,
      state: 'CONFIGURED',
      configured: true,
      detail: 'ZAI configuration is present; upstream availability requires a successful execution.',
    }
  }
  if (zai.state === 'MISCONFIGURED') {
    return { provider: 'none', state: 'MISCONFIGURED', configured: false, detail: zai.detail }
  }
  return {
    provider: 'none',
    state: 'NOT_CONFIGURED',
    configured: false,
    detail:
      'No AI execution provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN, or ZAI_BASE_URL + ZAI_API_KEY on the server.',
  }
}

export function listAgentProviders(env: Environment = process.env): AgentProviderCatalogEntry[] {
  const active = resolveAgentProvider(env)
  const defs: Array<{
    kind: Exclude<AgentProviderKind, 'none'>
    name: string
    defaultModel: string
    envKeys: string[]
    configuredDetail: string
  }> = [
    {
      kind: 'ai-gateway',
      name: 'AI Gateway',
      defaultModel: 'gateway-auto',
      envKeys: ['AI_GATEWAY_BASE_URL', 'AGENTOS_GATEWAY_TOKEN'],
      configuredDetail: 'AI Gateway credentials configured (AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN).',
    },
    {
      kind: 'openrouter',
      name: 'OpenRouter',
      defaultModel: env.OPENROUTER_MODELS?.split(',')[0]?.trim() || FREE_MODEL_ROUTER,
      envKeys: ['OPENROUTER_API_KEY'],
      configuredDetail: 'OpenRouter API key configured (OPENROUTER_API_KEY).',
    },
    {
      kind: 'openai',
      name: 'OpenAI',
      defaultModel: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      envKeys: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
      configuredDetail: 'OpenAI API key configured (OPENAI_API_KEY).',
    },
    {
      kind: 'gemini',
      name: 'Google Gemini',
      defaultModel: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      envKeys: ['GEMINI_API_KEY', 'GEMINI_MODEL'],
      configuredDetail: 'Google Gemini API key configured (GEMINI_API_KEY).',
    },
    {
      kind: 'groq',
      name: 'Groq',
      defaultModel: env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
      envKeys: ['GROQ_API_KEY', 'GROQ_MODEL'],
      configuredDetail: 'Groq API key configured (GROQ_API_KEY).',
    },
    {
      kind: 'zai',
      name: 'ZAI',
      defaultModel: env.ZAI_MODEL?.trim() || 'glm-4-plus',
      envKeys: ['ZAI_BASE_URL', 'ZAI_API_KEY'],
      configuredDetail: 'ZAI credentials configured (ZAI_BASE_URL + ZAI_API_KEY).',
    },
  ]

  return defs.map((d) => {
    const configured = isProviderConfigured(d.kind, env)
    return {
      kind: d.kind,
      name: d.name,
      configured,
      active: active === d.kind,
      defaultModel: d.defaultModel,
      envKeys: d.envKeys,
      detail: configured ? d.configuredDetail : `Not configured (${d.envKeys.join(' / ')} not set).`,
    }
  })
}
