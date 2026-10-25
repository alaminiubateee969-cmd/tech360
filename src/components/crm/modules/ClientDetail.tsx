"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiFetch, formatDate, formatMoney, formatRelative } from "@/lib/api";

interface ClientDetailData {
  client: {
    id: string;
    clientId: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    businessType: string | null;
    industry: string | null;
    recommendedPlan: string | null;
    status: string;
    totalProjects: number;
    totalRevenue: number;
    notes: string | null;
    createdAt: string;
    lead: unknown | null;
    projects: Project[];
    tasks: Task[];
    invoices: Invoice[];
    meetings: Meeting[];
    evidence: Evidence[];
    communications: Communication[];
    files: FileItem[];
    reviews: Review[];
    scopes: Scope[];
    payments: Payment[];
    journeySteps: JourneyStep[];
  };
}

interface Project { id: string; name: string; status: string; budget: number; createdAt: string; _count?: { tasks: number; milestones: number }; }
interface Task { id: string; title: string; status: string; priority: string; assignedTo: string | null; dueDate: string | null; }
interface Invoice { id: string; invoiceNumber: string; amount: number; total: number; status: string; dueDate: string | null; paidAt: string | null; }
interface Meeting { id: string; title: string; scheduledAt: string; durationMin: number; platform: string | null; meetingUrl: string | null; status: string; }
interface Evidence { id: string; type: string; title: string; description: string | null; url: string | null; capturedAt: string; capturedBy: string | null; }
interface Communication { id: string; channel: string; direction: string; subject: string; body: string; createdAt: string; }
interface FileItem { id: string; name: string; category: string; createdAt: string; }
interface Review { id: string; rating: number; title: string | null; content: string; authorName: string | null; isPublic: boolean; isApproved: boolean; createdAt: string; }
interface Scope { id: string; title: string; status: string; createdAt: string; }
interface Payment { id: string; amount: number; currency: string; status: string; createdAt: string; }
interface JourneyStep { id: string; stepName: string; stepOrder: number; status: string; performedBy: string | null; performedAt: string; data: string; }

const JOURNEY_STEPS = [
  "lead-created", "business-detected", "plan-recommended", "scope-questions",
  "scope-received", "ai-review", "final-scope", "project-plan", "payment-policy",
  "admin-approval", "scope-sent", "client-approval", "meeting-scheduled",
  "html-preview", "payment-tracking", "project-execution", "testing",
  "final-delivery", "payment-verification", "handover", "password-changed",
  "review-requested", "project-closed",
] as const;

