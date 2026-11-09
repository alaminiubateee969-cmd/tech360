'use client'

import { useEffect } from 'react'
import { PUBLIC_AGENT_TOOLS } from '@/lib/agent-tools'

/**
 * WebMCP — in-browser agent tools (progressive enhancement).
 *
 * Spec status: W3C Web Machine Learning Community Group draft
 * (`navigator.modelContext`). A native implementation shipped in Chrome 146 and
 * Edge 147 behind a flag; other browsers have none. The current surface after
 * the March 2026 revision is `registerTool()` / `unregisterTool()` —
 * `provideContext()` and `clearContext()` were removed, so this component uses
 * per-tool registration and unregisters on unmount.
 *
 * Design decisions:
 *  - Feature-detect only. `typeof navigator.modelContext?.registerTool ===
 *    'function'`. If the API is missing (the normal case today) the site behaves
 *    exactly as before — nothing is fetched, nothing throws.
 *  - `navigator.modelContext` is SecureContext-gated by the browser, so this is
 *    inert over plain HTTP and active over HTTPS (production and previews).
 *  - Tools are the same five read-only tools served by the MCP endpoint
 *    (`src/lib/agent-tools.ts`). Same validation, same data, no second copy.
 *  - Every tool is annotated `readOnlyHint: true`. None sends a message, writes a
 *    record, or reaches CRM/portal data. `open_contact_page` returns the contact
 *    URL and hands control back to the user.
 *  - Registration is additive and namespaced: a name clash replaces only our own
 *    tool, and we never touch tools registered by other scripts.
 */

type WebMcpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }
  execute: (args: Record<string, unknown>) => unknown
}

type ModelContextLike = {
  registerTool?: (tool: WebMcpTool) => unknown
  unregisterTool?: (name: string) => unknown
}

export default function WebMCPTools() {
  useEffect(() => {
    const modelContext = (navigator as Navigator & { modelContext?: ModelContextLike }).modelContext
    if (!modelContext || typeof modelContext.registerTool !== 'function') return

    const registered: string[] = []

    for (const tool of PUBLIC_AGENT_TOOLS) {
      try {
        modelContext.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
          },
          execute: (args: Record<string, unknown>) => {
            // Reject unknown keys exactly like the server transport does, so a
            // browser agent cannot smuggle arguments past validation.
            const allowed = new Set(Object.keys(tool.inputSchema.properties))
            const unexpected = Object.keys(args ?? {}).filter((key) => !allowed.has(key))
            if (unexpected.length > 0) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error (INVALID_ARGUMENT): Unknown argument(s): ${unexpected.join(', ')}`,
                  },
                ],
                isError: true,
              }
            }
            const result = tool.run(args ?? {})
            return result.ok
              ? { content: [{ type: 'text' as const, text: result.text }], isError: false }
              : {
                  content: [{ type: 'text' as const, text: `Error (${result.error.code}): ${result.error.message}` }],
                  isError: true,
                }
          },
        })
        registered.push(tool.name)
      } catch {
        // A browser that implements an older/newer shape must never break the
        // page: skip that tool and continue.
      }
    }

    return () => {
      if (typeof modelContext.unregisterTool !== 'function') return
      for (const name of registered) {
        try {
          modelContext.unregisterTool(name)
        } catch {
          /* ignore — teardown must not throw */
        }
      }
    }
  }, [])

  return null
}
