"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  MessageCircle,
  Phone,
  Video,
  Share2,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch, formatDate } from "@/lib/api";

interface CrmData {
  communications: Array<{
    id: string;
    channel: string;
    direction: string;
    subject: string;
    body: string;
    createdAt: string;
  }>;
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  CALL: Phone,
  MEETING: Video,
  SOCIAL: Share2,
};

const CHANNEL_COLOR: Record<string, string> = {
  EMAIL: "text-sky-500 bg-sky-500/10",
  WHATSAPP: "text-emerald-500 bg-emerald-500/10",
  CALL: "text-amber-500 bg-amber-500/10",
  MEETING: "text-violet-500 bg-violet-500/10",
  SOCIAL: "text-rose-500 bg-rose-500/10",
};

export function CommunicationsTimeline() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-comms"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });
  const [composeOpen, setComposeOpen] = React.useState(false);

  const comms = data?.communications ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {comms.length} communications across email, WhatsApp, calls, and social
        </p>
        <Button className="gap-2" onClick={() => setComposeOpen(true)}>
          <Plus className="size-4" />
          Compose
        </Button>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[1.45rem] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
            {comms.map((c) => {
              const Icon = CHANNEL_ICON[c.channel] ?? Mail;
              const isInbound = c.direction === "INBOUND";
              return (
                <li key={c.id} className="relative flex gap-3 rounded-lg p-2 transition-colors hover:bg-muted/30">
                  <div className={`grid size-9 shrink-0 place-items-center rounded-full ${CHANNEL_COLOR[c.channel]} z-10 ring-4 ring-background`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.subject}</span>
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {isInbound ? (
                            <ArrowDownLeft className="mr-1 size-3" />
                          ) : (
                            <ArrowUpRight className="mr-1 size-3" />
                          )}
                          {c.channel}
                        </Badge>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.body}</p>
                  </div>
                </li>
              );
            })}
            {comms.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No communications yet.
              </div>
            )}
          </ol>
        )}
      </Card>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compose message</DialogTitle>
          <DialogDescription>
            Draft a message; the Email Composer agent will personalize and queue it.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.success("Draft sent to Email Composer agent.");
            onOpenChange(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" required placeholder="client@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subj">Subject</Label>
            <Input id="subj" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" rows={5} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Queue via agent</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
