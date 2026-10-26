"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Play,
  Cpu,
  FileText,
  Shield,
  Wrench,
  History,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, formatRelative } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { AgentDetail as AgentDetailType } from "./types";
import { AgentExecuteDialog } from "./AgentExecuteDialog";

interface Props {
  slug: string;
}

function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function Section({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/60">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50">
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="text-[10px]">
              {count}
            </Badge>
          )}
        </span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Separator />
        <div className="p-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgentDetail({ slug }: Props) {
  const setSelectedSlug = useAppStore((s) => s.setAiWorkforceSelectedAgentSlug);
  const [execOpen, setExecOpen] = React.useState(false);

  const { data, isLoading } = useQuery<{ agent: AgentDetailType }>({
    queryKey: ["ai-workforce", "agent", slug],
    queryFn: () => apiFetch<{ agent: AgentDetailType }>(`/api/ai-workforce/agents/${slug}`),
  });

  const agent = data?.agent;

  return (
    <>
      <Sheet open={!!slug} onOpenChange={(o) => !o && setSelectedSlug(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          {isLoading || !agent ? (
            <div className="p-6">
              <Skeleton className="h-10 w-3/4 rounded-lg" />
              <Skeleton className="mt-3 h-5 w-1/2" />
              <Skeleton className="mt-6 h-40 rounded-xl" />
              <Skeleton className="mt-4 h-40 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="border-b border-border/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <SheetTitle className="text-lg">{agent.name}</SheetTitle>
                    <SheetDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                      <code className="text-[11px]">{agent.slug}</code>
                      <Badge variant="outline" className="text-[10px]">{agent.role}</Badge>
                      <Badge variant="outline" className="text-[10px]">{agent.department.name}</Badge>
                      {agent.humanApprovalRequired && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="mr-1 size-3" />
                          Approval required
                        </Badge>
                      )}
                    </SheetDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedSlug(null)}
                    className="shrink-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={() => setExecOpen(true)} className="gap-2">
                    <Play className="size-3.5" />
                    Execute Agent
                  </Button>
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
                    <Cpu className="size-3 text-muted-foreground" />
                    <code className="truncate text-[10px] text-muted-foreground">{agent.skillPath}</code>
                  </div>
                </div>
              </SheetHeader>

              {/* Body */}
              <ScrollArea className="flex-1 scrollbar-thin">
                <div className="space-y-3 p-4">
                  {/* Description */}
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-sm">{agent.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{agent.businessPurpose}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "Skills", value: agent._count.skills },
                      { label: "Prompts", value: agent._count.prompts },
                      { label: "Execs", value: agent._count.executions },
                      { label: "Perms", value: agent._count.permissions },
                      { label: "Memory", value: agent._count.memory },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-border/60 p-2 text-center">
                        <div className="text-base font-bold">{s.value}</div>
                        <div className="text-[10px] text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* System instructions */}
                  <Section icon={FileText} title="System Instructions" defaultOpen>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed scrollbar-thin">
                      {agent.systemInstructions}
                    </pre>
                  </Section>

                  {/* Responsibilities */}
                  <Section icon={GitBranch} title="Responsibilities">
                    <ul className="space-y-1.5">
                      {safeJson<string[]>(agent.responsibilities, []).map((r, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {/* Skills */}
                  <Section icon={Sparkles} title="Skills" count={agent._count.skills}>
                    <div className="space-y-1.5">
                      {agent.skills.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{s.skill.name}</div>
                            <div className="truncate text-[10px] text-muted-foreground">{s.skill.category}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{s.proficiency}</Badge>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Prompts */}
                  <Section icon={FileText} title="Prompts" count={agent.prompts.length}>
                    <div className="space-y-2">
                      {agent.prompts.slice(0, 8).map((p) => (
                        <div key={p.id} className="rounded-md border border-border/40 p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-medium">{p.slug}</span>
                            <Badge variant="outline" className="text-[10px]">{p.promptType}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.template}</p>
                        </div>
                      ))}
                      {agent.prompts.length > 8 && (
                        <p className="text-center text-[10px] text-muted-foreground">
                          +{agent.prompts.length - 8} more prompts
                        </p>
                      )}
                    </div>
                  </Section>

                  {/* Permissions */}
                  <Section icon={Shield} title="Permissions" count={agent.permissions.length}>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.permissions.map((p) => (
                        <Badge key={p.id} variant="secondary" className="text-[10px] font-mono">
                          {p.action}:{p.resource}
                        </Badge>
                      ))}
                    </div>
                  </Section>

                  {/* Tools */}
                  <Section icon={Wrench} title="Tools" count={agent.tools.length}>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.tools.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-[10px]">
                          {t.tool.name}
                          <span className="ml-1 text-muted-foreground">({t.tool.type})</span>
                        </Badge>
                      ))}
                    </div>
                  </Section>

                  {/* Policies */}
                  <Section icon={Cpu} title="Policies & Routing">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Routing</span>
                        <span className="font-medium">{agent.modelRoutingPolicy?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Primary model</span>
                        <span className="font-medium">{agent.modelRoutingPolicy?.primaryModel?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fallback</span>
                        <span className="font-medium">{agent.fallbackPolicy?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timeout</span>
                        <span className="font-medium">{agent.timeoutPolicy}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Memory</span>
                        <code className="text-[10px]">{agent.memoryPolicy}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">RAG</span>
                        <code className="text-[10px]">{agent.ragPolicy}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Safety</span>
                        <code className="text-[10px]">{agent.safetyPolicy}</code>
                      </div>
                    </div>
                  </Section>

                  {/* Recent executions */}
                  <Section icon={History} title="Recent Executions" defaultOpen={false}>
                    <RecentExecutions agentId={agent.id} />
                  </Section>

                  {/* Feedback */}
                  {agent.feedback.length > 0 && (
                    <Section icon={Sparkles} title="Feedback" count={agent.feedback.length}>
                      <div className="space-y-1.5">
                        {agent.feedback.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">{f.rating}/5</Badge>
                            <span className="text-muted-foreground">{formatRelative(f.createdAt)}</span>
                            {f.comment && <span className="truncate">— {f.comment}</span>}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Evaluations */}
                  {agent.evaluations.length > 0 && (
                    <Section icon={BarChart} title="Evaluations" count={agent.evaluations.length}>
                      <div className="space-y-2">
                        {agent.evaluations.map((ev) => (
                          <div key={ev.id} className="rounded-md border border-border/40 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{ev.name}</span>
                              <Badge variant="outline" className="text-[10px]">{ev.status}</Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {ev.metrics.map((m) => (
                                <div key={m.id} className="text-[10px]">
                                  <span className="text-muted-foreground">{m.name}: </span>
                                  <span className="font-medium">
                                    {m.value !== null ? m.value.toFixed(3) : "—"}
                                  </span>
                                  {m.target !== null && (
                                    <span className="text-muted-foreground"> / {m.target}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {agent && (
        <AgentExecuteDialog
          open={execOpen}
          onOpenChange={setExecOpen}
          agentSlug={agent.slug}
          agentName={agent.name}
        />
      )}
    </>
  );
}

function BarChart({ className }: { className?: string }) {
  return <History className={className} />;
}

function RecentExecutions({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery<{ recentExecutions: Array<{ id: string; status: string; durationMs: number | null; modelUsed: string | null; startedAt: string }> }>({
    queryKey: ["ai-workforce", "agent", agentId, "executions"],
    queryFn: () => apiFetch(`/api/ai-workforce/agents/${agentId}`),
    enabled: !!agentId,
  });
  // Note: this fetches the agent again to get recentExecutions; the parent already
  // has it but we keep this simple. To avoid double-fetch we could pass it down.
  void agentId;
  if (isLoading) return <Skeleton className="h-20 rounded-md" />;
  const execs = data?.recentExecutions ?? [];
  if (!execs.length) return <p className="text-xs text-muted-foreground">No executions yet.</p>;
  return (
    <div className="space-y-1.5">
      {execs.map((e) => (
        <div key={e.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
          <Badge
            variant="secondary"
            className={
              e.status === "SUCCESS"
                ? "text-[10px] text-emerald-600 dark:text-emerald-400"
                : e.status === "FAILED"
                ? "text-[10px] text-red-600 dark:text-red-400"
                : "text-[10px]"
            }
          >
            {e.status}
          </Badge>
          <span className="text-muted-foreground">{e.durationMs ?? 0}ms</span>
          <span className="font-mono text-[10px]">{e.modelUsed ?? "—"}</span>
          <span className="text-muted-foreground">{formatRelative(e.startedAt)}</span>
        </div>
      ))}
    </div>
  );
}
