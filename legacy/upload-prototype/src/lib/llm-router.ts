/**
 * Real LLM dispatcher.
 *
 * `callLLM(systemPrompt, userPrompt, options)` calls the LLM that the
 * runtime environment actually supports:
 *
 *   1. If `OPENAI_API_KEY` is set → use the OpenAI SDK with `AI_MODEL`
 *      (default gpt-4o-mini). Real token usage comes from the response.
 *   2. Else if `z-ai-web-dev-sdk` is importable → use it (sandbox).
 *      Tokens are estimated honestly as ceil(len/4).
 *   3. Else → deterministic templated fallback (no API call at all).
 *
 * The return value tells the caller exactly which model was used so
 * that AITaskExecution.modelUsed reflects reality.
 */

import OpenAI from "openai";

export interface LLMCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Some agents wire their routing policy's preferred model slug in.
  preferredModelSlug?: string;
}

export interface LLMCallResult {
  content: string;
  modelUsed: string;
  provider: "openai" | "zai" | "deterministic";
  tokenInput: number;
  tokenOutput: number;
  finishReason: string | null;
  durationMs: number;
}

/** Real cost-per-1M-token table for known models (USD). */
const COST_TABLE: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4-turbo": { in: 10, out: 30 },
  "o1-mini": { in: 3, out: 12 },
  "claude-3-5-sonnet": { in: 3, out: 15 },
  "claude-3-opus": { in: 15, out: 75 },
  "claude-3-haiku": { in: 0.25, out: 1.25 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "glm-4": { in: 0.5, out: 1.5 },
  "glm-4-flash": { in: 0.1, out: 0.2 },
  "glm-4v": { in: 0.6, out: 1.8 },
};

export function estimateCostUsd(model: string, inTokens: number, outTokens: number): number {
  const c = COST_TABLE[model] ?? { in: 0.5, out: 1.5 };
  return Number((((inTokens * c.in) + (outTokens * c.out)) / 1_000_000).toFixed(6));
}

export function estimateTokens(text: string): number {
  // Honest ~4 chars/token estimate (no Math.random).
  return Math.max(1, Math.ceil(text.length / 4));
}

// ----- OpenAI client (lazy singleton) -----
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

// ----- Z.AI SDK (sandbox fallback) -----
type ZaiClient = {
  chat: {
    completions: {
      create: (args: {
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_tokens?: number;
        thinking?: { type: string };
      }) => Promise<{
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      }>;
    };
  };
};
let zaiPromise: Promise<ZaiClient | null> | null = null;
function getZai(): Promise<ZaiClient | null> {
  if (zaiPromise) return zaiPromise;
  zaiPromise = (async () => {
    try {
      // @ts-expect-error — z-ai-web-dev-sdk has no bundled types here
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      return zai as ZaiClient;
    } catch {
      return null;
    }
  })();
  return zaiPromise;
}

/** Determine the actual model slug we will try first. */
function resolveModelSlug(preferred?: string): string {
  if (preferred && COST_TABLE[preferred]) return preferred;
  return process.env.AI_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * Real LLM call with three-tier fallback.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: LLMCallOptions = {}
): Promise<LLMCallResult> {
  const start = Date.now();
  const requestedModel = resolveModelSlug(options.preferredModelSlug);
  const temperature = options.temperature ?? 0.4;
  const maxTokens = options.maxTokens ?? 4096;

  // --- Tier 1: real OpenAI ---
  const openai = getOpenAI();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: requestedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      const content = completion.choices?.[0]?.message?.content ?? "";
      const finishReason = completion.choices?.[0]?.finish_reason ?? null;
      const usage = completion.usage;
      const tokenInput = usage?.prompt_tokens ?? estimateTokens(systemPrompt + userPrompt);
      const tokenOutput = usage?.completion_tokens ?? estimateTokens(content);
      if (content) {
        return {
          content,
          modelUsed: requestedModel,
          provider: "openai",
          tokenInput,
          tokenOutput,
          finishReason,
          durationMs: Date.now() - start,
        };
      }
    } catch (e) {
      // Fall through to ZAI / deterministic — but record the failure
      // upstream via the executor's logging.
      console.warn(`[llm] OpenAI call failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  // --- Tier 2: Z.AI SDK (sandbox) ---
  const zai = await getZai();
  if (zai) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        thinking: { type: "disabled" },
      });
      const content = completion.choices?.[0]?.message?.content ?? "";
      if (content) {
        return {
          content,
          modelUsed: "glm-4-flash",
          provider: "zai",
          tokenInput: estimateTokens(systemPrompt + userPrompt),
          tokenOutput: estimateTokens(content),
          finishReason: completion.choices?.[0]?.finish_reason ?? null,
          durationMs: Date.now() - start,
        };
      }
    } catch (e) {
      console.warn(`[llm] Z.AI call failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  // --- Tier 3: deterministic fallback ---
  return {
    content: deterministicFallback(systemPrompt, userPrompt),
    modelUsed: "deterministic-fallback",
    provider: "deterministic",
    tokenInput: estimateTokens(systemPrompt + userPrompt),
    tokenOutput: estimateTokens(userPrompt) + 32,
    finishReason: "stop",
    durationMs: Date.now() - start,
  };
}

/**
 * Honest deterministic fallback. Produces a small structured JSON
 * summary that mirrors what an LLM would return — no randomness,
 * no fake content. The caller should not pretend this is a real LLM
 * output (and `modelUsed` will say "deterministic-fallback").
 */
function deterministicFallback(systemPrompt: string, userPrompt: string): string {
  const role =
    /you are (an? )?([\w\- ]+?)[\.,]/i.exec(systemPrompt)?.[2]?.trim() ?? "agent";
  const roleTitle = role.split(/[\s\-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const summary =
    userPrompt.length > 240
      ? `${roleTitle} analysed the provided request (length ${userPrompt.length} chars) and produced a deterministic structured response because no LLM provider was available.`
      : `${roleTitle} analysed the request and produced a deterministic structured response.`;
  return JSON.stringify(
    {
      summary,
      actions: [
        "Parsed the request against the agent's operating principles.",
        "Applied the documented standard operating procedure.",
        "Returned a structured result without invoking a remote LLM.",
      ],
      nextSteps: [
        "If a real LLM response is required, set OPENAI_API_KEY in the environment.",
        "Otherwise, route the request through a workflow that captures this output as a draft.",
      ],
      _meta: {
        fallback: true,
        model: "deterministic-fallback",
        note: "No LLM provider was available. This output is deterministic, not generated.",
      },
    },
    null,
    2
  );
}

// ----- Embeddings (RAG) -----

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: "openai" | "none";
}

/**
 * Real OpenAI embeddings when OPENAI_API_KEY is set. Returns null
 * otherwise — the caller must then fall back to keyword search.
 */
export async function embedText(text: string): Promise<EmbeddingResult | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const vec = res.data?.[0]?.embedding;
    if (!vec || !Array.isArray(vec)) return null;
    return { embedding: vec as number[], model: "text-embedding-3-small", provider: "openai" };
  } catch (e) {
    console.warn(`[llm] embeddings call failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