function stepLabel(name: string): string {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function ClientDetail({
  clientId,
  onBack,
}: {
  clientId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ClientDetailData>({
    queryKey: ["client", clientId],
    queryFn: () => apiFetch<ClientDetailData>(`/api/clients/${clientId}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data?.client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" /> Back to clients
        </Button>
        <Card className="p-12 text-center text-muted-foreground">
          Client not found.
        </Card>
      </div>
    );
  }

  const c = data.client;

  const journeyByStep = new Map(c.journeySteps.map((j) => [j.stepName, j]));
  const completed = JOURNEY_STEPS.filter(
    (s) => journeyByStep.get(s)?.status === "COMPLETED"
  ).length;
  const progress = Math.round((completed / JOURNEY_STEPS.length) * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["client", clientId] })}
        >
          Refresh
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{c.name}</h2>
              <Badge variant="secondary" className="font-mono">{c.clientId}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {c.email && (
                <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                  <Mail className="size-4" /> {c.email}
                </a>
              )}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="size-4" /> {c.phone}
                </a>
              )}
              {c.company && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-4" /> {c.company}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" /> Since {formatDate(c.createdAt)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{c.status.replace("_", " ")}</Badge>
              {c.businessType && <Badge variant="secondary" className="capitalize">{c.businessType}</Badge>}
              {c.recommendedPlan && <Badge variant="secondary" className="capitalize">{c.recommendedPlan} plan</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold">{c.totalProjects}</div>
              <div className="text-xs text-muted-foreground">Projects</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatMoney(c.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{progress}%</div>
              <div className="text-xs text-muted-foreground">Journey</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="journey">Journey Timeline</TabsTrigger>
          <TabsTrigger value="projects">Projects ({c.projects.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({c.tasks.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({c.invoices.length})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({c.meetings.length})</TabsTrigger>
          <TabsTrigger value="evidence">Evidence ({c.evidence.length})</TabsTrigger>
          <TabsTrigger value="communications">Communications ({c.communications.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({c.files.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({c.reviews.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Business Profile</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Business type</dt><dd className="font-medium capitalize">{c.businessType ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Industry</dt><dd className="font-medium">{c.industry ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd className="font-medium capitalize">{c.recommendedPlan ?? "—"}</dd></div>
              </dl>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Journey Progress</h3>
              <div className="mt-3 space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="text-sm text-muted-foreground">
                  {completed} of {JOURNEY_STEPS.length} steps completed
                </div>
                <div className="text-xs text-muted-foreground">
                  Last activity: {c.journeySteps.length > 0
                    ? formatRelative(c.journeySteps[c.journeySteps.length - 1].performedAt)
                    : "—"}
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                {c.notes ?? "No notes recorded."}
              </p>
            </Card>
          </div>
        </TabsContent>

        {/* Journey Timeline */}
        <TabsContent value="journey">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">23-Step Client Journey</h3>
              <span className="text-xs text-muted-foreground">{progress}% complete</span>
            </div>
            <ol className="relative space-y-3">
              {JOURNEY_STEPS.map((stepName, idx) => {
                const rec = journeyByStep.get(stepName);
                const status = rec?.status ?? "PENDING";
                return (
                  <li key={stepName} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {status === "COMPLETED" ? (
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      ) : status === "IN_PROGRESS" ? (
                        <Clock className="size-5 text-amber-500" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 border-b border-border/40 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">#{String(idx + 1).padStart(2, "0")}</span>
                          <span className="ml-2 font-medium">{stepLabel(stepName)}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            status === "COMPLETED" ? "border-emerald-500/30 text-emerald-600" :
                            status === "IN_PROGRESS" ? "border-amber-500/30 text-amber-600" :
                            "text-muted-foreground"
                          }
                        >
                          {status}
                        </Badge>
                      </div>
                      {rec && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {rec.performedBy && <span>by {rec.performedBy} · </span>}
                          {formatDate(rec.performedAt)} ({formatRelative(rec.performedAt)})
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Budget</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Tasks</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {c.projects.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No projects yet.</td></tr>
                ) : c.projects.map((p) => (
                  <tr key={p.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{p.status.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-3">{formatMoney(p.budget)}</td>
                    <td className="px-4 py-3">{p._count?.tasks ?? 0}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Priority</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Assigned</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Due</th>
                </tr>
              </thead>
              <tbody>
                {c.tasks.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No tasks yet.</td></tr>
                ) : c.tasks.map((t) => (
                  <tr key={t.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-medium">{t.title}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{t.status.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-3">{t.priority}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.assignedTo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.dueDate ? formatDate(t.dueDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Number</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Due</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Paid</th>
                </tr>
              </thead>
              <tbody>
                {c.invoices.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No invoices yet.</td></tr>
                ) : c.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(inv.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === "PAID" ? "default" : "outline"}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.paidAt ? formatDate(inv.paidAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Meetings */}
        <TabsContent value="meetings">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Scheduled</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Duration</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Platform</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {c.meetings.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No meetings yet.</td></tr>
                ) : c.meetings.map((m) => (
                  <tr key={m.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-medium">{m.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(m.scheduledAt)}</td>
                    <td className="px-4 py-3">{m.durationMin} min</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.platform ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{m.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Evidence */}
        <TabsContent value="evidence">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Captured by</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">When</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Link</th>
                </tr>
              </thead>
              <tbody>
                {c.evidence.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No evidence captured yet.</td></tr>
                ) : c.evidence.map((e) => (
                  <tr key={e.id} className="border-b border-border/40">
                    <td className="px-4 py-3"><Badge variant="secondary">{e.type}</Badge></td>
                    <td className="px-4 py-3 font-medium">{e.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.capturedBy ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(e.capturedAt)}</td>
                    <td className="px-4 py-3">
                      {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">View <ChevronRight className="size-3" /></a> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Communications */}
        <TabsContent value="communications">
          <Card className="p-4">
            <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
              {c.communications.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No communications recorded.</p>
              ) : c.communications.map((m) => (
                <div key={m.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{m.channel}</Badge>
                      <Badge variant="outline">{m.direction}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelative(m.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{m.subject}</div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{m.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Files */}
        <TabsContent value="files">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {c.files.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No files yet.</td></tr>
                ) : c.files.map((f) => (
                  <tr key={f.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{f.category}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {c.reviews.length === 0 ? (
              <Card className="col-span-full p-8 text-center text-muted-foreground">No reviews yet.</Card>
            ) : c.reviews.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-500">{"★".repeat(r.rating)}</span>
                    <span className="text-sm font-semibold">{r.title ?? "Review"}</span>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={r.isApproved ? "default" : "outline"}>
                      {r.isApproved ? "Approved" : "Pending"}
                    </Badge>
                    {r.isPublic && <Badge variant="secondary">Public</Badge>}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.content}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {r.authorName ?? "Anonymous"} · {formatDate(r.createdAt)}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
