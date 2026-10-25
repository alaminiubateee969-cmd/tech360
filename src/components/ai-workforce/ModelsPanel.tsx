"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Layers, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import type { ModelProvider } from "./types";

interface Response {
  providers: ModelProvider[];
  routingPolicies: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    primaryModel: { id: string; slug: string; name: string } | null;
    fallbackModelIds: string;
    costLimitPerRequest: number | null;
    _count: { agents: number };
  }>;
  fallbackPolicies: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    strategy: string;
    maxRetries: number;
    backoffMs: number;
    _count: { agents: number };
  }>;
}

function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function ModelsPanel() {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["ai-workforce", "models"],
    queryFn: () => apiFetch<Response>("/api/ai-workforce/models"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Routing policies */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="size-4 text-primary" />
          Model Routing Policies
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.routingPolicies.map((rp) => (
            <div key={rp.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold">{rp.name}</h4>
                  <code className="text-[10px] text-muted-foreground">{rp.slug}</code>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {rp._count.agents} agents
                </Badge>
              </div>
              {rp.description && <p className="mt-1.5 text-xs text-muted-foreground">{rp.description}</p>}
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primary</span>
                  <span className="font-medium">{rp.primaryModel?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost limit</span>
                  <span className="font-medium">
                    {rp.costLimitPerRequest !== null ? `$${rp.costLimitPerRequest}/req` : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fallback policies */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Layers className="size-4 text-amber-500" />
          Fallback Policies
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.fallbackPolicies.map((fp) => (
            <div key={fp.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold">{fp.name}</h4>
                  <code className="text-[10px] text-muted-foreground">{fp.slug}</code>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {fp._count.agents} agents
                </Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Strategy</span>
                  <span className="font-medium">{fp.strategy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max retries</span>
                  <span className="font-medium">{fp.maxRetries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Backoff</span>
                  <span className="font-medium">{fp.backoffMs}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Providers & models */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Cpu className="size-4 text-violet-500" />
          Model Providers ({data.providers.length})
        </h3>
        <div className="space-y-4">
          {data.providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">{p.name}</h4>
                  <code className="text-[10px] text-muted-foreground">{p.apiBase ?? "no base url"}</code>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {p.models.length} models
                </Badge>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {p.models.map((m) => {
                  const caps = safeJson<string[]>(m.capabilities, []);
                  return (
                    <div key={m.id} className="rounded-md bg-muted/30 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{m.name}</span>
                        <Badge variant="secondary" className="text-[9px]">
                          {m.contextWindow.toLocaleString()} ctx
                        </Badge>
                      </div>
                      <code className="text-[10px] text-muted-foreground">{m.slug}</code>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {caps.map((cap) => (
                          <Badge key={cap} variant="outline" className="text-[9px]">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>in: ${m.inputCostPer1k ?? 0}/1k</span>
                        <span>out: ${m.outputCostPer1k ?? 0}/1k</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
