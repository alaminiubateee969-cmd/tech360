"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, FileText, CreditCard, PenSquare, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch, formatRelative } from "@/lib/api";
import { StatusBadge } from "../shared/StatusBadge";

interface CrmData {
  approvals: Array<{
    id: string;
    type: string;
    entityId: string;
    status: string;
    notes: string | null;
    createdAt: string;
    requester: { name: string | null } | null;
    decider: { name: string | null } | null;
  }>;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  SCOPE: FileText,
  PAYMENT: CreditCard,
  CONTENT: PenSquare,
  OTHER: MoreHorizontal,
};

export function ApprovalsQueue() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-approvals"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });
  const qc = useQueryClient();

  const approvals = data?.approvals ?? [];
  const pending = approvals.filter((a) => a.status === "PENDING");
  const decided = approvals.filter((a) => a.status !== "PENDING");

  function decide(id: string, decision: "APPROVED" | "REJECTED") {
    toast.success(`Approval ${decision.toLowerCase()}.`);
    qc.invalidateQueries({ queryKey: ["crm-approvals"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending queue · {pending.length}
          </h3>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : pending.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              Queue is clear. 🎉
            </Card>
          ) : (
            pending.map((a) => {
              const Icon = TYPE_ICON[a.type] ?? MoreHorizontal;
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">{a.type}</Badge>
                          <StatusBadge kind="approval" value={a.status} />
                        </div>
                        <p className="mt-1 text-sm">
                          {a.notes ?? `Approval for ${a.entityId}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Requested by {a.requester?.name ?? "system"} · {formatRelative(a.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => decide(a.id, "APPROVED")}
                      >
                        <Check className="size-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => decide(a.id, "REJECTED")}
                      >
                        <X className="size-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {decided.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recently decided
          </h3>
          <div className="space-y-2">
            {decided.map((a) => {
              const Icon = TYPE_ICON[a.type] ?? MoreHorizontal;
              return (
                <Card key={a.id} className="flex items-center gap-3 p-3 opacity-75">
                  <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {a.notes ?? `${a.type} approval`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      By {a.decider?.name ?? "—"} · {formatRelative(a.createdAt)}
                    </div>
                  </div>
                  <StatusBadge kind="approval" value={a.status} />
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
