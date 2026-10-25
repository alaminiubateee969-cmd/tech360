"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Layers, Bot, Zap, FileText, GitBranch, Shield, Network, Award, Cpu, Database, Plug, Send, Sparkles, CheckCircle2, XCircle, Clock, TreePine, Activity } from "lucide-react";

type Section = "overview" | "command-center" | "workforce-tree" | "create-agent" | "departments" | "agents" | "skills" | "prompts" | "sops" | "rules" | "knowledge" | "rag" | "memory" | "evaluation" | "dcc" | "governance" | "security" | "audit" | "rbac" | "workflows" | "event-bus" | "observability" | "mcp" | "data-lake";

const SECTIONS: Array<{ id: Section; label: string; icon: React.ElementType; group: string }> = [
  { id: "overview", label: "Global Overview", icon: Activity, group: "Overview" },
  { id: "command-center", label: "NL Command Center", icon: Sparkles, group: "Overview" },
  { id: "workforce-tree", label: "AI Workforce Tree", icon: TreePine, group: "Overview" },
  { id: "create-agent", label: "Create Agent", icon: Bot, group: "Overview" },
  { id: "departments", label: "Departments (100)", icon: Layers, group: "Registry" },
  { id: "agents", label: "AI Employees (2,000)", icon: Bot, group: "Registry" },
  { id: "skills", label: "Skills", icon: Zap, group: "Registry" },
  { id: "prompts", label: "Prompts (50,000)", icon: FileText, group: "Registry" },
  { id: "sops", label: "SOPs (500)", icon: GitBranch, group: "Registry" },
  { id: "rules", label: "Constitutional Rules", icon: Shield, group: "Registry" },
  { id: "knowledge", label: "Knowledge Graph", icon: Network, group: "Cognitive" },
  { id: "rag", label: "Enterprise RAG", icon: Database, group: "Cognitive" },
  { id: "memory", label: "Memory Engine", icon: Cpu, group: "Cognitive" },
  { id: "evaluation", label: "Evaluation Engine", icon: Award, group: "Cognitive" },
  { id: "dcc", label: "DCC Certification", icon: Award, group: "Governance" },
  { id: "governance", label: "Governance Engine", icon: Shield, group: "Governance" },
  { id: "security", label: "Security Engine", icon: Shield, group: "Governance" },
  { id: "audit", label: "Audit Engine", icon: FileText, group: "Governance" },
  { id: "rbac", label: "Identity & RBAC", icon: Shield, group: "Governance" },
  { id: "workflows", label: "Workflow Orchestration", icon: GitBranch, group: "Operations" },
  { id: "event-bus", label: "Event Bus", icon: Zap, group: "Operations" },
  { id: "observability", label: "Observability", icon: Activity, group: "Operations" },
  { id: "mcp", label: "MCP Integration", icon: Plug, group: "Operations" },
  { id: "data-lake", label: "Enterprise Data Lake", icon: Database, group: "Operations" },
];

const GROUPS = ["Overview", "Registry", "Cognitive", "Governance", "Operations"];

