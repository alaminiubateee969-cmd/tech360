import { gatewayConfigured } from '@/lib/ai-gateway/client'
import { openRouterConfigured } from '@/lib/agents/model-provider'
import { getZaiProviderStatus } from '@/lib/ai-provider'

export type AgentProviderKind = 'ai-gateway' | 'openrouter' | 'zai' | 'none'
export type AgentProviderStatus = {
  provider: AgentProviderKind
  state: 'CONFIGURED' | 'NOT_CONFIGURED' | 'MISCONFIGURED'
  configured: boolean
  detail: string
}

type Environment = Record<string, string | undefined>

/**
 * The execution priority used by runAgent AND its diagnostics.
 * Configuration is not a provider health check: only a real execution proves
 * that the upstream accepts a request. Never include endpoint values or keys.
 */
export function resolveAgentProvider(env: Environment = process.env): AgentProviderKind {
  if (gatewayConfigured(env)) return 'ai-gateway'
  if (openRouterConfigured(env)) return 'openrouter'
  return getZaiProviderStatus(env).configured ? 'zai' : 'none'
}

export function getAgentProviderStatus(env: Environment = process.env): AgentProviderStatus {
  const provider = resolveAgentProvider(env)
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
  const zai = getZaiProviderStatus(env)
  if (zai.configured) {
    return { provider: 'zai', state: 'CONFIGURED', configured: true, detail: 'ZAI configuration is present; upstream availability requires a successful execution.' }
  }
  if (zai.state === 'MISCONFIGURED') {
    return { provider: 'none', state: 'MISCONFIGURED', configured: false, detail: zai.detail }
  }
  return {
    provider: 'none',
    state: 'NOT_CONFIGURED',
    configured: false,
    detail: 'No AI execution provider configured. Set AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN, OPENROUTER_API_KEY, or ZAI_BASE_URL + ZAI_API_KEY on the server.',
  }
}
