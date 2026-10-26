"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Search, Phone, Video, MoreVertical, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, formatRelative } from "@/lib/api";

interface Conversation {
  id: string;
  channel: string;
  contactName: string;
  contactHandle: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  messages?: Array<{ body: string; direction: string }>;
}

interface ConversationDetail {
  conversation: Conversation;
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    createdAt: string;
    status: string;
  }>;
}

const QUICK_REPLIES = [
  "Thanks for your message — sending options now 📄",
  "Can we hop on a quick call today?",
  "Got it! Drafting a proposal, ETA 24h.",
  "Could you share your budget range?",
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function WhatsAppInbox() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [q, setQ] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: listData, isLoading: listLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<{ conversations: Conversation[] }>("/api/conversations"),
    refetchInterval: 15000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<ConversationDetail>({
    queryKey: ["conversation", selectedId],
    queryFn: () => apiFetch<ConversationDetail>(`/api/conversations/${selectedId}/messages`),
    enabled: !!selectedId,
  });

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [detail, detailLoading]);

  React.useEffect(() => {
    if (!selectedId && listData?.conversations.length) {
      setSelectedId(listData.conversations[0].id);
    }
  }, [listData, selectedId]);

  const conversations = (listData?.conversations ?? []).filter(
    (c) =>
      q === "" ||
      c.contactName.toLowerCase().includes(q.toLowerCase()) ||
      c.contactHandle.toLowerCase().includes(q.toLowerCase())
  );

  async function send(text?: string) {
    const body = (text ?? draft).trim();
    if (!body || !selectedId) return;
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["conversation", selectedId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      toast.error("Message failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {/* Conversation list */}
      <Card className="flex flex-col overflow-hidden md:col-span-1">
        <div className="border-b border-border/60 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {listLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ))
          ) : (
            conversations.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/40 p-3 text-left transition-colors",
                    active ? "bg-primary/8" : "hover:bg-muted/40"
                  )}
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="gradient-emerald text-black text-xs font-semibold">
                      {initials(c.contactName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{c.contactName}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.messages?.[0]?.body ?? "Tap to open"}
                    </div>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* Thread */}
      <Card className="flex flex-col overflow-hidden md:col-span-2 lg:col-span-2">
        {!detail ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            {detailLoading ? <Skeleton className="h-64 w-full" /> : "Select a conversation"}
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between border-b border-border/60 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="gradient-emerald text-black text-xs font-semibold">
                    {initials(detail.conversation.contactName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-semibold">{detail.conversation.contactName}</div>
                  <div className="text-xs text-muted-foreground">
                    {detail.conversation.contactHandle}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8">
                  <Phone className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8">
                  <Video className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreVertical className="size-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto scrollbar-thin bg-[oklch(0.08_0.005_240)] p-4">
              {detail.messages.map((m) => {
                const outbound = m.direction === "OUTBOUND";
                return (
                  <div
                    key={m.id}
                    className={cn("flex", outbound ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                        outbound
                          ? "rounded-tr-sm bg-emerald-600 text-white"
                          : "rounded-tl-sm bg-card text-card-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div
                        className={cn(
                          "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                          outbound ? "text-emerald-100/80" : "text-muted-foreground"
                        )}
                      >
                        {formatRelative(m.createdAt)}
                        {outbound && <CheckCheck className="size-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick replies */}
            <div className="flex flex-wrap gap-1.5 border-t border-border/60 p-2">
              {QUICK_REPLIES.map((r) => (
                <button
                  key={r}
                  onClick={() => send(r)}
                  disabled={sending}
                  className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-foreground disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-border/60 p-2"
            >
              <Input
                placeholder="Type a message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
                <Send className="size-4" />
              </Button>
            </form>
          </>
        )}
      </Card>

      {/* Contact info */}
      <Card className="hidden flex-col overflow-hidden lg:flex">
        {detail ? (
          <div className="p-4">
            <div className="flex flex-col items-center text-center">
              <Avatar className="size-16">
                <AvatarFallback className="gradient-emerald text-black font-semibold">
                  {initials(detail.conversation.contactName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="mt-3 font-semibold">{detail.conversation.contactName}</h3>
              <p className="text-xs text-muted-foreground">{detail.conversation.contactHandle}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active on WhatsApp
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Channel</div>
                <div className="mt-0.5 font-medium">{detail.conversation.channel}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Total messages</div>
                <div className="mt-0.5 font-medium">{detail.messages.length}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">First contact</div>
                <div className="mt-0.5 font-medium">{formatRelative(detail.conversation.createdAt)}</div>
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => toast.info("Routing to CRM Manager — create lead from this chat.")}
            >
              Convert to lead
            </Button>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            No conversation selected
          </div>
        )}
      </Card>
    </div>
  );
}
