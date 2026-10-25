"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LEAD_STATUS_CLASS: Record<string, string> = {
  NEW: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  CONTACTED: "bg-sky-500/12 text-sky-500 border-sky-500/30",
  QUALIFIED: "bg-violet-500/12 text-violet-500 border-violet-500/30",
  WON: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
  LOST: "bg-rose-500/12 text-rose-500 border-rose-500/30",
};

const PROJECT_STATUS_CLASS: Record<string, string> = {
  PLANNING: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  IN_PROGRESS: "bg-sky-500/12 text-sky-500 border-sky-500/30",
  REVIEW: "bg-violet-500/12 text-violet-500 border-violet-500/30",
  DELIVERED: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  PAID: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
  FAILED: "bg-rose-500/12 text-rose-500 border-rose-500/30",
  REFUNDED: "bg-violet-500/12 text-violet-500 border-violet-500/30",
};

const SCOPE_STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  APPROVED: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
  REJECTED: "bg-rose-500/12 text-rose-500 border-rose-500/30",
};

const APPROVAL_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  APPROVED: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
  REJECTED: "bg-rose-500/12 text-rose-500 border-rose-500/30",
};

const AGENT_STATUS_CLASS: Record<string, string> = {
  ONLINE: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
  BUSY: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  OFFLINE: "bg-muted text-muted-foreground",
};

const MAP: Record<string, Record<string, string>> = {
  lead: LEAD_STATUS_CLASS,
  project: PROJECT_STATUS_CLASS,
  payment: PAYMENT_STATUS_CLASS,
  scope: SCOPE_STATUS_CLASS,
  approval: APPROVAL_STATUS_CLASS,
  agent: AGENT_STATUS_CLASS,
};

export function StatusBadge({
  kind,
  value,
  className,
}: {
  kind: "lead" | "project" | "payment" | "scope" | "approval" | "agent";
  value: string;
  className?: string;
}) {
  const cls = MAP[kind]?.[value] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("border font-medium", cls, className)}>
      {value.replace("_", " ").toLowerCase()}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-emerald-500/12 text-emerald-500"
      : score >= 60
      ? "bg-amber-500/12 text-amber-500"
      : "bg-rose-500/12 text-rose-500";
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tone
      )}
    >
      {score}
    </span>
  );
}
