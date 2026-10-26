"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal as TerminalIcon,
  Loader2,
  CornerDownLeft,
  Cpu,
  Route,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  role: string;
  skillPath: string;
  status: string;
}

interface TerminalLine {
  id: string;
  kind: "user" | "agent" | "system" | "error";
  text: string;
  skillPath?: string;
  agentName?: string;
  durationMs?: number;
}

const SAMPLE_COMMANDS = [
  "Find all leads from this week",
  "Generate a scope for project Apex",
  "Reply to Imran's WhatsApp",
  "Audit SEO on /pricing",
  "Schedule a follow-up call with BrightPath",
];

export function AITerminal() {
  const qc = useQueryClient();
  const [lines, setLines] = React.useState<TerminalLine[]>([
    {
      id: "boot",
      kind: "system",
      text: "Tech360 AI Terminal · type a natural-language command. Try: 'find leads from this week', 'generate scope for project X', 'reply to WhatsApp'.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: agentData } = useQuery<{ agents: Agent[] }>({
    queryKey: ["agents"],
    queryFn: () => apiFetch<{ agents: Agent[] }>("/api/agents"),
  });

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, busy]);

  // Inline copy of the routing rules to mirror the server-side router.
  function routeLocal(text: string): { agent: Agent; skill: string } | null {
    const lower = text.toLowerCase();
    const rules: Array<{ keys: string[]; name: string }> = [
      { keys: ["lead", "pipeline", "score", "crm"], name: "CRM Manager" },
      { keys: ["whatsapp", "wa ", "chat", "message"], name: "WhatsApp Agent" },
      { keys: ["scope", "sow", "deliverable"], name: "Scope Builder" },
      { keys: ["legal", "contract", "clause"], name: "Legal Reviewer" },
      { keys: ["payment", "invoice", "verify", "reconcile"], name: "Payment Verifier" },
      { keys: ["meeting", "schedule", "book", "calendar"], name: "Meeting Scheduler" },
      { keys: ["content", "blog", "copy", "write"], name: "Content Writer" },
      { keys: ["social", "facebook", "instagram", "linkedin", "twitter", "post"], name: "Social Media Manager" },
      { keys: ["brand", "logo", "design", "visual"], name: "Brand Designer" },
      { keys: ["video", "reel", "edit", "youtube"], name: "Video Producer" },
      { keys: ["knowledge", "kb", "article", "docs"], name: "Knowledge Curator" },
      { keys: ["memory", "context", "history"], name: "Memory Keeper" },
      { keys: ["email", "smtp", "follow-up"], name: "Email Composer" },
      { keys: ["seo", "search", "ranking", "meta"], name: "SEO Optimizer" },
      { keys: ["error", "incident", "bug", "log"], name: "Error Monitor" },
      { keys: ["approval", "sign-off", "review"], name: "Approval Gatekeeper" },
      { keys: ["analytics", "insight", "report", "metric"], name: "Analytics Insights" },
      { keys: ["success", "nps", "churn", "renewal"], name: "Client Success" },
      { keys: ["strategy", "okr", "plan", "memo", "ceo"], name: "CEO Strategist" },
      { keys: ["evidence", "delivery proof", "snapshot"], name: "Evidence Tracker" },
    ];
    const agents = agentData?.agents ?? [];
    for (const r of rules) {
      if (r.keys.some((k) => lower.includes(k))) {
        const a = agents.find((x) => x.name === r.name);
        if (a) return { agent: a, skill: a.skillPath };
      }
    }
    return null;
  }

  async function run(cmd: string) {
    const text = cmd.trim();
    if (!text) return;
    setLines((l) => [...l, { id: crypto.randomUUID(), kind: "user", text }]);
    setInput("");
    setBusy(true);

    const route = routeLocal(text);
    if (!route) {
      // Fix the original Tech360 bug — deterministic, friendly fallback.
      setLines((l) => [
        ...l,
        {
          id: crypto.randomUUID(),
          kind: "error",
          text: `Ambiguous command. Could not match "${text}" to an agent. Try one of: ${SAMPLE_COMMANDS.join(" · ")}`,
        },
      ]);
      setBusy(false);
      return;
    }

    setLines((l) => [
      ...l,
      {
        id: crypto.randomUUID(),
        kind: "system",
        text: `Routing to ${route.agent.name}...`,
        skillPath: route.skill,
      },
    ]);

    try {
      const res = await apiFetch<{ output: string; run: { durationMs: number } }>(
        `/api/agents/${route.agent.id}/run`,
        { method: "POST", body: JSON.stringify({ input: text }) }
      );
      setLines((l) => [
        ...l,
        {
          id: crypto.randomUUID(),
          kind: "agent",
          text: res.output,
          agentName: route.agent.name,
          durationMs: res.run.durationMs,
        },
      ]);
      qc.invalidateQueries({ queryKey: ["agents"] });
    } catch {
      setLines((l) => [
        ...l,
        { id: crypto.randomUUID(), kind: "error", text: "Agent invocation failed." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden border-border/60 bg-[oklch(0.08_0.005_240)]">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TerminalIcon className="size-4 text-emerald-500" />
          AI Terminal
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            online
          </span>
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-muted-foreground sm:flex">
          <Route className="size-3" />
          {agentData?.agents.length ?? 20} agents available
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="h-72 space-y-2 overflow-y-auto scrollbar-thin p-4 font-mono text-xs leading-relaxed"
      >
        <AnimatePresence initial={false}>
          {lines.map((l) => {
            const color =
              l.kind === "user"
                ? "text-amber-400"
                : l.kind === "agent"
                ? "text-emerald-300"
                : l.kind === "error"
                ? "text-rose-400"
                : "text-muted-foreground";
            const prefix =
              l.kind === "user"
                ? "$"
                : l.kind === "agent"
                ? "◆"
                : l.kind === "error"
                ? "✕"
                : "›";
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${color} whitespace-pre-wrap break-words`}
              >
                <span className="mr-2 opacity-60">{prefix}</span>
                {l.text}
                {l.skillPath && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-violet-400">
                    <Cpu className="size-3" />
                    skill: {l.skillPath}
                  </div>
                )}
                {l.agentName && l.durationMs !== undefined && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    — {l.agentName} · {l.durationMs}ms
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Processing...
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        className="flex items-center gap-2 border-t border-border/60 p-2"
      >
        <span className="pl-2 font-mono text-sm text-emerald-500">$</span>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command..."
          className="border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
          disabled={busy}
        />
        <Button type="submit" size="sm" disabled={busy || !input.trim()} className="gap-1.5">
          <CornerDownLeft className="size-3.5" />
          Run
        </Button>
      </form>

      {/* Suggested commands */}
      <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-card/40 p-2">
        {SAMPLE_COMMANDS.map((c) => (
          <button
            key={c}
            onClick={() => run(c)}
            disabled={busy}
            className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/60 bg-amber-500/8 px-3 py-1.5 text-[10px] text-amber-500">
        <AlertCircle className="size-3" />
        Bug fix: ambiguous commands now route deterministically instead of returning a 500.
      </div>
    </Card>
  );
}
