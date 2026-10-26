"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch, formatRelative } from "@/lib/api";
import type { ApprovalRequest } from "./types";

const SEVERITY_COLOR: Record<string, string> = {
  PENDING: "text-amber-600 dark:text-amber-400",
  APPROVED: "text-emerald-600 dark:text-emerald-400",
  REJECTED: "text-red-600 dark:text-red-400",
};

export function ApprovalsQueue() {
  const qc = useQueryClient();
  const [deciding, setDeciding] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ approvals: ApprovalRequest[] }>({
    queryKey: ["ai-workforce", "approvals"],
    queryFn: () => apiFetch<{ approvals: ApprovalRequest[] }>("/api/ai-workforce/approvals?status=PENDING"),
    refetchInterval: 15000,
  });

  const approvals = data?.approvals ?? [];

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    setDeciding(id);
    try {
      await apiFetch(`/api/ai-workforce/approvals/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, note: notes[id] ?? null }),
      });
      toast.success(`Request ${decision.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["ai-workforce", "approvals"] });
      setNotes((n) => {
        const next = { ...n };
        delete next[id];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-amber-500" />
        Pending Approvals
        <Badge variant="secondary" className="text-[10px]">
          {approvals.length} pending
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
          <Check className="size-10 text-emerald-500" />
          <p className="mt-3 text-sm font-medium">No pending approvals</p>
          <p className="mt-1 text-xs text-muted-foreground">
            High-risk actions from approval-required agents will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">{a.agent.name}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.agent.department?.name} · {a.agent.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLOR[a.status]}`}>
                    {a.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(a.createdAt)}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Action: {a.action}
                </div>
                <pre className="max-h-32 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] scrollbar-thin">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(a.payload), null, 2);
                    } catch {
                      return a.payload;
                    }
                  })()}
                </pre>
              </div>

              <div className="mt-3">
                <Textarea
                  placeholder="Review note (optional)…"
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  className="min-h-[48px] text-xs"
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => decide(a.id, "REJECTED")}
                  disabled={deciding === a.id}
                >
                  {deciding === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => decide(a.id, "APPROVED")}
                  disabled={deciding === a.id}
                >
                  {deciding === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
