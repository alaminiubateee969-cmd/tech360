"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Building2,
  Loader2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AgentSummary, Department } from "./types";
import { AgentDetail } from "./AgentDetail";

interface AgentsResponse {
  agents: AgentSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 50;

export function AgentRegistry() {
  const [search, setSearch] = React.useState("");
  const [deptId, setDeptId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [showAllDepts, setShowAllDepts] = React.useState(false);
  const selectedSlug = useAppStore((s) => s.aiWorkforceSelectedAgentSlug);
  const setSelectedSlug = useAppStore((s) => s.setAiWorkforceSelectedAgentSlug);

  const debouncedSearch = React.useDeferredValue(search);

  // Reset page when filters change.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, deptId, role, status]);

  const { data: deptData, isLoading: deptLoading } = useQuery<{ departments: Department[] }>({
    queryKey: ["ai-workforce", "departments"],
    queryFn: () => apiFetch<{ departments: Department[] }>("/api/ai-workforce/departments"),
  });

  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (deptId) queryParams.set("department", deptId);
  if (role) queryParams.set("role", role);
  if (status) queryParams.set("status", status);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);

  const { data, isLoading } = useQuery<AgentsResponse>({
    queryKey: ["ai-workforce", "agents", queryParams.toString()],
    queryFn: () => apiFetch<AgentsResponse>(`/api/ai-workforce/agents?${queryParams.toString()}`),
  });

  const departments = deptData?.departments ?? [];
  const visibleDepts = showAllDepts ? departments : departments.slice(0, 20);

  const roles = React.useMemo(() => {
    const set = new Set<string>();
    data?.agents.forEach((a) => set.add(a.role));
    return Array.from(set).sort();
  }, [data]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      {/* Department sidebar */}
      <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)]">
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-muted-foreground" />
              Departments
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {departments.length}
            </Badge>
          </div>
          <ScrollArea className="max-h-[60vh] lg:max-h-[calc(100vh-16rem)] pr-2">
            <div className="space-y-0.5">
              <button
                onClick={() => setDeptId(null)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                  !deptId ? "bg-primary/12 text-primary" : "hover:bg-muted"
                )}
              >
                <span className="font-medium">All departments</span>
              </button>
              {deptLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-md" />
                  ))
                : visibleDepts.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDeptId(d.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                        deptId === d.id ? "bg-primary/12 text-primary" : "hover:bg-muted"
                      )}
                      title={d.name}
                    >
                      <span className="truncate font-medium">{d.name}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                        {d._count.agents}
                      </Badge>
                    </button>
                  ))}
            </div>
            {!showAllDepts && departments.length > 20 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setShowAllDepts(true)}
              >
                Show all {departments.length}
              </Button>
            )}
            {showAllDepts && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setShowAllDepts(false)}
              >
                Show top 20
              </Button>
            )}
          </ScrollArea>
        </div>
      </aside>

      {/* Agents main area */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents by name, slug, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Any status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isLoading ? (
              "Loading…"
            ) : (
              <>
                <span className="font-semibold text-foreground">{data?.pagination.total ?? 0}</span> agents
                {deptId && ` in ${departments.find((d) => d.id === deptId)?.name ?? ""}`}
              </>
            )}
          </span>
          {data && data.pagination.totalPages > 1 && (
            <span>
              Page {page} of {data.pagination.totalPages}
            </span>
          )}
        </div>

        {/* Agent grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : data && data.agents.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {data.agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedSlug(agent.slug)}
                className="group flex flex-col rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold group-hover:text-primary">
                      {agent.name}
                    </h4>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {agent.slug}
                    </p>
                  </div>
                  {agent.humanApprovalRequired && (
                    <ShieldAlert className="size-4 shrink-0 text-amber-500" />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {agent.role}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={
                      agent.status === "ACTIVE"
                        ? "text-[10px] text-emerald-600 dark:text-emerald-400"
                        : "text-[10px]"
                    }
                  >
                    {agent.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {agent.department.name}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{agent._count.skills} skills</span>
                  <span>{agent._count.prompts} prompts</span>
                  <span>{agent._count.executions} runs</span>
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
            <p className="text-sm text-muted-foreground">No agents match your filters.</p>
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Prev
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
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedSlug && <AgentDetail slug={selectedSlug} />}
    </div>
  );
}