export function SuperAdminCommandCenter() {
  const [section, setSection] = React.useState<Section>("overview");
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border/60 bg-card/30 md:block">
        <ScrollArea className="h-full">
          <div className="p-3">
            {GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</h3>
                {SECTIONS.filter((s) => s.group === group).map((s) => {
                  const Icon = s.icon;
                  const active = section === s.id;
                  return (
                    <button key={s.id} onClick={() => setSection(s.id)} className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {section === "overview" && <OverviewSection />}
        {section === "command-center" && <NLCommandCenter />}
        {section === "workforce-tree" && <WorkforceTree />}
        {section === "create-agent" && <CreateAgentSection />}
        {section === "departments" && <SimpleSection title="Departments" count={100} />}
        {section === "agents" && <SimpleSection title="AI Employees" count={2000} />}
        {section === "skills" && <SimpleSection title="Skills" count={2564} />}
        {section === "prompts" && <SimpleSection title="Prompts" count={50000} />}
        {section === "sops" && <SimpleSection title="SOPs" count={500} />}
        {section === "rules" && <SimpleSection title="Constitutional Rules" count={500} />}
        {section === "knowledge" && <SimpleSection title="Knowledge Graph Nodes" count={0} />}
        {section === "rag" && <SimpleSection title="RAG Documents" count={12} />}
        {section === "memory" && <SimpleSection title="Memory Engine" count={0} />}
        {section === "evaluation" && <SimpleSection title="Evaluations" count={2000} />}
        {section === "dcc" && <DCCSection />}
        {section === "governance" && <SimpleSection title="Governance Decisions" count={0} />}
        {section === "security" && <SimpleSection title="Security Engine" count={0} />}
        {section === "audit" && <SimpleSection title="Audit Logs" count={0} />}
        {section === "rbac" && <SimpleSection title="Users" count={8} />}
        {section === "workflows" && <SimpleSection title="Workflows" count={10} />}
        {section === "event-bus" && <SimpleSection title="Event Subscriptions" count={4} />}
        {section === "observability" && <SimpleSection title="Metrics" count={4} />}
        {section === "mcp" && <SimpleSection title="MCP Servers" count={8} />}
        {section === "data-lake" && <SimpleSection title="Data Lake Datasets" count={3} />}
      </main>
    </div>
  );
}

function OverviewSection() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["super-admin-cc"], queryFn: () => apiFetch("/api/super-admin/command-center"), refetchInterval: 30000 });
  if (isLoading || !data) return <Card className="p-8 text-center text-sm text-muted-foreground">Loading...</Card>;
  const c = (data as any)?.counts as Record<string, number> || {} as Record<string, number>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Super Admin AI Command Center</h1><p className="text-sm text-muted-foreground">Master control plane for 100 departments, 2,000+ agents, 21 engines.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Departments" value={c.departments} icon={Layers} />
        <StatCard label="AI Employees" value={c.agents} icon={Bot} />
        <StatCard label="Skills" value={c.skills} icon={Zap} />
        <StatCard label="Prompts" value={c.prompts} icon={FileText} />
        <StatCard label="SOPs" value={c.sops} icon={GitBranch} />
        <StatCard label="Rules" value={c.constitutionalRules} icon={Shield} />
        <StatCard label="KG Edges" value={c.knowledgeGraphEdges} icon={Network} />
      </div>
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2"><Award className="h-5 w-5 text-amber-400" /><h2 className="text-lg font-semibold">DCC Certification</h2><Badge variant="outline" className="ml-auto text-xs">{(data as any)?.dcc?.certified || 0}/{(data as any)?.dcc?.total || 100} Certified</Badge></div>
        <div className="grid grid-cols-5 gap-2">
          <LevelCard level="PLATINUM" count={(data as any)?.dcc?.platinum || 0} />
          <LevelCard level="GOLD" count={(data as any)?.dcc?.gold || 0} />
          <LevelCard level="SILVER" count={(data as any)?.dcc?.silver || 0} />
          <LevelCard level="BRONZE" count={(data as any)?.dcc?.bronze || 0} />
          <LevelCard level="NONE" count={(data as any)?.dcc?.none || 0} />
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2"><Cpu className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-semibold">Infrastructure</h2></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <InfraCard label="MCP Servers" value={c.mcpServers} icon={Plug} />
          <InfraCard label="MCP Tools" value={c.mcpTools} icon={Plug} />
          <InfraCard label="Data Lake" value={c.dataLakeDatasets} icon={Database} />
          <InfraCard label="API Routes" value={c.apiGatewayRoutes} icon={Network} />
          <InfraCard label="Event Subs" value={c.eventSubscriptions} icon={Zap} />
          <InfraCard label="KG Nodes" value={c.knowledgeGraphNodes} icon={Network} />
        </div>
      </Card>
      {data.metrics?.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Live Metrics</h2>
          <div className="space-y-1">
            {(data as any)?.metrics?.map((m: Record<string, unknown>) => (
              <div key={m.id as string} className="flex items-center justify-between border-b py-1.5 text-xs">
                <span className="font-mono">{m.name as string}</span>
                <span className="font-mono font-medium">{(m.value as number).toLocaleString()} {m.unit as string}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function NLCommandCenter() {
  const [command, setCommand] = React.useState("");
  const [history, setHistory] = React.useState<Array<Record<string, unknown>>>([]);
  const mutation = useMutation({
    mutationFn: (cmd: string) => apiFetch("/api/super-admin/command/execute", { method: "POST", body: JSON.stringify({ command: cmd }) }),
    onSuccess: (data: any) => { setHistory((prev) => [{ ...data, timestamp: new Date().toISOString() }, ...prev]); setCommand(""); toast.success(`Command ${data.executionStatus.toLowerCase()}`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const examples = ["Show me all failing agents", "Run health check on all departments", "Create a new agent for UK student visa document review", "Run department certification", "Show all security violations", "Show me all human escalations", "Show me AI cost and resource usage", "Repair failed agents", "Generate department performance report"];
  return (
    <div className="space-y-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-amber-400" /> Natural Language Command Center</h1><p className="text-sm text-muted-foreground">8-step safety pipeline: Identity → RBAC → Validation → Constitutional → Security → SOP → Execution Policy → Audit</p></div>
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); if (command.trim()) mutation.mutate(command.trim()); }} className="flex gap-2">
          <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder='Try: "Show me all failing agents" or "Create a new agent for visa review"' className="flex-1" disabled={mutation.isPending} />
          <Button type="submit" disabled={mutation.isPending || !command.trim()} className="gap-2"><Send className="h-4 w-4" />{mutation.isPending ? "Executing..." : "Execute"}</Button>
        </form>
        <div className="mt-3"><div className="mb-1.5 text-xs text-muted-foreground">Examples:</div><div className="flex flex-wrap gap-1.5">
          {examples.map((ex) => (<button key={ex} onClick={() => setCommand(ex)} className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">{ex}</button>))}
        </div></div>
      </Card>
      <div className="space-y-3">
        {history.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No commands executed yet.</Card>}
        {history.map((h: any, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono">{h.originalText as string}</code>
                  {h.executionStatus === "SUCCESS" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {h.executionStatus === "FAILED" && <XCircle className="h-4 w-4 text-red-500" />}
                  {h.executionStatus === "BLOCKED" && <XCircle className="h-4 w-4 text-red-500" />}
                  {h.executionStatus === "AWAITING_CONFIRMATION" && <Clock className="h-4 w-4 text-amber-500" />}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">Intent: <code className="font-mono">{(h.parsedIntent as string) || "—"}</code> · {(h.durationMs as number) || 0}ms · {h.executionStatus as string}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {(h.steps as Array<{ step: string; status: string }>)?.map((s) => (
                <span key={s.step} className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${s.status === "PASS" ? "bg-emerald-500/10 text-emerald-500" : s.status === "FAIL" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>{s.step.replace(/_/g, " ")}: {s.status}</span>
              ))}
            </div>
            {h.executionResult && <pre className="mt-3 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(h.executionResult, null, 2)}</pre>}
            {h.errorMessage && <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-500">{h.errorMessage as string}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkforceTree() {
  const { data, isLoading } = useQuery({ queryKey: ["workforce-tree"], queryFn: () => apiFetch("/api/super-admin/workforce-tree") });
  if (isLoading || !data) return <Card className="p-8 text-center text-sm text-muted-foreground">Loading...</Card>;
  return (
    <div className="space-y-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><TreePine className="h-6 w-6 text-emerald-400" /> AI Workforce Tree</h1><p className="text-sm text-muted-foreground">{(data as any)?.totalDepartments} departments · {(data as any)?.totalAgents} agents</p></div>
      <Card className="p-4">
        <ScrollArea className="h-[70vh]">
          <div className="space-y-1 font-mono text-xs">
            {(data as any)?.departments?.map((d: Record<string, unknown>) => (
              <div key={d.slug as string}>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{d.name as string}</span>
                  <Badge variant="outline" className="text-[10px]">{((d._count as Record<string, number>)?.agents) || 0} agents</Badge>
                  <Badge variant="outline" className={`text-[10px] ${((d.dcc as Record<string, boolean>)?.certified) ? "border-emerald-500 text-emerald-500" : "border-amber-500 text-amber-500"}`}>{((d.dcc as Record<string, string>)?.certificationLevel) || "NONE"}</Badge>
                </div>
                <div className="ml-4 border-l border-border/40 pl-2">
                  {(d.agents as Array<Record<string, unknown>>)?.slice(0, 20).map((a) => (
                    <div key={a.slug as string} className="flex items-center gap-2 py-0.5">
                      <span className="text-muted-foreground">├─</span>
                      <span>{a.name as string}</span>
                      <span className="text-muted-foreground">({a.role as string})</span>
                      <span className={a.status === "ACTIVE" ? "text-emerald-500" : "text-amber-500"}>●{a.status as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

function CreateAgentSection() {
  const [purpose, setPurpose] = React.useState("");
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [requests, setRequests] = React.useState<Array<Record<string, unknown>>>([]);
  const loadReqs = React.useCallback(async () => { try { const r = await apiFetch("/api/super-admin/agents/create") as any; setRequests(r?.requests || []); } catch {} }, []);
  React.useEffect(() => { loadReqs(); }, [loadReqs]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch("/api/super-admin/agents/create", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data: any) => { setResult(data); toast.success("Request created"); loadReqs(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/super-admin/creation-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ decision: "APPROVE" }) }),
    onSuccess: () => { toast.success("Agent created!"); loadReqs(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-6 w-6 text-emerald-400" /> Agent Creation Workflow (20 Steps)</h1><p className="text-sm text-muted-foreground">Steps 1-14 auto-run. Step 15 requires approval. Steps 16-20 create, deploy, monitor, evaluate, certify.</p></div>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Create New Agent</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Agent Purpose *</label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g., UK student visa document review" /></div>
          <Button onClick={() => mutation.mutate({ purpose })} disabled={!purpose || mutation.isPending} className="gap-2"><Bot className="h-4 w-4" />{mutation.isPending ? "Running 14 checks..." : "Start 20-Step Workflow"}</Button>
        </div>
      </Card>
      {result && <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Result</h3><pre className="max-h-64 overflow-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(result, null, 2)}</pre></Card>}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Creation Requests ({requests.length})</h3>
        <div className="space-y-2">
          {requests.length === 0 && <div className="text-xs text-muted-foreground">No requests yet.</div>}
          {requests.map((r) => (
            <div key={r.id as string} className="flex items-center justify-between rounded border p-2">
              <div><div className="text-sm font-medium">{r.purpose as string}</div><div className="text-xs text-muted-foreground">Step {r.currentStep as number}/20 · {r.status as string}</div></div>
              {r.status === "PENDING" && <Button size="sm" onClick={() => approveMutation.mutate(r.id as string)} disabled={approveMutation.isPending} className="gap-1"><CheckCircle2 className="h-3 w-3" /> Approve & Create</Button>}
              {r.status === "COMPLETED" && <Badge variant="outline" className="border-emerald-500 text-emerald-500">Completed</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function DCCSection() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["super-admin-cc"], queryFn: () => apiFetch("/api/super-admin/command-center") });
  if (isLoading || !data) return <Card className="p-8 text-center text-sm text-muted-foreground">Loading...</Card>;
  const dcc = (data as any)?.dcc;
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">DCC Certification</h1><p className="text-sm text-muted-foreground">A department can spawn agents only when certified.</p></div>
      <div className="grid grid-cols-5 gap-2">
        <LevelCard level="PLATINUM" count={dcc.platinum} />
        <LevelCard level="GOLD" count={dcc.gold} />
        <LevelCard level="SILVER" count={dcc.silver} />
        <LevelCard level="BRONZE" count={dcc.bronze} />
        <LevelCard level="NONE" count={dcc.none} />
      </div>
      <Card className="p-3">
        <h3 className="mb-2 text-sm font-semibold">Top 10 Departments</h3>
        <ScrollArea className="h-[300px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card"><tr><th className="p-2 text-left">Department</th><th className="p-2 text-center">Level</th><th className="p-2 text-right">Score</th><th className="p-2 text-center">Can Spawn</th></tr></thead>
            <tbody>
              {dcc.topDepartments?.map((d: Record<string, unknown>) => (
                <tr key={d.slug as string} className="border-b"><td className="p-2">{d.name as string}</td><td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{d.level as string}</Badge></td><td className="p-2 text-right font-mono">{(d.overallScore as number).toFixed(1)}</td><td className="p-2 text-center">{d.canSpawnAgents ? "✅" : "❌"}</td></tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

function SimpleSection({ title, count }: { title: string; count: number }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="mt-4 p-6 text-center">
        <div className="text-4xl font-bold">{count.toLocaleString()}</div>
        <div className="mt-1 text-sm text-muted-foreground">Total {title}</div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return <Card className="p-3"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="mt-1 text-xl font-bold">{value?.toLocaleString() || 0}</div></Card>;
}

function LevelCard({ level, count }: { level: string; count: number }) {
  const colors: Record<string, string> = { PLATINUM: "bg-gradient-to-br from-slate-300 to-slate-500 text-white", GOLD: "bg-gradient-to-br from-amber-400 to-amber-600 text-white", SILVER: "bg-gradient-to-br from-gray-300 to-gray-500 text-white", BRONZE: "bg-gradient-to-br from-orange-400 to-orange-700 text-white", NONE: "bg-muted text-muted-foreground" };
  return <div className={`rounded-lg p-3 text-center ${colors[level]}`}><div className="text-2xl font-bold">{count}</div><div className="text-xs">{level}</div></div>;
}

function InfraCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return <div className="rounded-lg border p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">{label}</span></div><div className="mt-1 text-lg font-bold">{value?.toLocaleString() || 0}</div></div>;
}
