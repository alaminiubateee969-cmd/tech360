"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import type { SkillSummary } from "./types";

interface SkillsResponse {
  skills: SkillSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 50;

export function SkillsBrowser() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);

  const debouncedSearch = React.useDeferredValue(search);
  React.useEffect(() => setPage(1), [debouncedSearch, category]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (category) params.set("category", category);

  const { data, isLoading } = useQuery<SkillsResponse>({
    queryKey: ["ai-workforce", "skills", params.toString()],
    queryFn: () => apiFetch<SkillsResponse>(`/api/ai-workforce/skills?${params.toString()}`),
  });

  const skills = data?.skills ?? [];

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => set.add(s.category));
    return Array.from(set).sort();
  }, [skills]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-violet-500" />
        Skills Browser
        {data && (
          <Badge variant="secondary" className="text-[10px]">
            {data.pagination.total.toLocaleString()} total
          </Badge>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
          <p className="text-sm text-muted-foreground">No skills match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSlug(s.slug)}
              className="group flex flex-col rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold group-hover:text-primary">{s.name}</h4>
                  <code className="text-[10px] text-muted-foreground">{s.slug}</code>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  <Users className="mr-1 size-3" />
                  {s._count.agents}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{s.description}</p>
              <Badge variant="secondary" className="mt-2 w-fit text-[9px]">
                {s.category}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* Skill detail */}
      {selectedSlug && <SkillDetail slug={selectedSlug} onClose={() => setSelectedSlug(null)} />}
    </div>
  );
}

interface SkillDetailData {
  skill: SkillSummary & {
    instructions: string;
    inputSchema: string;
    outputSchema: string;
    versions: Array<{ id: string; version: number; changelog: string | null; createdAt: string }>;
    tests: Array<{ id: string; name: string; lastResult: string | null }>;
  };
  agents: Array<{
    id: string;
    proficiency: string;
    agent: {
      id: string;
      slug: string;
      name: string;
      role: string;
      department: { slug: string; name: string } | null;
    };
  }>;
}

function SkillDetail({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<SkillDetailData>({
    queryKey: ["ai-workforce", "skill", slug],
    queryFn: () => apiFetch<SkillDetailData>(`/api/ai-workforce/skills/${slug}`),
  });

  return (
    <Sheet open={!!slug} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle className="text-base">{data?.skill.name ?? slug}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-1.5">
            <code className="text-[10px]">{slug}</code>
            {data && <Badge variant="outline" className="text-[10px]">{data.skill.category}</Badge>}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 scrollbar-thin">
          {isLoading || !data ? (
            <div className="p-6">
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <h4 className="mb-1 text-xs font-semibold">Description</h4>
                <p className="text-xs">{data.skill.description}</p>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold">Instructions</h4>
                <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">
                  {data.skill.instructions}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold">Agents with this skill ({data.agents.length})</h4>
                <div className="max-h-72 space-y-1.5 overflow-y-auto scrollbar-thin">
                  {data.agents.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{a.agent.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {a.agent.department?.name} · {a.agent.role}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{a.proficiency}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
