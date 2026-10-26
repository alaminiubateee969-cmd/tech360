"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  messages: Array<{ id: string; direction: string; body: string; createdAt: string }>;
}

const PLATFORMS = [
  { id: "FACEBOOK", label: "Facebook", color: "text-sky-500" },
  { id: "INSTAGRAM", label: "Instagram", color: "text-rose-500" },
  { id: "LINKEDIN", label: "LinkedIn", color: "text-violet-500" },
  { id: "X", label: "X", color: "text-foreground" },
] as const;

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function SocialInbox() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<string>("FACEBOOK");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const { data: listData, isLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<{ conversations: Conversation[] }>("/api/conversations"),
  });

  const filtered = (listData?.conversations ?? []).filter((c) => c.channel === tab);

  React.useEffect(() => {
    if (filtered.length && !selectedId) {
      setSelectedId(filtered[0].id);
    }
    if (selectedId && !filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [tab, listData, filtered, selectedId]);

  const { data: detail } = useQuery<ConversationDetail>({
    queryKey: ["conversation", selectedId],
    queryFn: () => apiFetch<ConversationDetail>(`/api/conversations/${selectedId}/messages`),
    enabled: !!selectedId,
  });

  async function send() {
    if (!draft.trim() || !selectedId) return;
    try {
      await apiFetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft }),
      });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["conversation", selectedId] });
      toast.success("Reply posted.");
    } catch {
      toast.error("Reply failed.");
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedId(null); }}>
        <TabsList className="flex flex-wrap">
          {PLATFORMS.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="gap-2">
              <span className={cn("size-2 rounded-full bg-current", p.color)} />
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PLATFORMS.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Mentions / DMs feed */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {p.label} mentions & DMs
                </h3>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))
                ) : filtered.length === 0 ? (
                  <Card className="p-12 text-center text-sm text-muted-foreground">
                    No {p.label} activity.
                  </Card>
                ) : (
                  filtered.map((c) => (
                    <Card
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "cursor-pointer p-4 transition-all hover:shadow-md",
                        c.id === selectedId ? "border-primary/50 ring-1 ring-primary/30" : ""
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className={cn("text-xs font-semibold", p.color)}>
                            {initials(c.contactName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{c.contactName}</span>
                            <span className="text-[10px] text-muted-foreground">{c.contactHandle}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {c.messages?.[0]?.body ?? "Tap to view conversation"}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{formatRelative(c.lastMessageAt)}</span>
                            {c.unreadCount > 0 && (
                              <Badge className="bg-rose-500/12 text-rose-500">
                                {c.unreadCount} new
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Thread */}
              <Card className="flex flex-col overflow-hidden">
                {!detail ? (
                  <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                    Select a conversation
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 border-b border-border/60 p-3">
                      <Avatar className="size-9">
                        <AvatarFallback className={cn("text-xs font-semibold", p.color)}>
                          {initials(detail.conversation.contactName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-semibold">{detail.conversation.contactName}</div>
                        <div className="text-xs text-muted-foreground">{detail.conversation.contactHandle}</div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin p-4">
                      {detail.messages.map((m) => {
                        const outbound = m.direction === "OUTBOUND";
                        return (
                          <div key={m.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                                outbound
                                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                                  : "rounded-tl-sm bg-muted"
                              )}
                            >
                              <p className="whitespace-pre-wrap">{m.body}</p>
                              <div className="mt-0.5 text-[10px] opacity-70">
                                {formatRelative(m.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mock engagement bar */}
                    <div className="flex items-center justify-around border-t border-border/60 py-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="size-3" /> 24</span>
                      <span className="flex items-center gap-1"><MessageCircle className="size-3" /> 6</span>
                      <span className="flex items-center gap-1"><Share2 className="size-3" /> 2</span>
                      <span className="flex items-center gap-1"><Bookmark className="size-3" /> 1</span>
                    </div>

                    <form
                      onSubmit={(e) => { e.preventDefault(); send(); }}
                      className="flex items-center gap-2 border-t border-border/60 p-2"
                    >
                      <Input
                        placeholder={`Reply on ${p.label}...`}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <Button type="submit" size="icon" disabled={!draft.trim()}>
                        <Send className="size-4" />
                      </Button>
                    </form>
                  </>
                )}
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
