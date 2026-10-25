"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Mail, Phone, Building2, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch, formatDate, formatRelative } from "@/lib/api";
import { StatusBadge, ScoreBadge } from "../shared/StatusBadge";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string;
  status: string;
  score: number;
  message: string | null;
  createdAt: string;
}

export function LeadsTable() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [source, setSource] = React.useState<string>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const { data, isLoading } = useQuery<{ leads: Lead[] }>({
    queryKey: ["leads", q, status, source],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "all") params.set("status", status);
      if (source !== "all") params.set("source", source);
      return apiFetch(`/api/leads?${params.toString()}`);
    },
  });

  const leads = data?.leads ?? [];
  const selected = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, or company..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="QUALIFIED">Qualified</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="SOCIAL">Social</SelectItem>
                <SelectItem value="REFERRAL">Referral</SelectItem>
                <SelectItem value="DIRECT">Direct</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="size-4" />
              Add Lead
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Source</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">Score</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
                      <td className="hidden px-4 py-3 md:table-cell"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="hidden px-4 py-3 sm:table-cell"><Skeleton className="h-5 w-10" /></td>
                      <td className="hidden px-4 py-3 lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                    </tr>
                  ))
                : leads.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className="cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.email}</div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge variant="secondary" className="font-normal">{l.source}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="lead" value={l.status} />
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <ScoreBadge score={l.score} />
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {formatDate(l.createdAt)}
                      </td>
                    </tr>
                  ))}
              {!isLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No leads match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{selected.name}</SheetTitle>
                <SheetDescription>
                  Lead since {formatDate(selected.createdAt)} · {formatRelative(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge kind="lead" value={selected.status} />
                  <Badge variant="secondary">{selected.source}</Badge>
                  <ScoreBadge score={selected.score} />
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <a href={`mailto:${selected.email}`} className="hover:underline">{selected.email}</a>
                  </div>
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="size-4 text-muted-foreground" />
                      <a href={`tel:${selected.phone}`} className="hover:underline">{selected.phone}</a>
                    </div>
                  )}
                  {selected.company && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="size-4 text-muted-foreground" />
                      {selected.company}
                    </div>
                  )}
                </div>

                {selected.message && (
                  <div>
                    <h4 className="text-sm font-semibold">Message</h4>
                    <p className="mt-1.5 rounded-lg bg-muted/40 p-3 text-sm">{selected.message}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => toast.info("CRM Manager agent notified — drafting reply.")}
                  >
                    <MessageCircle className="size-4" />
                    Assign to agent
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add lead */}
      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["leads"] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }}
      />
    </div>
  );
}

function AddLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const data = new FormData(f);
    setSubmitting(true);
    try {
      await apiFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          company: data.get("company"),
          message: data.get("message"),
        }),
      });
      toast.success("Lead created.");
      onCreated();
      onOpenChange(false);
      f.reset();
    } catch {
      toast.error("Could not create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new lead</DialogTitle>
          <DialogDescription>
            Manually add a lead. They&apos;ll be scored 50 by default and routed to CRM Manager.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
