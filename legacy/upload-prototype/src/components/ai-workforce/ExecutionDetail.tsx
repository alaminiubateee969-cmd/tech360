"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Clock, Cpu, Hash } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { apiFetch, formatRelative } from "@/lib/api";
import type { ExecutionDetail as ExecutionDetailType } from "./types";

const LOG_COLORS: Record<string, string> = {
  INFO: "text-blue-500",
  WARN: "text-amber-500",
  ERROR: "text-red-500",
  DEBUG: "text-muted-foreground",
};

interface Props {
  id: string;
  onClose: () => void;
}

export function ExecutionDetail({ id, onClose }: Props) {
  const { data, isLoading } = useQuery<{ execution: ExecutionDetailType }>({
    queryKey: ["ai-workforce", "execution", id],
    queryFn: () => apiFetch<{ execution: ExecutionDetailType }>(`/api/ai-workforce/executions/${id}`),
  });

  const exec = data?.execution;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border/60 p-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-base">Execution Detail</SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                {exec && (
                  <>
                    <span className="font-medium text-foreground">{exec.agent.name}</span>
                    <Badge variant="outline" className="text-[10px]">{exec.agent.role}</Badge>
                  </>
                )}
              </SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        {isLoading || !exec ? (
          <div className="p-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="mt-4 h-48 rounded-xl" />
          </div>
        ) : (
          <ScrollArea className="flex-1 scrollbar-thin">
            <div className="space-y-4 p-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Meta icon={Clock} label="Duration" value={`${exec.durationMs ?? 0}ms`} />
                <Meta icon={Cpu} label="Model" value={exec.modelUsed ?? "—"} />
                <Meta icon={Hash} label="Tokens in" value={String(exec.tokenInput ?? 0)} />
                <Meta icon={Hash} label="Tokens out" value={String(exec.tokenOutput ?? 0)} />
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={exec.status === "SUCCESS" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {exec.status}
                </Badge>
                <span className="text-xs text-muted-foreground">started {formatRelative(exec.startedAt)}</span>
              </div>

              {exec.errorMessage && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/8 p-3 text-xs text-red-600 dark:text-red-400">
                  {exec.errorMessage}
                </div>
              )}

              {/* Input */}
              <div>
                <h4 className="mb-1.5 text-xs font-semibold">Input</h4>
                <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] scrollbar-thin">
                  {exec.input}
                </pre>
              </div>

              {/* Output */}
              {exec.output && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold">Output</h4>
                  <pre className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed scrollbar-thin">
                    {exec.output}
                  </pre>
                </div>
              )}

              {/* Logs */}
              <div>
                <h4 className="mb-1.5 text-xs font-semibold">Logs ({exec.logs.length})</h4>
                <div className="space-y-1 rounded-md bg-muted/30 p-3">
                  {exec.logs.map((l) => (
                    <div key={l.id} className="flex gap-2 text-[11px]">
                      <span className="font-mono text-muted-foreground">
                        {new Date(l.createdAt).toISOString().slice(11, 19)}
                      </span>
                      <span className={`font-semibold ${LOG_COLORS[l.level] ?? ""}`}>{l.level}</span>
                      <span>{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              {exec.results.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold">Results</h4>
                  <Separator className="mb-2" />
                  <div className="space-y-1">
                    {exec.results.map((r) => (
                      <div key={r.id} className="flex gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                        <span className="font-medium">{r.key}</span>
                        <span className="truncate text-muted-foreground">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
