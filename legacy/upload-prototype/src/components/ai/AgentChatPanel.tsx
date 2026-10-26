"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  X,
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  Cpu,
  Sparkles,
  History,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { apiFetch } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  skillPath: string;
  lastAction: string | null;
  config: string;
  _count: { runs: number };
}

interface RunRecord {
  id: string;
  input: string;
  output: string | null;
  status: string;
  durationMs: number;
  createdAt: string;
}

interface AgentRunResponse {
  run: RunRecord;
  agent: Agent;
  output: string;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  durationMs?: number;
}

// Sample suggested prompts per agent role.
const SUGGESTIONS: Record<string, string[]> = {
  "CEO Strategist": [
    "Draft a Q4 expansion memo",
    "What are our top 3 priorities this month?",
  ],
  "CRM Manager": [
    "Summarize today's lead activity",
    "Which leads are stale for >48h?",
  ],
  "WhatsApp Agent": [
    "Reply to Imran's last message",
    "Summarize open WhatsApp threads",
  ],
  "Scope Builder": [
    "Build a scope for Dhaka Eats MVP",
    "Estimate a 12-week LMS engagement",
  ],
};

export function AgentChatPanel() {
  const { aiSelectedAgentId, setAiSelectedAgentId } = useAppStore();
  const qc = useQueryClient();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const open = !!aiSelectedAgentId;

  const { data: agentData, isLoading } = useQuery<{ agents: Agent[] }>({
    queryKey: ["agents"],
    queryFn: () => apiFetch<{ agents: Agent[] }>("/api/agents"),
    enabled: open,
  });

  const agent = agentData?.agents.find((a) => a.id === aiSelectedAgentId) ?? null;

  // Reset conversation when agent changes.
  React.useEffect(() => {
    setMessages([]);
    setInput("");
  }, [aiSelectedAgentId]);

  // Auto-scroll.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !agent) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    // Add optimistic placeholder.
    const placeholderId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: placeholderId, role: "agent", content: "__loading__" },
    ]);

    try {
      const res = await apiFetch<AgentRunResponse>(`/api/agents/${agent.id}/run`, {
        method: "POST",
        body: JSON.stringify({ input: content }),
      });
      setMessages((m) =>
        m
          .filter((msg) => msg.id !== placeholderId)
          .concat({
            id: res.run.id,
            role: "agent",
            content: res.output,
            durationMs: res.run.durationMs,
          })
      );
      qc.invalidateQueries({ queryKey: ["agents"] });
    } catch {
      setMessages((m) =>
        m
          .filter((msg) => msg.id !== placeholderId)
          .concat({
            id: crypto.randomUUID(),
            role: "agent",
            content: "⚠️ Agent failed to respond. Please try again.",
          })
      );
      toast.error("Agent invocation failed.");
    } finally {
      setSending(false);
    }
  }

  const suggestions = agent ? SUGGESTIONS[agent.name] ?? [] : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setAiSelectedAgentId(null)}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {isLoading || !agent ? (
          <div className="p-6">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="mt-4 h-64 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="border-b border-border/60 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="relative grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
                    <Bot className="size-5" />
                    <span
                      className={
                        "absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-background " +
                        (agent.status === "ONLINE"
                          ? "bg-emerald-500"
                          : agent.status === "BUSY"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-muted-foreground/40")
                      }
                    />
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{agent.name}</SheetTitle>
                    <SheetDescription className="text-xs">
                      {agent.role} · {agent.status}
                    </SheetDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAiSelectedAgentId(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Skill path */}
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                <Cpu className="size-3.5 shrink-0 text-muted-foreground" />
                <code className="truncate text-[11px] text-muted-foreground">
                  {agent.skillPath}
                </code>
              </div>
            </SheetHeader>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Sparkles className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.name} is ready.</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={"flex gap-3 " + (m.role === "user" ? "flex-row-reverse" : "")}
                >
                  <div
                    className={
                      "grid size-8 shrink-0 place-items-center rounded-full " +
                      (m.role === "user"
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {m.role === "user" ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
                  </div>
                  <div
                    className={
                      "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm " +
                      (m.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-muted")
                    }
                  >
                    {m.content === "__loading__" ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Thinking...
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    {m.durationMs !== undefined && m.content !== "__loading__" && (
                      <p className="mt-1 text-[10px] opacity-60">
                        {m.durationMs}ms · via AgentOS skill
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border/60 p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  placeholder={`Message ${agent.name}...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={sending}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <History className="size-3" />
                  {agent._count.runs} historical runs
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  gpt-4o · temp 0.4
                </Badge>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
