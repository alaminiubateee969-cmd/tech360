/** Discovery entries, not promises of free availability. No credentials belong here. */
export const AI_SERVICES = [
  { name: 'OpenRouter', category: 'Chat / reasoning / coding', mode: 'Integrated: live zero-price catalog and chat', url: 'https://openrouter.ai', setup: 'Set OPENROUTER_API_KEY on the server. Free routes have quotas; no paid fallback.' },
  { name: 'OpenAI API', category: 'Chat / reasoning / coding / vision', mode: 'Integrated: direct OpenAI API adapter for AI agents', url: 'https://platform.openai.com', setup: 'Set OPENAI_API_KEY (and optional OPENAI_MODEL, OPENAI_BASE_URL) on the server.' },
  { name: 'Google AI Studio (Gemini)', category: 'Chat / vision / embeddings', mode: 'Integrated: direct Google Gemini API adapter for AI agents', url: 'https://aistudio.google.com', setup: 'Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY (and optional GEMINI_MODEL) on the server.' },
  { name: 'Groq', category: 'Chat / fast inference / speech recognition', mode: 'Integrated: direct Groq API adapter for AI agents', url: 'https://console.groq.com', setup: 'Set GROQ_API_KEY (and optional GROQ_MODEL) on the server.' },
  { name: 'Ollama / LM Studio', category: 'Local chat / vision / embeddings', mode: 'Ollama supported by existing private model router', url: 'https://github.com/ollama/ollama', setup: 'Configure LOCAL_MODEL_BASE_URL and install compatible weights. Hardware and electricity are not free.' },
  ...[
    ['Cerebras', 'Chat / coding', 'https://cloud.cerebras.ai'],
    ['GitHub Models', 'Chat / coding', 'https://github.com/marketplace/models'],
    ['Cloudflare Workers AI', 'Chat / images / speech / embeddings', 'https://developers.cloudflare.com/workers-ai/'],
    ['Mistral', 'Chat / coding / vision', 'https://console.mistral.ai'],
    ['Hugging Face', 'Models / images / audio', 'https://huggingface.co'],
    ['SambaNova', 'Chat / reasoning', 'https://cloud.sambanova.ai'],
    ['NVIDIA NIM', 'Chat / vision / embeddings', 'https://build.nvidia.com'],
    ['Pollinations', 'Images / text', 'https://pollinations.ai'],
    ['Whisper / faster-whisper', 'Local speech recognition', 'https://github.com/SYSTRAN/faster-whisper'],
    ['Piper', 'Local text-to-speech', 'https://github.com/OHF-Voice/piper1-gpl'],
    ['ComfyUI', 'Local image generation', 'https://github.com/Comfy-Org/ComfyUI'],
    ['Tavily / Brave / Exa', 'Search / research', 'https://tavily.com'],
    ['Chroma / Qdrant', 'Local vector memory', 'https://github.com/chroma-core/chroma'],
    ['LangGraph / smolagents', 'Agent orchestration', 'https://github.com/langchain-ai/langgraph'],
    ['n8n / Dify / Flowise', 'Self-hosted workflows', 'https://github.com/n8n-io/n8n'],
  ].map(([name, category, url]) => ({ name, category, url, mode: 'Setup reference — not connected', setup: 'Check current pricing, quotas, region availability, licenses and data handling before use. Trials are not permanent free services.' })),
]

export type FreeModel = { id: string; name: string }
export function parseFreeModels(payload: unknown): FreeModel[] {
  const data = (payload as { data?: unknown })?.data
  if (!Array.isArray(data)) throw new Error('Invalid model catalog')
  return data.filter((m) => typeof m?.id === 'string' && m.id.endsWith(':free') &&
    m.pricing?.prompt != null && m.pricing?.completion != null &&
    Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    .map((m) => ({ id: m.id, name: typeof m.name === 'string' ? m.name : m.id }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function fetchFreeModels(): Promise<FreeModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error' })
  if (!response.ok) throw new Error('Model catalog unavailable')
  return parseFreeModels(await response.json())
}
