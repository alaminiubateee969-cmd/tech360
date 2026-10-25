"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Play,
  Zap,
  Bot,
  GitBranch,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
  Webhook,
  Clock,
  Settings2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiFetch, formatRelative } from "@/lib/api";

interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  triggerConfig: string;
  nodes: string;
  edges: string;
  active: boolean;
  lastRunAt: string | null;
  createdAt: string;
  _count: { runs: number };
}

const NODE_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  trigger: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/12" },
  agent: { icon: Bot, color: "text-violet-500", bg: "bg-violet-500/12" },
  condition: { icon: GitBranch, color: "text-sky-500", bg: "bg-sky-500/12" },
  action: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/12" },
  approval: { icon: Settings2, color: "text-rose-500", bg: "bg-rose-500/12" },
};

export function WorkflowsList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ workflows: Workflow[] }>({
    queryKey: ["workflows"],
    queryFn: () => apiFetch<{ workflows: Workflow[] }>("/api/workflows"),
  });

  const [active, setActive] = React.useState<Record<string, boolean>>({});
  const [running, setRunning] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (data?.workflows) {
      const map: Record<string, boolean> = {};
      for (const w of data.workflows) map[w.id] = w.active;
      setActive(map);
    }
  }, [data]);

  function toggle(id: string) {
    setActive((a) => ({ ...a, [id]: !a[id] }));
    toast.success(`Workflow ${active[id] ? "paused" : "activated"}.`);
  }

  async function run(id: string) {
    setRunning((r) => ({ ...r, [id]: true }));
    try {
      const res = await apiFetch<{ logs: string }>(`/api/workflows/${id}/run`, {
        method: "POST",
      });
      toast.success("Workflow executed.", {
        description: res.logs.split("\n").slice(-2).join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["workflows"] });
    } catch {
      toast.error("Workflow run failed.");
    } finally {
      setRunning((r) => ({ ...r, [id]: false }));
    }
  }

  const workflows = data?.workflows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {workflows.length} workflows · {Object.values(active).filter(Boolean).length} active
        </p>
        <Button variant="outline" className="gap-2" onClick={() => toast.info("Workflow Builder opening (mock).")}>
          <Plus className="size-4" />
          New workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((w, idx) => {
            let nodes: Array<{ id: string; type: string; label: string }> = [];
            let edges: Array<{ from: string; to: string; label?: string }> = [];
            try {
              nodes = JSON.parse(w.nodes);
              edges = JSON.parse(w.edges);
            } catch {
              // ignore
            }
            const isOn = !!active[w.id];
            const isRunning = !!running[w.id];

            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{w.name}</h3>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {w.triggerType}
                        </Badge>
                        {isOn ? (
                          <Badge className="bg-emerald-500/12 text-emerald-500">
                            <span className="mr-1 size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {w._count.runs} runs · last run{" "}
                        {w.lastRunAt ? formatRelative(w.lastRunAt) : "never"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Switch checked={isOn} onCheckedChange={() => toggle(w.id)} />
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => run(w.id)}
                        disabled={isRunning || !isOn}
                      >
                        <Play className="size-3.5" />
                        {isRunning ? "Running..." : "Run"}
                      </Button>
                    </div>
                  </div>

                  {/* Node visualization */}
                  <div className="border-t border-border/60 bg-card/30 p-4">
                    <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                      {nodes.map((n, i) => {
                        const style = NODE_STYLE[n.type] ?? NODE_STYLE.action;
                        const Icon = style.icon;
                        return (
                          <React.Fragment key={n.id}>
                            <div className={`flex items-center gap-2 rounded-lg ${style.bg} ${style.color} px-3 py-2 text-xs font-medium`}>
                              <Icon className="size-3.5" />
                              <span className="whitespace-nowrap">{n.label}</span>
                            </div>
                            {i < nodes.length - 1 && (
                              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {edges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {edges.filter((e) => e.label).map((e, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            <Circle className="size-2" />
                            {e.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Workflow Builder mock */}
      <Card className="border-dashed p-6">
        <div className="flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Webhook className="size-5" />
          </div>
          <h3 className="mt-3 font-semibold">Visual Workflow Builder</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Drag-and-drop node editor for triggers, agents, conditions, and actions.
            Coming online in the next release — for now, configure workflows via the API.
          </p>
          <Button variant="outline" className="mt-4 gap-2" disabled>
            <Clock className="size-4" />
            Builder preview
          </Button>
        </div>
      </Card>
    </div>
  );
}
