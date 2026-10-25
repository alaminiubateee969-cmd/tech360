"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Shield, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch, formatMoney } from "@/lib/api";

interface CrmData {
  staff: Array<{
    id: string;
    role: string;
    department: string;
    hourlyRate: number | null;
    permissions: string;
    user: { name: string | null; email: string };
  }>;
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-rose-500/12 text-rose-500 border-rose-500/30",
  MANAGER: "bg-amber-500/12 text-amber-500 border-amber-500/30",
  AGENT: "bg-violet-500/12 text-violet-500 border-violet-500/30",
  STAFF: "bg-sky-500/12 text-sky-500 border-sky-500/30",
  CLIENT: "bg-emerald-500/12 text-emerald-500 border-emerald-500/30",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StaffList() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-staff"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });

  const staff = data?.staff ?? [];

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => {
            const perms = s.permissions.split("|").filter(Boolean);
            return (
              <Card key={s.id} className="p-5 transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <Avatar className="size-11 rounded-full border border-border">
                    <AvatarFallback className="gradient-amber text-black font-semibold">
                      {initials(s.user.name ?? s.user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {s.user.name ?? "Unnamed"}
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail className="size-3" />
                      {s.user.email}
                    </div>
                    <Badge
                      variant="outline"
                      className={`mt-2 border font-medium ${ROLE_COLOR[s.role] ?? ""}`}
                    >
                      {s.role.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Department</div>
                    <div className="font-medium">{s.department}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rate</div>
                    <div className="font-medium">
                      {s.hourlyRate ? formatMoney(s.hourlyRate) + "/hr" : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Shield className="size-3" />
                    Permissions
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {perms.slice(0, 4).map((p) => (
                      <span
                        key={p}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                    {perms.length > 4 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" /> +{perms.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
