"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Loader2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agentSlug: string;
  agentName: string;
}

interface ExecutionResult {
  executionId: string;
  output: string;
  status: string;
  durationMs: number;
  modelUsed: string;
  tokenInput: number;
  tokenOutput: number;
  logs: Array<{ level: string; message: string; ts: string }>;
}

const SAMPLE_INPUT = JSON.stringify(
  { request: "Analyse the current state of the department and recommend the top priority for this week.", context: {} },
  null,
  2
);

const LOG_COLORS: Record<string, string> = {
  INFO: "text-blue-500",
  WARN: "text-amber-500",
  ERROR: "text-red-500",
  DEBUG: "text-muted-foreground",
};

export function AgentExecuteDialog({ open, onOpenChange, agentSlug, agentName }: Props) {
  const [input, setInput] = React.useState(SAMPLE_INPUT);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<ExecutionResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setInput(SAMPLE_INPUT);
    }
  }, [open, agentSlug]);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(input) as Record<string, unknown>;
      } catch {
        parsed = { request: input };
      }
      const res = await apiFetch<ExecutionResult>(`/api/ai-workforce/agents/${agentSlug}/execute`, {
        method: "POST",
        body: JSON.stringify({ input: parsed }),
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["ai-workforce"] });
      if (res.status === "PENDING_APPROVAL") {
        toast.info("Action requires human approval — request queued.");
      } else {
        toast.success(`Executed in ${res.durationMs}ms via ${res.modelUsed}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Execution failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  function copyOutput() {
    if (!result) return;
    navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 p-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Play className="size-4 text-primary" />
            Execute: {agentName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Provide a JSON input. The engine loads the agent, resolves the best prompt, calls the LLM,
            and logs the execution.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 scrollbar-thin">
          <div className="space-y-4 p-4">
            {/* Input */}
            <div>
              <label className="mb-1.5 block text-xs font-medium">Input (JSON)</label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
                placeholder='{ "request": "..." }'
              />
            </div>

            <Button onClick={run} disabled={running} className="w-full gap-2">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? "Executing…" : "Run Agent"}
            </Button>

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/8 p-3 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      result.status === "SUCCESS"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : result.status === "PENDING_APPROVAL"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {result.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{result.durationMs}ms</Badge>
                  <Badge variant="outline" className="text-[10px]">{result.modelUsed}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {result.tokenInput} in / {result.tokenOutput} out
                  </Badge>
                </div>

                {/* Output */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium">Output</label>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-[10px]" onClick={copyOutput}>
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed scrollbar-thin">
                    {result.output}
                  </pre>
                </div>

                {/* Logs */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Execution Log</label>
                  <div className="space-y-1 rounded-md bg-muted/30 p-3">
                    {result.logs.map((l, i) => (
                      <div key={i} className="flex gap-2 text-[11px]">
                        <span className="font-mono text-muted-foreground">{l.ts.slice(11, 19)}</span>
                        <span className={`font-semibold ${LOG_COLORS[l.level] ?? ""}`}>{l.level}</span>
                        <span className="text-foreground">{l.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
