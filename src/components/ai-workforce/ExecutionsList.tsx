"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch, formatRelative } from "@/lib/api";
import type { ExecutionSummary } from "./types";
import { ExecutionDetail } from "./ExecutionDetail";

interface Response {
  executions: ExecutionSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-emerald-600 dark:text-emerald-400",
  FAILED: "text-red-600 dark:text-red-400",
  RUNNING: "text-blue-600 dark:text-blue-400",
  TIMEOUT: "text-amber-600 dark:text-amber-400",
};

export function ExecutionsList() {
  const [page, setPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const pageSize = 50;

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["ai-workforce", "executions", params.toString()],
    queryFn: () => apiFetch<Response>(`/api/ai-workforce/executions?${params.toString()}`),
  });

  const execs = data?.executions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="size-4 text-primary" />
        Recent Executions
        {data && (
          <Badge variant="secondary" className="text-[10px]">
            {data.pagination.total} total
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="grid grid-cols-[1fr_1fr_90px_110px_120px_90px] gap-2 border-b border-border/60 bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Agent</span>
          <span>Department</span>
          <span>Status</span>
          <span>Model</span>
          <span>When</span>
          <span className="text-right">Duration</span>
        </div>
        {isLoading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : execs.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No executions yet. Run an agent from the Registry to see it here.
          </div>
        ) : (
          <div className="max-h-[70vh] divide-y divide-border/40 overflow-y-auto scrollbar-thin">
            {execs.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="grid w-full grid-cols-[1fr_1fr_90px_110px_120px_90px] items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.agent.name}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">{e.agent.slug}</div>
                </div>
                <span className="truncate text-muted-foreground">{e.agent.department?.name ?? "—"}</span>
                <Badge variant="secondary" className={`w-fit text-[10px] ${STATUS_COLOR[e.status] ?? ""}`}>
                  {e.status}
                </Badge>
                <span className="truncate font-mono text-[10px]">{e.modelUsed ?? "—"}</span>
                <span className="text-muted-foreground">{formatRelative(e.startedAt)}</span>
                <span className="text-right tabular-nums">{e.durationMs ?? 0}ms</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page >= data.pagination.totalPages}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {selectedId && <ExecutionDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
