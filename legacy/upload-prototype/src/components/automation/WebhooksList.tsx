"use client";

import { useQuery } from "@tanstack/react-query";
import { Webhook, Copy, Clock, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiFetch, formatRelative } from "@/lib/api";

interface WebhookItem {
  id: string;
  name: string;
  endpoint: string;
  channel: string;
  secret: string;
  lastFiredAt: string | null;
  createdAt: string;
}

const CHANNEL_COLOR: Record<string, string> = {
  WEBSITE: "bg-amber-500/12 text-amber-500",
  WHATSAPP: "bg-emerald-500/12 text-emerald-500",
  PAYMENT: "bg-sky-500/12 text-sky-500",
  FACEBOOK: "bg-violet-500/12 text-violet-500",
  INSTAGRAM: "bg-rose-500/12 text-rose-500",
};

export function WebhooksList() {
  const { data, isLoading } = useQuery<{ webhooks: WebhookItem[] }>({
    queryKey: ["webhooks"],
    queryFn: () => apiFetch<{ webhooks: WebhookItem[] }>("/api/webhooks"),
  });

  const webhooks = data?.webhooks ?? [];

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Copied to clipboard.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {webhooks.length} registered webhook endpoints
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Refreshed.")}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-border/40 overflow-hidden">
          {webhooks.map((w) => (
            <div key={w.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Webhook className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    <Badge variant="outline" className={`font-mono text-[10px] ${CHANNEL_COLOR[w.channel] ?? ""}`}>
                      {w.channel}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="truncate text-xs text-muted-foreground">{w.endpoint}</code>
                    <button
                      onClick={() => copy(`${w.endpoint}?secret=${w.secret}`)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Copy endpoint"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {w.lastFiredAt ? `Last fired ${formatRelative(w.lastFiredAt)}` : "Never fired"}
                </span>
                {w.lastFiredAt ? (
                  <Badge className="bg-emerald-500/12 text-emerald-500">live</Badge>
                ) : (
                  <Badge variant="secondary">idle</Badge>
                )}
              </div>
            </div>
          ))}
          {webhooks.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No webhooks registered.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
