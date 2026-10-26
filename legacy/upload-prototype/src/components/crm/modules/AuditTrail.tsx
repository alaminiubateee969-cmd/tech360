"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, formatDate, formatRelative } from "@/lib/api";

interface CrmData {
  auditLog: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: string;
    createdAt: string;
    user: { name: string | null } | null;
  }>;
}

export function AuditTrail() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-audit"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });

  const logs = data?.auditLog ?? [];

  return (
    <Card className="overflow-hidden">
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ol className="divide-y divide-border/40">
          {logs.map((l) => {
            const [verb, target] = l.action.split(".");
            return (
              <li
                key={l.id}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                    <span className="font-mono text-xs font-semibold">
                      {verb.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{verb}</span>
                      {target && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {target}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      by <span className="font-medium">{l.user?.name ?? "system"}</span> · entity:{" "}
                      <span className="font-mono">{l.entityType}/{l.entityId}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{formatRelative(l.createdAt)}</div>
                  <div className="text-[10px]">{formatDate(l.createdAt)}</div>
                </div>
              </li>
            );
          })}
          {logs.length === 0 && (
            <li className="p-12 text-center text-sm text-muted-foreground">
              No audit events.
            </li>
          )}
        </ol>
      )}
    </Card>
  );
}
