"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Calendar, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiFetch, formatMoney, formatDate } from "@/lib/api";
import { StatusBadge } from "../shared/StatusBadge";

interface CrmData {
  projects: Array<{
    id: string;
    name: string;
    clientId: string | null;
    scope: string | null;
    status: string;
    budget: number;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    _count: { leads: number };
  }>;
}

const COLUMNS = [
  { id: "PLANNING", label: "Planning", accent: "border-t-amber-500" },
  { id: "IN_PROGRESS", label: "In Progress", accent: "border-t-sky-500" },
  { id: "REVIEW", label: "Review", accent: "border-t-violet-500" },
  { id: "DELIVERED", label: "Delivered", accent: "border-t-emerald-500" },
] as const;

export function ProjectsKanban() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-projects"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const projects = data?.projects ?? [];
  const byCol: Record<string, typeof projects> = {};
  for (const c of COLUMNS) byCol[c.id] = projects.filter((p) => p.status === c.id);
  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-3">
              <div className={`rounded-t-lg border-t-2 ${col.accent} bg-card/60 px-3 py-2.5`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {byCol[col.id].length}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                {byCol[col.id].length === 0 ? (
                  <Card className="border-dashed p-4 text-center text-xs text-muted-foreground">
                    No projects
                  </Card>
                ) : (
                  byCol[col.id].map((p) => (
                    <Card
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="cursor-pointer p-3 transition-all hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight">{p.name}</h4>
                        <StatusBadge kind="project" value={p.status} />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.scope ?? "No scope defined yet."}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="size-3" />
                          {formatMoney(p.budget)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {p._count.leads} lead{p._count.leads !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  Project since {formatDate(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge kind="project" value={selected.status} />
                  <Badge variant="secondary">{formatMoney(selected.budget)}</Badge>
                </div>
                {selected.scope && (
                  <div>
                    <h4 className="text-sm font-semibold">Scope</h4>
                    <p className="mt-1 rounded-lg bg-muted/40 p-3 text-sm">{selected.scope}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Start date</div>
                    <div className="mt-1 flex items-center gap-1.5 font-medium">
                      <Calendar className="size-3.5" />
                      {selected.startDate ? formatDate(selected.startDate) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">End date</div>
                    <div className="mt-1 flex items-center gap-1.5 font-medium">
                      <Calendar className="size-3.5" />
                      {selected.endDate ? formatDate(selected.endDate) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
