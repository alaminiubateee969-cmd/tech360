"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, DollarSign, ListChecks, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiFetch, formatMoney, formatDate } from "@/lib/api";
import { StatusBadge } from "../shared/StatusBadge";

interface CrmData {
  scopes: Array<{
    id: string;
    title: string;
    deliverables: string;
    timeline: string;
    budget: number;
    status: string;
    approvedAt: string | null;
    createdAt: string;
    project: { name: string } | null;
  }>;
}

export function ScopesList() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-scopes"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });
  const qc = useQueryClient();

  const scopes = data?.scopes ?? [];

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    toast.success(`Scope ${decision.toLowerCase()}.`);
    qc.invalidateQueries({ queryKey: ["crm-scopes"] });
    // No server endpoint for demo — just optimistic UI feedback.
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {scopes.map((s) => {
            let deliverables: string[] = [];
            try {
              deliverables = JSON.parse(s.deliverables) as string[];
            } catch {
              deliverables = [];
            }
            return (
              <Card key={s.id} className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{s.title}</h3>
                      <StatusBadge kind="scope" value={s.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.project?.name ?? "Unassigned project"}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="size-4 text-muted-foreground" />
                        <span>{formatMoney(s.budget)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="size-4 text-muted-foreground" />
                        <span>{s.timeline}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="size-4 text-muted-foreground" />
                        <span>{deliverables.length} deliverables</span>
                      </div>
                    </div>

                    {deliverables.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <ListChecks className="size-3.5" />
                          Deliverables
                        </div>
                        <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {deliverables.map((d) => (
                            <li key={d} className="flex items-start gap-2 text-sm">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="mt-3 text-xs text-muted-foreground">
                      Created {formatDate(s.createdAt)}
                      {s.approvedAt && ` · Approved ${formatDate(s.approvedAt)}`}
                    </p>
                  </div>

                  {s.status === "PENDING_APPROVAL" && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => decide(s.id, "APPROVED")}
                      >
                        <Check className="size-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => decide(s.id, "REJECTED")}
                      >
                        <X className="size-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
          {scopes.length === 0 && (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No scopes yet.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
