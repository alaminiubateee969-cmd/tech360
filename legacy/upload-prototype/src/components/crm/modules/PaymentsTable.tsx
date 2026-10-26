"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch, formatMoney, formatDate } from "@/lib/api";
import { StatusBadge } from "../shared/StatusBadge";

interface CrmData {
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    transactionId: string | null;
    verifiedAt: string | null;
    createdAt: string;
    project: { name: string } | null;
  }>;
}

export function PaymentsTable() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-payments"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });

  const payments = data?.payments ?? [];

  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const totalPending = payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Collected</div>
          <div className="mt-1 text-lg font-bold text-emerald-500">{formatMoney(totalPaid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="mt-1 text-lg font-bold text-amber-500">{formatMoney(totalPending)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total invoices</div>
          <div className="mt-1 text-lg font-bold">{payments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Failed/Refunded</div>
          <div className="mt-1 text-lg font-bold text-rose-500">
            {payments.filter((p) => p.status === "FAILED" || p.status === "REFUNDED").length}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Project</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">Method</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="hidden px-4 py-3 sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="hidden px-4 py-3 md:table-cell"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                    </tr>
                  ))
                : payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.project?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold">{formatMoney(p.amount, p.currency)}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge variant="secondary" className="font-normal">{p.method}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="payment" value={p.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() =>
                              toast.success("Payment Verifier agent queued — manual review.", {
                                description: `Invoice for ${p.project?.name}`,
                              })
                            }
                          >
                            <BadgeCheck className="size-4" />
                            Verify
                          </Button>
                        ) : p.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-500">
                            <AlertTriangle className="size-3.5" />
                            Needs attention
                          </span>
                        ) : p.status === "PAID" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                            <BadgeCheck className="size-3.5" />
                            Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3.5" />
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
