"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";

export function ClientsList() {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const { data, isLoading } = useQuery<any>({ queryKey: ["clients", search], queryFn: () => apiFetch(`/api/clients?search=${encodeURIComponent(search)}`) });
  const clients = data?.clients || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Input placeholder="Search by name, email, Client ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total Clients</div><div className="mt-1 text-xl font-bold">{clients.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Active</div><div className="mt-1 text-xl font-bold">{clients.filter((c: Record<string, unknown>) => c.status === "ACTIVE" || c.status === "IN_PROGRESS").length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Onboarding</div><div className="mt-1 text-xl font-bold">{clients.filter((c: Record<string, unknown>) => c.status === "ONBOARDING").length}</div></Card>
      </div>
      <Card className="p-3">
        <ScrollArea className="h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card"><tr className="border-b"><th className="p-2 text-left">Client ID</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Company</th><th className="p-2 text-center">Projects</th><th className="p-2 text-center">Status</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
              {clients.map((c: Record<string, unknown>) => (
                <tr key={c.id as string} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedId(c.id as string)}>
                  <td className="p-2 font-mono text-xs">{c.clientId as string}</td>
                  <td className="p-2 font-medium">{c.name as string}</td>
                  <td className="p-2">{(c.company as string) || "—"}</td>
                  <td className="p-2 text-center font-mono">{((c._count as Record<string, number>)?.projects) || 0}</td>
                  <td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{c.status as string}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
      {selectedId && <ClientDetailDrawer clientId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function ClientDetailDrawer({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["client-detail", clientId], queryFn: () => apiFetch(`/api/clients/${clientId}`) });
  const { data: journey } = useQuery<any>({ queryKey: ["client-journey", clientId], queryFn: () => apiFetch(`/api/clients/${clientId}/journey`) });
  if (isLoading || !data) return null;
  const c = data.client;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="max-h-[90vh] w-full max-w-4xl overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-xl font-bold">{c.name}</h2><div className="text-sm text-muted-foreground">{c.clientId} · {c.email}</div></div>
          <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Close</button>
        </div>
        {journey && (
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold">Client Journey ({journey.completedSteps}/{journey.totalSteps} · {journey.progress}%)</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {journey.timeline?.map((step: Record<string, unknown>) => (
                <div key={step.name as string} className={`rounded border p-2 text-xs ${step.completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
                  <span className={step.completed ? "" : "text-muted-foreground"}>{step.order as number}. {step.label as string}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">Projects</div><div className="text-lg font-bold">{c._count?.projects || 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Tasks</div><div className="text-lg font-bold">{c._count?.tasks || 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Invoices</div><div className="text-lg font-bold">{c._count?.invoices || 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Meetings</div><div className="text-lg font-bold">{c._count?.meetings || 0}</div></div>
        </div>
      </Card>
    </div>
  );
}
